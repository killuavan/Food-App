import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  getOpenFoodFactsProduct,
  isSupportedFoodBarcode,
} from '../../src/services/openFoodFactsService';
import {
  mapOpenFoodFactsNutrition,
  scaleNutritionForMilliliters,
} from '../../src/utils/usdaNutrition';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Open Food Facts product integration', () => {
  test('accepts supported EAN and UPC barcode lengths only', () => {
    expect(isSupportedFoodBarcode('12345670')).toBe(true);
    expect(isSupportedFoodBarcode('123456789012')).toBe(true);
    expect(isSupportedFoodBarcode('1234567890123')).toBe(true);
    expect(isSupportedFoodBarcode('1234567')).toBe(false);
    expect(isSupportedFoodBarcode('12345678901234')).toBe(false);
    expect(isSupportedFoodBarcode('abc12345')).toBe(false);
  });

  test('maps product fields and only available per-100g nutrients', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '1234567890123',
        product_name: 'Oat Drink',
        brands: 'Example Brand',
        image_front_url: 'https://images.example.test/oat-drink.jpg',
        quantity: '1 L',
        serving_size: '200 ml',
        categories: 'Plant-based beverages',
        ingredients_text: 'Water, oats',
        nutriments: {
          'energy-kcal_100g': 46,
          'energy-kj_100g': 192,
          proteins_100g: 1,
          carbohydrates_100g: 6.7,
          fat_100g: 1.5,
          fiber_100g: 0.8,
          sodium_100g: 0.08,
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const product = await getOpenFoodFactsProduct('1234567890123');
    expect(product).toMatchObject({
      barcode: '1234567890123',
      name: 'Oat Drink',
      brand: 'Example Brand',
      packageDescription: '1 L',
      servingSize: '200 ml',
      packageAmount: 1,
      packageUnit: 'L',
      category: 'Beverages',
    });
    expect(product?.nutritionProfile).toMatchObject({
      fdcId: null,
      source: 'Open Food Facts',
      sourceProductId: '1234567890123',
      basisGrams: 100,
      nutrients: {
        '208': { amount: 46, unit: 'kcal' },
        '268': { amount: 192, unit: 'kJ' },
        '307': { amount: 80, unit: 'mg' },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v2/product/1234567890123.json');
  });

  test('does not claim per-100ml values are per-100g', () => {
    const profile = mapOpenFoodFactsNutrition({
      code: '12345670',
      product_name: 'Drink',
      nutriments: {
        'energy-kcal_100ml': 42,
        proteins_100ml: 0.5,
      },
    });
    expect(profile.basisGrams).toBeNull();
    expect(profile.basisDescription).toContain('per 100 mL');
    expect(profile.nutrients['208'].amount).toBe(42);
    expect(scaleNutritionForMilliliters(profile, 250)?.['208'].amount).toBe(105);
  });

  test('returns not-found for unknown products and surfaces rate limits', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      status: 0,
      status_verbose: 'product not found',
    }), { status: 200 }));
    await expect(getOpenFoodFactsProduct('23456789')).resolves.toBeNull();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 429 }));
    await expect(getOpenFoodFactsProduct('34567890')).rejects.toThrow(/rate limit/i);
  });

  test('surfaces offline failures without generating a product', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getOpenFoodFactsProduct('45678901')).rejects.toThrow(/internet connection/i);
  });
});
