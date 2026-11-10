import { describe, expect, test } from 'vitest';
import { getAdditionalNutrients, mapUsdaFoodDetails, scaleNutritionForGrams } from '@/utils/usdaNutrition';

describe('USDA FoodData Central nutrient mapping', () => {
  test('maps official nutrient IDs, normalizes branded serving amounts per 100 g, and scales portions', () => {
    const profile = mapUsdaFoodDetails({
      fdcId: 123,
      description: 'Example branded food',
      dataType: 'Branded',
      servingSize: 50,
      servingSizeUnit: 'GRM',
      foodNutrients: [
        { amount: 125, nutrient: { id: 1008, number: '1008', name: 'Energy', unitName: 'KCAL' } },
        { amount: 5, nutrient: { id: 1003, number: '1003', name: 'Protein', unitName: 'G' } },
        { amount: 100, nutrient: { id: 1106, number: '1106', name: 'Vitamin A, RAE', unitName: 'µg' } },
      ],
      foodPortions: [{ amount: 1, modifier: 'cup', gramWeight: 75, measureUnit: { name: 'cup' } }],
    });

    expect(profile.basisGrams).toBe(50);
    expect(profile.basisDescription).toBe('per 100 g (normalized from 50 g serving)');
    expect(profile.nutrients['208']).toMatchObject({ amount: 250, unit: 'kcal' });
    expect(profile.nutrients['203']).toMatchObject({ amount: 10, unit: 'g' });
    expect(profile.nutrients['320']).toMatchObject({ amount: 200, unit: 'µg' });
    expect(profile.portions[0]).toMatchObject({ gramWeight: 75, unit: 'cup' });
    expect(scaleNutritionForGrams(profile, 20)?.['208'].amount).toBe(50);
    expect(scaleNutritionForGrams(profile, 20)?.['203'].amount).toBe(2);
  });

  test('keeps energy in kilojoules separate from kilocalories and leaves missing nutrients absent', () => {
    const profile = mapUsdaFoodDetails({
      fdcId: 456,
      description: 'Foundation food',
      dataType: 'Foundation',
      foodNutrients: [
        { amount: 80, nutrient: { id: 1018, number: '1018', name: 'Energy', unitName: 'KJ' } },
        { amount: 1, nutrient: { id: 318, number: '318', name: 'Vitamin A', unitName: 'IU' } },
      ],
    });

    expect(profile.nutrients['268']).toMatchObject({ amount: 80, unit: 'kJ' });
    expect(profile.nutrients['208']).toBeUndefined();
    expect(profile.nutrients['318']).toMatchObject({ amount: 1, unit: 'IU' });
    expect(profile.nutrients['203']).toBeUndefined();
  });

  test('prefers vitamin A RAE over IU and refuses to scale branded data without a gram basis', () => {
    const profile = mapUsdaFoodDetails({
      fdcId: 789,
      description: 'Branded food without serving weight',
      dataType: 'Branded',
      servingSize: 1,
      servingSizeUnit: 'piece',
      foodNutrients: [
        { amount: 10, nutrientId: 318, nutrientName: 'Vitamin A', unitName: 'IU' },
        { amount: 2, nutrientId: 1106, nutrientName: 'Vitamin A RAE', unitName: 'µg' },
        { amount: 100, nutrientId: 1008, nutrientName: 'Energy', unitName: 'KCAL' },
      ],
    });

    expect(profile.basisGrams).toBeNull();
    expect(profile.nutrients['320']).toMatchObject({ amount: 2, unit: 'µg' });
    expect(profile.nutrients['318']).toBeUndefined();
    expect(scaleNutritionForGrams(profile, 50)).toBeNull();
  });

  test('does not report unavailable nutrient values as zero', () => {
    const profile = mapUsdaFoodDetails({
      fdcId: 987,
      description: 'Simple food',
      dataType: 'SR Legacy',
      foodNutrients: [{ amount: 0, nutrientId: 1003, nutrientName: 'Protein', unitName: 'G' }],
    });

    expect(profile.nutrients['203']?.amount).toBe(0);
    expect(profile.nutrients['208']).toBeUndefined();
  });

  test('avoids repeating vitamin A and energy when alternate source units are present', () => {
    const profile = mapUsdaFoodDetails({
      fdcId: 654,
      description: 'Food with alternate energy units',
      dataType: 'Foundation',
      foodNutrients: [
        { amount: 80, nutrientId: 1018, nutrientName: 'Energy', unitName: 'KJ' },
        { amount: 20, nutrientId: 1008, nutrientName: 'Energy', unitName: 'KCAL' },
        { amount: 300, nutrientId: 318, nutrientName: 'Vitamin A', unitName: 'IU' },
      ],
    });

    const additional = getAdditionalNutrients(profile, ['208', '320']);
    expect(additional.map(([id]) => id)).not.toContain('318');
    expect(additional.map(([id]) => id)).not.toContain('268');

    const kilojouleOnly = mapUsdaFoodDetails({
      fdcId: 655,
      description: 'Food with kilojoules only',
      dataType: 'Foundation',
      foodNutrients: [{ amount: 80, nutrientId: 1018, nutrientName: 'Energy', unitName: 'KJ' }],
    });
    expect(getAdditionalNutrients(kilojouleOnly, ['208']).map(([id]) => id)).toContain('268');
  });
});
