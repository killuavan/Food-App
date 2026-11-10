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

function isUsingBackendProxy(): boolean {
  return Boolean(import.meta.env.VITE_NUTRITION_API_BASE_URL?.trim());
}

function makeUrl(path: string, params: Record<string, string | number>): URL {
  const url = new URL(`${getApiBase()}${path}`);
  if (!isUsingBackendProxy()) url.searchParams.set('api_key', demoApiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url;
}

async function requestJson<T>(url: URL, action: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to reach USDA FoodData Central. Check your internet connection. ${detail}`);
  }

  if (response.status === 429) {
    throw new Error('USDA FoodData Central rate limit reached. Wait before searching again or configure a backend proxy with your own API key.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('USDA rejected the API request. Check the API key or backend proxy configuration.');
  }
  if (!response.ok) {
    throw new Error(`USDA FoodData Central request failed (${response.status} ${response.statusText}).`);
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
    }>(makeUrl('/foods/search', {
      query,
      pageNumber: safePage,
      pageSize: safeSize,
      sortBy: 'dataType.keyword',
      sortOrder: 'asc',
    }), 'search foods');
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
    const response = await requestJson<unknown>(makeUrl(`/food/${fdcId}`, {}), 'load food details');
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
