import { beforeEach, describe, expect, test } from 'vitest';
import {
  defaultExercisePreferences,
  estimateCalories,
  getDailyFoodIntake,
  getRecommendations,
  getWorkoutHistory,
  saveCompletedWorkout,
  saveDailyFoodIntake,
  saveExercisePreferences,
} from '@/services/exerciseService';

describe('exerciseService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('estimates calories using MET, duration, and body weight', () => {
    expect(estimateCalories(3.5, 30, 70)).toBe(129);
  });

  test('persists daily food intake as context and workout preferences', () => {
    saveDailyFoodIntake(1800);
    expect(getDailyFoodIntake()).toBe(1800);
  });

  test('recommends a safe duration from experience and available time', () => {
    const recommendations = getRecommendations(
      { ...defaultExercisePreferences, experience: 'beginner', availableMinutes: 15 },
      [],
    );
    expect(recommendations).toHaveLength(4);
    expect(recommendations.every((exercise) => exercise.durationMinutes <= 15)).toBe(true);
    expect(recommendations.every((exercise) => exercise.estimatedCalories > 0)).toBe(true);
  });

  test('records a workout only through the completed-workout operation', () => {
    const preferences = { ...defaultExercisePreferences, weightKg: 70 };
    saveExercisePreferences(preferences);
    const recommendation = getRecommendations(preferences, [])[0];

    const workout = saveCompletedWorkout(recommendation, 30);

    expect(workout.completionStatus).toBe('completed');
    expect(getWorkoutHistory()).toHaveLength(1);
    expect(workout.estimatedCalories).toBe(estimateCalories(recommendation.met, 30, 70));
  });
});
