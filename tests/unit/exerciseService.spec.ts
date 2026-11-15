import { beforeEach, describe, expect, test } from 'vitest';
import {
  defaultExercisePreferences,
  estimateCalories,
  estimateRepetitionCalories,
  getDailyFoodIntake,
  getRecommendations,
  getWorkoutHistory,
  saveCompletedWorkout,
  saveCompletedRepetitionWorkout,
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
    expect(recommendations).toHaveLength(8);
    expect(recommendations.every((exercise) => exercise.durationMinutes <= 15)).toBe(true);
    expect(recommendations.every((exercise) => exercise.estimatedCalories > 0)).toBe(true);
  });

  test('includes equipment-free at-home bodyweight workouts in recommendations', () => {
    const recommendations = getRecommendations(defaultExercisePreferences, []);
    const atHomeWorkouts = recommendations.filter((exercise) => exercise.homeFriendly);

    expect(recommendations).toHaveLength(8);
    expect(atHomeWorkouts.map((exercise) => exercise.id)).toEqual(expect.arrayContaining([
      'wall-push-ups',
      'knee-push-ups',
      'chair-squats',
      'glute-bridges',
      'bird-dog',
      'marching-in-place',
    ]));
  });

  test('recommends repetition counts for individual bodyweight strength exercises', () => {
    const recommendations = getRecommendations(defaultExercisePreferences, []);
    const repetitionWorkouts = recommendations.filter((exercise) => exercise.trackingMode === 'repetitions');

    expect(repetitionWorkouts.length).toBeGreaterThan(0);
    expect(repetitionWorkouts.every((exercise) => exercise.suggestedSets === 2)).toBe(true);
    expect(repetitionWorkouts.every((exercise) => exercise.suggestedRepsPerSet === 8)).toBe(true);
    expect(repetitionWorkouts.every((exercise) => exercise.targetRepetitions === 16)).toBe(true);
    expect(repetitionWorkouts.every((exercise) => exercise.durationMinutes === 1.8)).toBe(true);
    expect(repetitionWorkouts.every((exercise) => exercise.estimatedCalories
      === estimateRepetitionCalories(exercise.met, 16, 8, defaultExercisePreferences.weightKg))).toBe(true);
  });

  test('adjusts strength repetition suggestions for experience level', () => {
    const intermediate = getRecommendations(
      { ...defaultExercisePreferences, experience: 'intermediate' },
      [],
    ).find((exercise) => exercise.id === 'knee-push-ups');
    const advanced = getRecommendations(
      { ...defaultExercisePreferences, experience: 'advanced' },
      [],
    ).find((exercise) => exercise.id === 'knee-push-ups');

    expect(intermediate?.suggestedSets).toBe(3);
    expect(intermediate?.suggestedRepsPerSet).toBe(10);
    expect(intermediate?.targetRepetitions).toBe(30);
    expect(advanced?.suggestedSets).toBe(3);
    expect(advanced?.suggestedRepsPerSet).toBe(12);
    expect(advanced?.targetRepetitions).toBe(36);
  });

  test('uses the saved health-profile gender for strength repetition suggestions', () => {
    const female = getRecommendations(defaultExercisePreferences, [], 'female')
      .find((exercise) => exercise.id === 'knee-push-ups');
    const male = getRecommendations(defaultExercisePreferences, [], 'male')
      .find((exercise) => exercise.id === 'knee-push-ups');

    expect(female?.suggestedRepsPerSet).toBe(8);
    expect(female?.targetRepetitions).toBe(16);
    expect(male?.suggestedRepsPerSet).toBe(10);
    expect(male?.targetRepetitions).toBe(20);
  });

  test('promotes workouts that match the free-text health-profile fitness goal', () => {
    const defaultRecommendations = getRecommendations(defaultExercisePreferences, []);
    const flexibilityRecommendations = getRecommendations(
      defaultExercisePreferences,
      [],
      '',
      'Improve flexibility and mobility',
    );

    expect(defaultRecommendations.some((exercise) => exercise.id === 'stretching')).toBe(false);
    expect(flexibilityRecommendations.some((exercise) => exercise.id === 'stretching')).toBe(true);
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

  test('saves the actual elapsed time for a timed workout', () => {
    const recommendation = getRecommendations(defaultExercisePreferences, [])
      .find((exercise) => exercise.trackingMode !== 'repetitions');
    expect(recommendation).toBeDefined();
    if (!recommendation) return;

    const workout = saveCompletedWorkout(recommendation, 1.5);

    expect(workout.durationMinutes).toBe(1.5);
    expect(workout.estimatedCalories).toBe(estimateCalories(recommendation.met, 1.5, defaultExercisePreferences.weightKg));
  });

  test('records repetitions and estimates calories including set rest', () => {
    const recommendation = getRecommendations(defaultExercisePreferences, [])
      .find((exercise) => exercise.id === 'knee-push-ups');
    expect(recommendation).toBeDefined();
    if (!recommendation) return;

    const workout = saveCompletedRepetitionWorkout(recommendation, 20);

    expect(workout.repetitions).toBe(20);
    expect(workout.durationMinutes).toBe(3);
    expect(workout.estimatedCalories).toBe(
      estimateRepetitionCalories(
        recommendation.met,
        20,
        recommendation.suggestedRepsPerSet ?? 20,
        defaultExercisePreferences.weightKg,
      ),
    );
    expect(getWorkoutHistory()).toHaveLength(1);
  });

  test('uses the stopwatch duration for repetition-workout history and calories', () => {
    const recommendation = getRecommendations(defaultExercisePreferences, [])
      .find((exercise) => exercise.id === 'knee-push-ups');
    expect(recommendation).toBeDefined();
    if (!recommendation) return;

    const workout = saveCompletedRepetitionWorkout(recommendation, 20, new Date(), 90);

    expect(workout.durationMinutes).toBe(1.5);
    expect(workout.estimatedCalories).toBe(
      estimateRepetitionCalories(
        recommendation.met,
        20,
        recommendation.suggestedRepsPerSet ?? 20,
        defaultExercisePreferences.weightKg,
        90,
      ),
    );
  });

  test('includes rest time between sets in repetition-based calorie estimates', () => {
    const activeOnlyCalories = estimateCalories(4, 1, 70);
    const withSetRestCalories = estimateRepetitionCalories(4, 20, 10, 70);

    expect(withSetRestCalories).toBeGreaterThan(activeOnlyCalories);
    expect(withSetRestCalories).toBe(7);
  });
});
