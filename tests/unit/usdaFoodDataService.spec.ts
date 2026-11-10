import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Too Many Requests',
    json: async () => body,
  } as Response;
}

describe('USDA FoodData Central service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
});
