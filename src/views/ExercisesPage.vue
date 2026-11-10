<template>
  <ion-page>
    <AppNavigation />

    <ion-content :fullscreen="true">
      <main class="dashboard">
        <header class="welcome">
          <div>
            <h1>Exercise &amp; movement</h1>
          </div>
          <span class="date-chip">{{ todayLabel }}</span>
        </header>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading exercise dashboard" />
        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>

        <section aria-label="Today's activity">
          <div class="metric-grid">
            <ion-card class="metric-card">
              <ion-card-content>
                <p class="metric-label"><ion-icon :icon="restaurantOutline" aria-hidden="true" /> Daily food intake</p>
                <div class="metric-value">{{ dailyIntake.toLocaleString() }} <span>kcal</span></div>
                <p class="metric-note">Nutrition context, not a workout target</p>
                <div class="intake-edit">
                  <ion-input
                    v-model.number="intakeDraft"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    max="20000"
                    label="Today's total (kcal)"
                    label-placement="stacked"
                    aria-label="Today's total food calories"
                  />
                  <ion-button size="small" fill="outline" @click="saveIntake">Save</ion-button>
                </div>
              </ion-card-content>
            </ion-card>
            <ion-card class="metric-card">
              <ion-card-content>
                <p class="metric-label"><ion-icon :icon="timeOutline" aria-hidden="true" /> Workout time</p>
                <div class="metric-value">{{ todayMinutes }} <span>min</span></div>
                <p class="metric-note">Completed today</p>
              </ion-card-content>
            </ion-card>
            <ion-card class="metric-card">
              <ion-card-content>
                <p class="metric-label"><ion-icon :icon="flameOutline" aria-hidden="true" /> Energy expenditure</p>
                <div class="metric-value">{{ todayCalories }} <span>kcal</span></div>
                <p class="metric-note">Estimated from completed workouts</p>
              </ion-card-content>
            </ion-card>
            <ion-card class="metric-card">
              <ion-card-content>
                <p class="metric-label"><ion-icon :icon="checkmarkDoneOutline" aria-hidden="true" /> Completed workouts</p>
                <div class="metric-value">{{ todayWorkouts.length }} <span>sessions</span></div>
                <p class="metric-note">Rest is part of progress</p>
              </ion-card-content>
            </ion-card>
          </div>
        </section>

        <section class="preferences-section" aria-labelledby="preferences-heading">
          <div class="section-heading">
            <div>
              <h2 id="preferences-heading">Exercise preferences</h2>
            </div>
          </div>
          <ion-card class="preferences-card">
            <ion-card-content>
              <div class="preferences-grid">
                <ion-item>
                  <ion-select v-model="preferences.goal" label="Fitness goal" interface="popover">
                    <ion-select-option value="general-fitness">General fitness</ion-select-option>
                    <ion-select-option value="weight-management">Weight management</ion-select-option>
                    <ion-select-option value="strength">Build strength</ion-select-option>
                    <ion-select-option value="flexibility">Flexibility</ion-select-option>
                    <ion-select-option value="stress-relief">Stress relief</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select v-model="preferences.activityLevel" label="Activity level" interface="popover">
                    <ion-select-option value="sedentary">Mostly sedentary</ion-select-option>
                    <ion-select-option value="light">Light</ion-select-option>
                    <ion-select-option value="moderate">Moderate</ion-select-option>
                    <ion-select-option value="active">Active</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select v-model="preferences.experience" label="Experience" interface="popover">
                    <ion-select-option value="beginner">Beginner</ion-select-option>
                    <ion-select-option value="intermediate">Intermediate</ion-select-option>
                    <ion-select-option value="advanced">Advanced</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select v-model="preferences.preferredTypes" label="Preferred types" multiple interface="popover">
                    <ion-select-option v-for="category in exerciseCategories" :key="category.value" :value="category.value">
                      {{ category.label }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select v-model.number="preferences.availableMinutes" label="Available time" interface="popover">
                    <ion-select-option v-for="minutes in availableTimeOptions" :key="minutes" :value="minutes">
                      {{ minutes }} minutes
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-input
                    v-model.number="preferences.weightKg"
                    type="number"
                    inputmode="decimal"
                    min="20"
                    max="300"
                    label="Body weight (kg)"
                    label-placement="stacked"
                  />
                </ion-item>
              </div>
              <div class="preferences-actions">
                <p>Based on your preferences and workout history; food intake does not set workout goals.</p>
                <ion-button @click="savePreferences">Save preferences</ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </section>

        <section class="recommendations-section" aria-labelledby="recommendations-heading">
          <div class="section-heading">
            <div>
              <h2 id="recommendations-heading">Recommended workouts</h2>
            </div>
            <span class="recommendation-caption">MET-based calorie estimates</span>
          </div>
          <p class="rest-note">Choose a comfortable pace, take breaks when needed, and leave time for recovery.</p>
          <p class="met-source">
            MET values are approximate activity-intensity references based on the
            <a href="https://pacompendium.com/" target="_blank" rel="noopener noreferrer">Adult Compendium of Physical Activities</a>.
          </p>
          <div class="workout-grid">
            <ion-card v-for="exercise in recommendations" :key="exercise.id" class="workout-card">
              <div class="exercise-art" aria-hidden="true">
                <span>{{ exercise.icon }}</span>
                <span class="play-mark">▶</span>
              </div>
              <ion-card-content>
                <div class="workout-title-row">
                  <div>
                    <p class="category-label">{{ categoryLabel(exercise.category) }}</p>
                    <h3>{{ exercise.name }}</h3>
                  </div>
                  <span class="difficulty">{{ capitalize(exercise.difficulty) }}</span>
                </div>
                <p class="exercise-description">{{ exercise.description }}</p>
                <div class="workout-stats">
                  <span>{{ exercise.durationMinutes }} min</span>
                  <span>~{{ exercise.estimatedCalories }} kcal</span>
                </div>
                <p class="estimate-note">Estimated expenditure</p>
                <div class="card-actions">
                  <ion-button fill="outline" @click="openTutorial(exercise)">Watch tutorial</ion-button>
                  <ion-button @click="startWorkout(exercise)">Start workout</ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
        </section>

        <section class="history-section" aria-labelledby="history-heading">
          <div class="section-heading">
            <div>
              <h2 id="history-heading">Workout history</h2>
            </div>
          </div>
          <ion-card class="history-card">
            <ion-list v-if="workoutHistory.length">
              <ion-item v-for="workout in workoutHistory" :key="workout.id">
                <div class="history-icon" slot="start">{{ iconFor(workout.exerciseId) }}</div>
                <ion-label>
                  <h3>{{ workout.exerciseName }}</h3>
                  <p>{{ formatWorkoutDate(workout.workoutDate) }} · {{ workout.durationMinutes }} min · ~{{ workout.estimatedCalories }} kcal</p>
                </ion-label>
                <span class="completed-tag">Completed</span>
              </ion-item>
            </ion-list>
            <ion-card-content v-else class="empty-history">
              Your completed workouts will appear here. Start a recommendation whenever you’re ready.
            </ion-card-content>
          </ion-card>
        </section>
      </main>

      <ion-modal :is-open="Boolean(activeWorkout)" @didDismiss="closeWorkout">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ activeWorkout?.name ?? 'Workout' }}</ion-title>
            <ion-button slot="end" fill="clear" @click="closeWorkout">Close</ion-button>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div v-if="activeWorkout" class="workout-modal">
            <div class="modal-exercise-icon">{{ activeWorkout.icon }}</div>
            <p>{{ activeWorkout.description }}</p>
            <ion-item>
              <ion-input
                v-model.number="durationDraft"
                type="number"
                inputmode="numeric"
                min="1"
                max="240"
                label="Workout duration (minutes)"
                label-placement="stacked"
              />
            </ion-item>
            <div class="live-estimate">
              <span>Estimated calories burned</span>
              <strong>~{{ activeWorkoutEstimate }} kcal</strong>
            </div>
            <p class="estimate-note">Estimate based on MET intensity and your saved body weight.</p>
            <ion-button expand="block" @click="requestWorkoutCompletion">Complete workout</ion-button>
            <ion-button expand="block" fill="clear" @click="closeWorkout">Cancel</ion-button>
          </div>
        </ion-content>
      </ion-modal>

      <ion-modal :is-open="Boolean(activeTutorial)" @didDismiss="activeTutorial = null">
        <ion-header>
          <ion-toolbar>
            <ion-title>Tutorial: {{ activeTutorial?.name ?? '' }}</ion-title>
            <ion-button slot="end" fill="clear" @click="activeTutorial = null">Close</ion-button>
          </ion-toolbar>
        </ion-header>
        <ion-content class="modal-content">
          <div v-if="activeTutorial" class="tutorial-modal">
            <div class="tutorial-thumbnail" aria-label="Video tutorial preview">
              <span>{{ activeTutorial.icon }}</span>
              <span class="thumbnail-play">▶</span>
              <small>YouTube tutorial</small>
            </div>
            <h2>{{ activeTutorial.name }}</h2>
            <p>Instructional video for {{ activeTutorial.name.toLowerCase() }}.</p>
            <ion-button expand="block" :href="tutorialUrl(activeTutorial)" target="_blank" rel="noopener noreferrer">
              Open tutorial on YouTube
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>

      <ion-alert
        :is-open="showCompletionConfirmation"
        header="Complete this workout?"
        message="This session will be saved to your workout history only after you confirm."
        :buttons="completionAlertButtons"
        @didDismiss="showCompletionConfirmation = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppNavigation from '../components/AppNavigation.vue';
import {
  IonAlert,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { checkmarkDoneOutline, flameOutline, restaurantOutline, timeOutline } from 'ionicons/icons';
import {
  exerciseCategories,
  exerciseCatalog,
  getDailyFoodIntake,
  getExercisePreferences,
  getRecommendations,
  getWorkoutHistory,
  getYouTubeSearchUrl,
  saveCompletedWorkout,
  saveDailyFoodIntake,
  saveExercisePreferences,
  estimateCalories,
  type Exercise,
  type ExerciseCategory,
  type ExercisePreferences,
  type ExerciseRecommendation,
  type WorkoutLog,
} from '../services/exerciseService';

const availableTimeOptions = [10, 15, 20, 30, 45, 60, 90, 120];
const loading = ref(true);
const errorMessage = ref('');
const preferences = ref<ExercisePreferences>({ ...getDefaults() });
const workoutHistory = ref<WorkoutLog[]>([]);
const dailyIntake = ref(0);
const intakeDraft = ref<number>(0);
const activeWorkout = ref<ExerciseRecommendation | null>(null);
const activeTutorial = ref<Exercise | null>(null);
const durationDraft = ref<number>(20);
const showCompletionConfirmation = ref(false);

function getDefaults(): ExercisePreferences {
  return {
    goal: 'general-fitness',
    activityLevel: 'light',
    experience: 'beginner',
    preferredTypes: [],
    availableMinutes: 30,
    weightKg: 70,
  };
}

const recommendations = computed(() => getRecommendations(preferences.value, workoutHistory.value));
const todayWorkouts = computed(() => workoutHistory.value.filter((workout) => {
  const date = new Date(workout.workoutDate);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}));
const todayMinutes = computed(() => todayWorkouts.value.reduce((sum, workout) => sum + workout.durationMinutes, 0));
const todayCalories = computed(() => todayWorkouts.value.reduce((sum, workout) => sum + workout.estimatedCalories, 0));
const activeWorkoutEstimate = computed(() => {
  if (!activeWorkout.value || !Number.isFinite(durationDraft.value) || durationDraft.value <= 0) return 0;
  return estimateCalories(activeWorkout.value.met, durationDraft.value, preferences.value.weightKg);
});
const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

const completionAlertButtons = [
  { text: 'Keep going', role: 'cancel' },
  { text: 'Confirm completion', role: 'confirm', handler: confirmWorkoutCompletion },
];

onMounted(() => {
  try {
    preferences.value = getExercisePreferences();
    workoutHistory.value = getWorkoutHistory();
    dailyIntake.value = getDailyFoodIntake();
    intakeDraft.value = dailyIntake.value;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
});

function savePreferences(): void {
  try {
    saveExercisePreferences(preferences.value);
    workoutHistory.value = getWorkoutHistory();
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

function saveIntake(): void {
  try {
    saveDailyFoodIntake(intakeDraft.value);
    dailyIntake.value = getDailyFoodIntake();
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

function startWorkout(exercise: ExerciseRecommendation): void {
  activeWorkout.value = exercise;
  durationDraft.value = exercise.durationMinutes;
}

function closeWorkout(): void {
  activeWorkout.value = null;
  showCompletionConfirmation.value = false;
}

function requestWorkoutCompletion(): void {
  if (!activeWorkout.value || !Number.isInteger(durationDraft.value) || durationDraft.value < 1 || durationDraft.value > 240) {
    errorMessage.value = 'Choose a whole-number workout duration from 1 to 240 minutes.';
    return;
  }
  showCompletionConfirmation.value = true;
}

function confirmWorkoutCompletion(): void {
  if (!activeWorkout.value) return;
  try {
    saveCompletedWorkout(activeWorkout.value, durationDraft.value);
    workoutHistory.value = getWorkoutHistory();
    errorMessage.value = '';
    closeWorkout();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    showCompletionConfirmation.value = false;
  }
}

function openTutorial(exercise: Exercise): void {
  activeTutorial.value = exercise;
}

function tutorialUrl(exercise: Exercise): string {
  return getYouTubeSearchUrl(exercise.tutorialSearch);
}

function categoryLabel(category: ExerciseCategory): string {
  return exerciseCategories.find((item) => item.value === category)?.label ?? category;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function iconFor(exerciseId: string): string {
  return exerciseCatalog.find((exercise) => exercise.id === exerciseId)?.icon ?? '🏅';
}

function formatWorkoutDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
</script>

<style scoped>
.dashboard {
  width: min(1180px, 100%);
  margin: 0 auto;
  padding: 32px 28px 64px;
}

ion-header ion-toolbar {
  --background: #fff;
  --border-color: #e8eeea;
  --color: #173f35;
}

ion-header ion-title {
  font-weight: 700;
}

.welcome,
.section-heading,
.workout-title-row,
.preferences-actions,
.card-actions,
.intake-edit,
.workout-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.welcome {
  position: relative;
  overflow: hidden;
  min-height: 176px;
  margin-bottom: 22px;
  padding: 30px 34px;
  border-radius: 24px;
  background:
    linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%),
    url('/images/food-banner.svg') center / cover no-repeat;
  box-shadow: 0 16px 34px rgb(25 80 61 / 16%);
}

.welcome::after {
  position: absolute;
  right: 38px;
  bottom: -78px;
  width: 220px;
  height: 220px;
  border: 1px solid rgb(255 255 255 / 13%);
  border-radius: 50%;
  box-shadow: 0 0 0 24px rgb(255 255 255 / 4%), 0 0 0 52px rgb(255 255 255 / 3%);
  content: "";
}

.welcome h1,
.section-heading h2 {
  margin: 4px 0;
  color: var(--ion-text-color);
}

.welcome h1,
.welcome .subheading,
.welcome .eyebrow,
.welcome .date-chip {
  position: relative;
  z-index: 1;
}

.welcome h1,
.welcome .subheading {
  color: #fff;
}

.welcome h1 {
  font-size: clamp(2rem, 4vw, 2.65rem);
  letter-spacing: -0.045em;
}

.welcome .eyebrow {
  color: #bcebd0;
}

.welcome .subheading {
  max-width: 520px;
  color: rgb(255 255 255 / 82%);
}

.subheading,
.preferences-actions p,
.rest-note {
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.subheading {
  margin: 8px 0 0;
}

.eyebrow,
.category-label {
  margin: 0;
  color: var(--ion-color-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.date-chip,
.difficulty,
.completed-tag {
  border-radius: 999px;
  background: var(--ion-color-light);
  color: var(--ion-color-dark);
  font-size: 0.78rem;
  padding: 7px 11px;
  white-space: nowrap;
}

.welcome .date-chip {
  border: 1px solid rgb(255 255 255 / 24%);
  background: rgb(255 255 255 / 12%);
  color: #fff;
  backdrop-filter: blur(8px);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card,
.preferences-card,
.workout-card,
.history-card {
  margin: 0;
  border: 1px solid #e7eeea;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 5px 20px rgb(22 55 43 / 5%);
}

.metric-card {
  min-width: 0;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.metric-card:hover,
.workout-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 26px rgb(22 55 43 / 10%);
}

.metric-card ion-card-content {
  min-height: 145px;
  padding: 18px;
}

.metric-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--ion-color-medium);
  font-size: 0.86rem;
}

.metric-label ion-icon {
  padding: 6px;
  border-radius: 9px;
  background: #eaf5ef;
  color: var(--ion-color-primary);
  font-size: 1rem;
}

.metric-card:nth-child(2) .metric-label ion-icon {
  background: #edf3ff;
  color: #5271ba;
}

.metric-card:nth-child(3) .metric-label ion-icon {
  background: #fff3e8;
  color: #ca7832;
}

.metric-card:nth-child(4) .metric-label ion-icon {
  background: #f1edff;
  color: #7b65b6;
}

.metric-value {
  font-size: 1.8rem;
  font-weight: 750;
  letter-spacing: -0.04em;
  color: #173f35;
}

.metric-value span {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0;
}

.metric-note,
.estimate-note {
  margin: 7px 0 0;
  color: var(--ion-color-medium);
  font-size: 0.76rem;
  line-height: 1.4;
}

.intake-edit {
  align-items: flex-end;
  margin-top: 10px;
}

.intake-edit ion-input {
  max-width: 200px;
  --highlight-color-focused: var(--ion-color-primary);
}

.preferences-section,
.recommendations-section,
.history-section {
  margin-top: 34px;
}

.section-heading {
  margin-bottom: 12px;
}

.section-heading h2 {
  font-size: 1.35rem;
  font-weight: 720;
  letter-spacing: -0.025em;
}

.recommendation-caption {
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}

.preferences-card ion-card-content {
  padding: 18px;
}

.preferences-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 14px;
}

.preferences-grid ion-item {
  --border-radius: 10px;
  --border-color: var(--ion-color-step-150, #e5e8eb);
  --padding-start: 12px;
  border: 1px solid var(--ion-color-step-150, #e5e8eb);
  border-radius: 10px;
  --background: #fbfdfb;
}

.preferences-actions {
  margin-top: 14px;
}

.preferences-actions p {
  margin: 0;
  font-size: 0.82rem;
}

.rest-note {
  margin: -4px 0 16px;
  font-size: 0.85rem;
}

.met-source {
  margin: -10px 0 16px;
  color: var(--ion-color-medium);
  font-size: 0.75rem;
  line-height: 1.5;
}

.met-source a {
  color: var(--ion-color-primary);
}

.workout-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.workout-card {
  overflow: hidden;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.exercise-art {
  position: relative;
  display: grid;
  min-height: 132px;
  place-items: center;
  background:
    radial-gradient(circle at 78% 22%, rgb(255 255 255 / 65%), transparent 28%),
    linear-gradient(135deg, #e1f2e8, #e8f1fa);
  font-size: 3.6rem;
}

.play-mark,
.thumbnail-play {
  position: absolute;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: rgb(255 255 255 / 92%);
  color: var(--ion-color-primary);
  font-size: 0.8rem;
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
}

.play-mark {
  right: 14px;
  bottom: 12px;
}

.workout-card ion-card-content {
  padding: 16px;
}

.workout-title-row {
  align-items: flex-start;
}

.workout-title-row h3 {
  margin: 5px 0 0;
  font-size: 1.05rem;
}

.category-label {
  font-size: 0.64rem;
}

.difficulty {
  padding: 5px 8px;
  font-size: 0.68rem;
  background: #eef5f0;
  color: #32664f;
}

.exercise-description {
  min-height: 66px;
  margin: 12px 0;
  color: var(--ion-color-medium);
  font-size: 0.82rem;
  line-height: 1.5;
}

.workout-stats {
  justify-content: flex-start;
  gap: 12px;
  font-size: 0.9rem;
  font-weight: 650;
}

.workout-stats span + span {
  padding-left: 12px;
  border-left: 1px solid var(--ion-color-step-150, #e5e8eb);
}

.card-actions {
  margin-top: 14px;
  gap: 6px;
}

.card-actions ion-button {
  flex: 1;
  margin: 0;
  font-size: 0.72rem;
  --border-radius: 10px;
  --box-shadow: none;
}

.history-card {
  overflow: hidden;
}

.history-icon {
  display: grid;
  width: 38px;
  height: 38px;
  margin-right: 12px;
  place-items: center;
  border-radius: 12px;
  background: #eaf5ef;
  font-size: 1.2rem;
}

.history-card ion-item h3 {
  font-weight: 650;
}

.history-card ion-item p {
  white-space: normal;
}

.completed-tag {
  background: #e5f5ee;
  color: #247250;
  font-weight: 650;
}

.empty-history {
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.error-card {
  border: 1px solid var(--ion-color-danger);
  color: var(--ion-color-danger);
}

.workout-modal,
.tutorial-modal {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
}

.modal-exercise-icon {
  display: grid;
  width: 90px;
  height: 90px;
  margin: 12px auto 20px;
  place-items: center;
  border-radius: 24px;
  background: linear-gradient(135deg, #e1f5ef, #edf4fd);
  font-size: 3.5rem;
}

.workout-modal > p,
.tutorial-modal > p {
  color: var(--ion-color-medium);
  line-height: 1.6;
}

.live-estimate {
  display: flex;
  justify-content: space-between;
  margin: 18px 0 0;
  padding: 16px 0;
  border-top: 1px solid var(--ion-color-step-150, #e5e8eb);
  font-size: 0.9rem;
}

.live-estimate strong {
  color: var(--ion-color-primary);
}

.workout-modal > ion-button:first-of-type {
  margin-top: 24px;
}

.tutorial-thumbnail {
  position: relative;
  display: grid;
  min-height: 220px;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, #def4eb, #dfeafd);
  font-size: 5rem;
}

.tutorial-thumbnail small {
  position: absolute;
  right: 14px;
  bottom: 12px;
  color: var(--ion-color-dark);
  font-size: 0.75rem;
}

.thumbnail-play {
  width: 48px;
  height: 48px;
  font-size: 1rem;
}

.tutorial-modal h2 {
  margin-top: 22px;
}

@media (max-width: 960px) {
  .workout-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card ion-card-content {
    min-height: 140px;
  }

  .preferences-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .dashboard {
    padding: 20px 15px 42px;
  }

  .welcome {
    align-items: flex-start;
    flex-direction: column;
    min-height: 0;
    padding: 25px 22px;
    border-radius: 20px;
  }

  .welcome::after {
    right: -78px;
    bottom: -110px;
  }

  .welcome .date-chip {
    align-self: flex-start;
  }

  .date-chip {
    font-size: 0.68rem;
  }

  .metric-grid {
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }

  .metric-card ion-card-content {
    padding: 14px;
  }

  .metric-label {
    align-items: flex-start;
    font-size: 0.76rem;
  }

  .metric-label ion-icon {
    flex-shrink: 0;
  }

  .metric-value {
    font-size: 1.45rem;
  }

  .intake-edit {
    align-items: center;
    gap: 6px;
  }

  .intake-edit ion-input {
    min-width: 0;
  }

  .preferences-card ion-card-content {
    padding: 13px;
  }

  .preferences-grid,
  .workout-grid {
    grid-template-columns: 1fr;
  }

  .preferences-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .exercise-art {
    min-height: 110px;
  }
}
</style>
