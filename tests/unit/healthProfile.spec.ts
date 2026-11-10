import { describe, expect, test } from 'vitest';
import {
  calculateAge,
  calculateBmi,
  emptyHealthProfileDraft,
  isHealthProfileComplete,
  validateHealthProfileDraft,
} from '../../src/utils/healthProfile';

describe('health profile and BMI rules', () => {
  test('calculates BMI using metric units and recognized adult screening categories', () => {
    expect(calculateBmi(165, 60, 30)).toMatchObject({
      value: 22.04,
      category: 'Healthy weight range',
    });
    expect(calculateBmi(180, 59, 25)?.category).toBe('Underweight');
    expect(calculateBmi(170, 75, 35)?.category).toBe('Overweight');
    expect(calculateBmi(160, 80, 45)?.category).toBe('Obesity');
  });

  test('does not assign adult BMI categories below age 20 or when age is unknown', () => {
    const underTwenty = calculateBmi(165, 60, 19);
    expect(underTwenty?.category).toBeNull();
    expect(underTwenty?.explanation).toMatch(/under 20.*age- and sex-specific/i);

    const noAge = calculateBmi(165, 60, null);
    expect(noAge?.category).toBeNull();
    expect(noAge?.explanation).toMatch(/Age is needed/i);
  });

  test('calculates age based on whether the birthday has occurred this year', () => {
    expect(calculateAge('2000-05-10', new Date(2026, 4, 9))).toBe(25);
    expect(calculateAge('2000-05-10', new Date(2026, 4, 10))).toBe(26);
    expect(calculateAge('2030-01-01', new Date(2026, 0, 1))).toBeNull();
  });

  test('validates measurement ranges and requires date of birth or age, not both', () => {
    const draft = emptyHealthProfileDraft();
    expect(validateHealthProfileDraft({ ...draft, heightCm: 165, weightKg: 60 })).toEqual({});
    expect(validateHealthProfileDraft({
      ...draft,
      dateOfBirth: '2000-01-01',
      age: 26,
      heightCm: 20,
      weightKg: 600,
    })).toMatchObject({
      age: expect.any(String),
      heightCm: expect.any(String),
      weightKg: expect.any(String),
    });
  });

  test('marks a profile complete only when age, height, weight, and activity are present', () => {
    const draft = emptyHealthProfileDraft();
    expect(isHealthProfileComplete(draft)).toBe(false);
    expect(isHealthProfileComplete({
      ...draft,
      age: 19,
      heightCm: 165,
      weightKg: 60,
      activityLevel: 'Lightly Active',
    })).toBe(true);
    expect(isHealthProfileComplete({
      ...draft,
      dateOfBirth: '2007-01-01',
      heightCm: 165,
      weightKg: 60,
      activityLevel: 'Lightly Active',
    })).toBe(true);
  });
});
