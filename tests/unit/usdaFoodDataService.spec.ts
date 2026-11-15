import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Too Many Requests',
    headers: new Headers(),
    json: async () => body,
  } as Response;
}

vi.mock('../../src/services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'test-user-token' } },
        error: null,
      })),
    },
  }),
}));

describe('USDA FoodData Central service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_NUTRITION_API_BASE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test('searches official results with pagination and maps the USDA response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      foods: [{
        fdcId: 123,
        description: 'Bananas, raw',
        dataType: 'Foundation',
        foodCategory: 'Fruits and Fruit Juices',
        householdServingFullText: '1 medium',
        servingSize: 118,
        servingSizeUnit: 'g',
      }],
      totalHits: 31,
      currentPage: 2,
      totalPages: 4,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { searchUsdaFoods } = await import('../../src/services/usdaFoodDataService');
    const page = await searchUsdaFoods('banana', 2, 8);

    expect(page).toMatchObject({
      totalHits: 31,
      currentPage: 2,
      totalPages: 4,
      pageSize: 8,
      foods: [{
        fdcId: 123,
        description: 'Bananas, raw',
        dataType: 'Foundation',
        householdServing: '1 medium',
      }],
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/fdc/v1/foods/search');
    expect(url.searchParams.get('query')).toBe('banana');
    expect(url.searchParams.get('pageNumber')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('8');
    expect(url.searchParams.get('api_key')).toBe('DEMO_KEY');
  });

  test('loads official detail nutrients and normalizes a branded gram serving', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      fdcId: 456,
      description: 'Banana snack',
      dataType: 'Branded',
      servingSize: 50,
      servingSizeUnit: 'GRM',
      foodNutrients: [
        { amount: 44.5, nutrient: { id: 1008, number: '208', name: 'Energy', unitName: 'kcal' } },
        { amount: 3.9, nutrient: { id: 1003, number: '203', name: 'Protein', unitName: 'g' } },
      ],
    })));

    const { getUsdaFoodDetails } = await import('../../src/services/usdaFoodDataService');
    const profile = await getUsdaFoodDetails(456);

    expect(profile.basisGrams).toBe(50);
    expect(profile.nutrients['208']).toMatchObject({ amount: 89, unit: 'kcal' });
    expect(profile.nutrients['203']).toMatchObject({ amount: 7.8, unit: 'g' });
    expect(profile.nutrients['301']).toBeUndefined();
  });

  test('reports rate limits and offline failures explicitly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 429)));
    const { searchUsdaFoods } = await import('../../src/services/usdaFoodDataService');
    await expect(searchUsdaFoods('banana')).rejects.toThrow(/rate limit/i);

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')));
    const { searchUsdaFoods: searchOffline } = await import('../../src/services/usdaFoodDataService');
    await expect(searchOffline('banana')).rejects.toThrow(/check your internet connection/i);
  });

  test('uses the authenticated Supabase proxy without exposing a USDA key', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');
    const fetchMock = vi.fn().mockResolvedValue(response({
      foods: [],
      totalHits: 0,
      currentPage: 1,
      totalPages: 0,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { searchUsdaFoods } = await import('../../src/services/usdaFoodDataService');
    await searchUsdaFoods('apples, raw');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://project.example.supabase.co/functions/v1/usda-food-data');
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-user-token');
    expect(new Headers(options.headers).get('apikey')).toBe('test-publishable-key');
    expect(JSON.parse(String(options.body))).toMatchObject({
      path: '/foods/search',
      params: {
        query: 'apples, raw',
        pageNumber: 1,
        pageSize: 10,
        sortBy: 'dataType.keyword',
        sortOrder: 'desc',
      },
    });
    expect(String(options.body)).not.toContain('api_key');
  });
});
