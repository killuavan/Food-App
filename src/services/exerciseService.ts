export type ExerciseCategory =
  | 'walking'
  | 'jogging'
  | 'cycling'
  | 'yoga'
  | 'pilates'
  | 'strength'
  | 'cardio'
  | 'stretching';

export type FitnessGoal = 'general-fitness' | 'weight-management' | 'strength' | 'flexibility' | 'stress-relief';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type FitnessExperience = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  difficulty: FitnessExperience;
  met: number;
  description: string;
  tutorialSearch: string;
  icon: string;
}

export interface ExercisePreferences {
  goal: FitnessGoal;
  activityLevel: ActivityLevel;
  experience: FitnessExperience;
  preferredTypes: ExerciseCategory[];
  availableMinutes: number;
  weightKg: number;
}

export interface WorkoutLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category: ExerciseCategory;
  durationMinutes: number;
  estimatedCalories: number;
  workoutDate: string;
  completionStatus: 'completed';
}

export interface ExerciseRecommendation extends Exercise {
  durationMinutes: number;
  estimatedCalories: number;
}

interface ExerciseStorage {
  preferences: ExercisePreferences;
  dailyFoodIntake: Record<string, number>;
  workouts: WorkoutLog[];
}

const STORAGE_KEY = 'food-inventory.exercise-module.v1';

export const defaultExercisePreferences: ExercisePreferences = {
  goal: 'general-fitness',
  activityLevel: 'light',
  experience: 'beginner',
  preferredTypes: [],
  availableMinutes: 30,
  weightKg: 70,
};

export const exerciseCategories: { value: ExerciseCategory; label: string }[] = [
  { value: 'walking', label: 'Walking' },
  { value: 'jogging', label: 'Jogging' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'pilates', label: 'Pilates' },
  { value: 'strength', label: 'Strength training' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'stretching', label: 'Stretching' },
];

export const exerciseCatalog: Exercise[] = [
  {
    id: 'walking',
    name: 'Brisk Walking',
    category: 'walking',
    difficulty: 'beginner',
    met: 3.5,
    description: 'A low-impact walk at a comfortable, purposeful pace. Adjust the pace to keep the effort conversational.',
    tutorialSearch: 'brisk walking beginner form tips',
    icon: '🚶',
  },
  {
    id: 'jogging',
    name: 'Easy Jogging',
    category: 'jogging',
    difficulty: 'intermediate',
    met: 7,
    description: 'An easy, steady jog. Beginners can alternate short jogging intervals with walking.',
    tutorialSearch: 'beginner easy jogging run walk intervals',
    icon: '🏃',
  },
  {
    id: 'cycling',
    name: 'Leisure Cycling',
    category: 'cycling',
    difficulty: 'beginner',
    met: 6.8,
    description: 'A steady outdoor or stationary ride at a manageable pace, with light resistance.',
    tutorialSearch: 'beginner stationary cycling workout low impact',
    icon: '🚴',
  },
  {
    id: 'beginner-yoga',
    name: 'Beginner Yoga',
    category: 'yoga',
    difficulty: 'beginner',
    met: 2.5,
    description: 'A gentle introduction to foundational poses, breathing, and comfortable transitions.',
    tutorialSearch: 'beginner yoga 20 minute tutorial',
    icon: '🧘',
  },
  {
    id: 'flexibility-yoga',
    name: 'Flexibility Yoga',
    category: 'yoga',
    difficulty: 'beginner',
    met: 2.3,
    description: 'Gentle, unforced poses focused on mobility and flexibility. Never push into pain.',
    tutorialSearch: 'gentle flexibility yoga beginner tutorial',
    icon: '🧘',
  },
  {
    id: 'relaxation-yoga',
    name: 'Relaxation Yoga',
    category: 'yoga',
    difficulty: 'beginner',
    met: 2,
    description: 'Slow breathing and restorative poses for a calm, low-intensity recovery session.',
    tutorialSearch: 'relaxation restorative yoga beginner tutorial',
    icon: '🌿',
  },
  {
    id: 'beginner-pilates',
    name: 'Beginner Pilates',
    category: 'pilates',
    difficulty: 'beginner',
    met: 2.8,
    description: 'A controlled introduction to Pilates fundamentals, posture, and core engagement.',
    tutorialSearch: 'beginner pilates workout fundamentals tutorial',
    icon: '🤸',
  },
  {
    id: 'core-pilates',
    name: 'Core Pilates',
    category: 'pilates',
    difficulty: 'intermediate',
    met: 3.8,
    description: 'A focused mat session using controlled movements to challenge core stability.',
    tutorialSearch: 'core pilates workout tutorial',
    icon: '🤸',
  },
  {
    id: 'full-body-pilates',
    name: 'Full Body Pilates',
    category: 'pilates',
    difficulty: 'intermediate',
    met: 3.5,
    description: 'A balanced mat routine for strength, posture, and whole-body control.',
    tutorialSearch: 'full body pilates workout tutorial',
    icon: '🤸',
  },
  {
    id: 'strength-training',
    name: 'Full-Body Strength',
    category: 'strength',
    difficulty: 'beginner',
    met: 5,
    description: 'A balanced strength session using bodyweight or light resistance. Take rests between sets.',
    tutorialSearch: 'beginner full body strength workout proper form',
    icon: '🏋️',
  },
  {
    id: 'low-impact-cardio',
    name: 'Low-Impact Cardio',
    category: 'cardio',
    difficulty: 'beginner',
    met: 5,
    description: 'Simple low-impact movements that raise your heart rate without jumping.',
    tutorialSearch: 'beginner low impact cardio workout no jumping',
    icon: '💓',
  },
  {
    id: 'stretching',
    name: 'Gentle Stretching',
    category: 'stretching',
    difficulty: 'beginner',
    met: 2.3,
    description: 'A relaxed mobility routine for major muscle groups. Breathe normally and avoid painful ranges.',
    tutorialSearch: 'gentle full body stretching routine beginner',
    icon: '🌱',
  },
];

function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isExerciseStorage(value: unknown): value is ExerciseStorage {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ExerciseStorage>;
  return Boolean(
    data.preferences
      && typeof data.preferences === 'object'
      && data.dailyFoodIntake
      && typeof data.dailyFoodIntake === 'object'
      && Array.isArray(data.workouts),
  );
}

function readStorage(): ExerciseStorage {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new Error(`Unable to read exercise data from this device: ${String(error)}`);
  }
  if (!raw) {
    return {
      preferences: { ...defaultExercisePreferences },
      dailyFoodIntake: {},
      workouts: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Saved exercise data could not be read: ${String(error)}`);
  }
  if (!isExerciseStorage(parsed)) {
    throw new Error('Saved exercise data has an unexpected format. Clear the exercise module data to continue.');
  }
  return parsed;
}

function writeStorage(data: ExerciseStorage): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    throw new Error(`Unable to save exercise data on this device: ${String(error)}`);
  }
}

export function getExercisePreferences(): ExercisePreferences {
  return { ...readStorage().preferences };
}

export function saveExercisePreferences(preferences: ExercisePreferences): void {
  if (!Number.isFinite(preferences.weightKg) || preferences.weightKg < 20 || preferences.weightKg > 300) {
    throw new Error('Enter a body weight between 20 and 300 kg.');
  }
  if (!Number.isFinite(preferences.availableMinutes) || preferences.availableMinutes < 10 || preferences.availableMinutes > 120) {
    throw new Error('Available workout time must be between 10 and 120 minutes.');
  }
  writeStorage({ ...readStorage(), preferences: { ...preferences } });
}

export function getDailyFoodIntake(date = new Date()): number {
  return readStorage().dailyFoodIntake[todayKey(date)] ?? 0;
}

export function saveDailyFoodIntake(calories: number, date = new Date()): void {
  if (!Number.isFinite(calories) || calories < 0 || calories > 20000) {
    throw new Error('Enter a daily calorie total between 0 and 20,000 kcal.');
  }
  const data = readStorage();
  data.dailyFoodIntake[todayKey(date)] = Math.round(calories);
  writeStorage(data);
}

export function getWorkoutHistory(): WorkoutLog[] {
  return [...readStorage().workouts].sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));
}

export function saveCompletedWorkout(
  recommendation: ExerciseRecommendation,
  durationMinutes: number,
  date = new Date(),
): WorkoutLog {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 240) {
    throw new Error('Workout duration must be between 1 and 240 minutes.');
  }
  const preferences = readStorage().preferences;
  const workout: WorkoutLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    exerciseId: recommendation.id,
    exerciseName: recommendation.name,
    category: recommendation.category,
    durationMinutes,
    estimatedCalories: estimateCalories(recommendation.met, durationMinutes, preferences.weightKg),
    workoutDate: date.toISOString(),
    completionStatus: 'completed',
  };
  const data = readStorage();
  data.workouts.push(workout);
  writeStorage(data);
  return workout;
}

export function estimateCalories(met: number, durationMinutes: number, weightKg: number): number {
  return Math.round(((met * 3.5 * weightKg) / 200) * durationMinutes);
}

const goalCategories: Record<FitnessGoal, ExerciseCategory[]> = {
  'general-fitness': ['walking', 'cycling', 'strength', 'cardio', 'yoga', 'pilates'],
  'weight-management': ['walking', 'cycling', 'cardio', 'jogging', 'strength'],
  strength: ['strength', 'pilates', 'cycling'],
  flexibility: ['yoga', 'pilates', 'stretching'],
  'stress-relief': ['yoga', 'stretching', 'walking', 'pilates'],
};

export function getRecommendations(
  preferences: ExercisePreferences,
  history: WorkoutLog[],
): ExerciseRecommendation[] {
  const experienceDuration: Record<FitnessExperience, number> = {
    beginner: 20,
    intermediate: 35,
    advanced: 45,
  };
  const activityAdjustment: Record<ActivityLevel, number> = {
    sedentary: -5,
    light: 0,
    moderate: 5,
    active: 10,
  };
  const plannedDuration = Math.min(
    preferences.availableMinutes,
    Math.max(10, experienceDuration[preferences.experience] + activityAdjustment[preferences.activityLevel]),
  );
  const targetCategories = goalCategories[preferences.goal];
  const today = todayKey();
  const completedToday = new Set(
    history
      .filter((workout) => todayKey(new Date(workout.workoutDate)) === today)
      .map((workout) => workout.exerciseId),
  );

  return exerciseCatalog
    .map((exercise) => ({
      exercise,
      score:
        (targetCategories.includes(exercise.category) ? 4 : 0)
        + (preferences.preferredTypes.length === 0 || preferences.preferredTypes.includes(exercise.category) ? 3 : 0)
        + (exercise.difficulty === preferences.experience ? 1 : 0)
        - (completedToday.has(exercise.id) ? 6 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .slice(0, 4)
    .map(({ exercise }) => {
      const levelLimit = preferences.experience === 'beginner' && exercise.difficulty !== 'beginner'
        ? Math.min(plannedDuration, 20)
        : plannedDuration;
      const durationMinutes = Math.max(10, levelLimit);
      return {
        ...exercise,
        durationMinutes,
        estimatedCalories: estimateCalories(exercise.met, durationMinutes, preferences.weightKg),
      };
    });
}

export function getYouTubeSearchUrl(search: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(search)}`;
}
