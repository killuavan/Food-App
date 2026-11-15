import {
  mapUsdaFoodDetails,
  mapUsdaSearchFood,
  type NutritionProfile,
  type UsdaSearchPage,
} from '../utils/usdaNutrition';

const defaultApiBase = 'https://api.nal.usda.gov/fdc/v1';
const demoApiKey = 'DEMO_KEY';
const searchCache = new Map<string, { expiresAt: number; result: UsdaSearchPage }>();
const detailsCache = new Map<number, { expiresAt: number; result: NutritionProfile }>();
const pendingSearches = new Map<string, Promise<UsdaSearchPage>>();
const pendingDetails = new Map<number, Promise<NutritionProfile>>();
const cacheDurationMs = 5 * 60 * 1000;

function getApiBase(): string {
  const configured = import.meta.env.VITE_NUTRITION_API_BASE_URL?.trim();
  return (configured || defaultApiBase).replace(/\/+$/, '');
}

function getConfiguredProxy(): string {
  return import.meta.env.VITE_NUTRITION_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';
}

function getSupabaseProxyConfig(): { url: string; key: string } | null {
  if (getConfiguredProxy()) return null;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

function isUsingBackendProxy(): boolean {
  return Boolean(getConfiguredProxy() || getSupabaseProxyConfig());
}

async function requestJson<T>(
  path: string,
  params: Record<string, string | number>,
  action: string,
): Promise<T> {
  const supabaseProxy = getSupabaseProxyConfig();
  let response: Response;
  try {
    if (supabaseProxy) {
      const { getSupabaseClient } = await import('./supabaseClient');
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw new Error(`Could not verify your session for USDA search: ${error.message}`);
      if (!data.session?.access_token) {
        throw new Error('Sign in before searching USDA nutrition.');
      }
      response = await fetch(`${supabaseProxy.url}/functions/v1/usda-food-data`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: supabaseProxy.key,
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ path, params }),
      });
    } else {
      const url = new URL(`${getApiBase()}${path}`);
      if (!isUsingBackendProxy()) url.searchParams.set('api_key', demoApiKey);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
      response = await fetch(url);
    }
  } catch (error) {
    if (error instanceof Error && (
      error.message.startsWith('Could not verify your session')
      || error.message === 'Sign in before searching USDA nutrition.'
    )) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to reach USDA FoodData Central. Check your internet connection. ${detail}`);
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const wait = retryAfter && /^\d+$/.test(retryAfter)
      ? ` Try again in about ${retryAfter} seconds.`
      : ' Try again later.';
    throw new Error(`USDA FoodData Central rate limit reached.${wait}`);
  }
  if (response.status === 401 || response.status === 403) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string'
      ? body.error
      : 'USDA rejected the API request. Check the API key or backend proxy configuration.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string'
      ? body.error
      : `USDA FoodData Central request failed (${response.status} ${response.statusText}).`);
  }

  try {
    return await response.json() as T;
  } catch {
    throw new Error(`USDA returned an unreadable response while trying to ${action}.`);
  }
}

export async function searchUsdaFoods(
  searchTerm: string,
  pageNumber = 1,
  pageSize = 10,
): Promise<UsdaSearchPage> {
  const query = searchTerm.trim();
  if (!query) return { foods: [], totalHits: 0, currentPage: 1, totalPages: 0, pageSize };
  const safePage = Math.max(1, Math.floor(pageNumber));
  const safeSize = Math.min(25, Math.max(1, Math.floor(pageSize)));
  const cacheKey = `${query.toLocaleLowerCase()}|${safePage}|${safeSize}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pending = pendingSearches.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    const response = await requestJson<{
      foods?: unknown[];
      totalHits?: number;
      currentPage?: number;
      totalPages?: number;
    }>('/foods/search', {
      query,
      pageNumber: safePage,
      pageSize: safeSize,
      sortBy: 'dataType.keyword',
      sortOrder: 'desc',
    }, 'search foods');
    const result: UsdaSearchPage = {
      foods: (response.foods ?? []).map(mapUsdaSearchFood).filter((food) => food !== null),
      totalHits: Number.isFinite(response.totalHits) ? Number(response.totalHits) : 0,
      currentPage: Number.isFinite(response.currentPage) ? Number(response.currentPage) : safePage,
      totalPages: Number.isFinite(response.totalPages) ? Number(response.totalPages) : 0,
      pageSize: safeSize,
    };
    searchCache.set(cacheKey, { expiresAt: Date.now() + cacheDurationMs, result });
    return result;
  })();
  pendingSearches.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingSearches.delete(cacheKey);
  }
}

export async function getUsdaFoodDetails(fdcId: number): Promise<NutritionProfile> {
  if (!Number.isInteger(fdcId) || fdcId <= 0) throw new Error('Select a valid USDA food ID.');
  const cached = detailsCache.get(fdcId);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pending = pendingDetails.get(fdcId);
  if (pending) return pending;

  const request = (async () => {
    const response = await requestJson<unknown>(`/food/${fdcId}`, {}, 'load food details');
    const result = mapUsdaFoodDetails(response);
    detailsCache.set(fdcId, { expiresAt: Date.now() + cacheDurationMs, result });
    return result;
  })();
  pendingDetails.set(fdcId, request);
  try {
    return await request;
  } finally {
    pendingDetails.delete(fdcId);
  }
}
