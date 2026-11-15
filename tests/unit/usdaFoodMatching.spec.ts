import { describe, expect, test } from 'vitest';
import { isConfidentFoodMatch } from '../../src/utils/usdaFoodMatching';

describe('USDA food match confidence', () => {
  test('matches common singular and plural USDA descriptions', () => {
    expect(isConfidentFoodMatch('Apple', 'Apples, raw, with skin')).toBe(true);
    expect(isConfidentFoodMatch('Brown rice', 'Rice, brown, long-grain, raw')).toBe(true);
  });

  test('does not auto-match mixed dishes or distinct preparations', () => {
    expect(isConfidentFoodMatch('Brown rice', 'Beans and brown rice')).toBe(false);
    expect(isConfidentFoodMatch('Apple', 'Apple juice')).toBe(false);
    expect(isConfidentFoodMatch('Rice', 'Rice and beans')).toBe(false);
  });

  test('does not match empty searches', () => {
    expect(isConfidentFoodMatch('', 'Apple, raw')).toBe(false);
  });
});
