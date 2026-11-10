<template>
  <ion-page>
    <AppNavigation />
    <ion-content class="profile-content">
      <main class="health-page">
        <header class="health-hero">
          <h1>{{ hasSavedProfile ? 'Health profile' : 'Set up your health profile' }}</h1>
        </header>

        <ion-progress-bar v-if="loading || saving" type="indeterminate" />
        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>

        <section v-if="user" id="health-profile-form" class="account-details-section">
          <header class="health-details-heading">
            <ion-button fill="clear" class="back-to-profile" router-link="/profile">
              Back to profile
            </ion-button>
          </header>

          <form class="profile-form" @submit.prevent="saveAndContinue">
          <ion-card class="form-card measurements-card">
            <ion-card-content>
              <p class="section-label">PROFILE SETUP</p>
              <h2>Measurements and activity</h2>
              <p class="section-help">Measurements are used for BMI screening.</p>

              <ion-item>
                <ion-input
                  v-model="draft.dateOfBirth"
                  type="date"
                  label="Date of birth (optional)"
                  label-placement="stacked"
                  :max="today"
                  :disabled="saving"
                  @ionInput="clearAge"
                />
              </ion-item>
              <p v-if="errors.dateOfBirth" class="field-error">{{ errors.dateOfBirth }}</p>
              <ion-note>Enter a birth date or age for BMI screening context.</ion-note>

              <ion-item>
                <ion-input
                  :value="ageInput"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  max="120"
                  step="1"
                  label="Age in years (optional alternative)"
                  label-placement="stacked"
                  :disabled="saving"
                  @ionInput="updateAge"
                />
              </ion-item>
              <p v-if="errors.age" class="field-error">{{ errors.age }}</p>

              <div class="field-grid">
                <div>
                  <ion-item>
                    <ion-input
                      :value="draft.heightCm ?? ''"
                      type="number"
                      inputmode="decimal"
                      min="30"
                      max="250"
                      step="any"
                      label="Height (cm)"
                      label-placement="stacked"
                      :disabled="saving"
                      @ionInput="updateNumber('heightCm', $event)"
                    />
                  </ion-item>
                  <p v-if="errors.heightCm" class="field-error">{{ errors.heightCm }}</p>
                </div>
                <div>
                  <ion-item>
                    <ion-input
                      :value="draft.weightKg ?? ''"
                      type="number"
                      inputmode="decimal"
                      min="0.1"
                      max="500"
                      step="any"
                      label="Weight (kg)"
                      label-placement="stacked"
                      :disabled="saving"
                      @ionInput="updateNumber('weightKg', $event)"
                    />
                  </ion-item>
                  <p v-if="errors.weightKg" class="field-error">{{ errors.weightKg }}</p>
                </div>
              </div>

              <ion-item>
                <ion-select
                  v-model="draft.activityLevel"
                  label="Activity level (optional)"
                  interface="popover"
                  :disabled="saving"
                >
                  <ion-select-option value="">Prefer not to say</ion-select-option>
                  <ion-select-option v-for="level in activityLevels" :key="level" :value="level">{{ level }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-note>Activity level does not set calorie targets.</ion-note>
              <p v-if="errors.activityLevel" class="field-error">{{ errors.activityLevel }}</p>
            </ion-card-content>
          </ion-card>

          <ion-card class="form-card preferences-card">
            <ion-card-content>
              <p class="section-label">OPTIONAL DETAILS</p>
              <h2>Food and personal preferences</h2>
              <p class="section-help">Used for meal preferences. Avoid sensitive medical details.</p>

              <ion-item>
                <ion-textarea
                  v-model="draft.dietaryPreferences"
                  label="Dietary preferences"
                  label-placement="stacked"
                  placeholder="For example, vegetarian or halal"
                  :maxlength="300"
                  auto-grow
                  :disabled="saving"
                />
              </ion-item>
              <p v-if="errors.dietaryPreferences" class="field-error">{{ errors.dietaryPreferences }}</p>
              <ion-item>
                <ion-textarea
                  v-model="draft.foodAllergies"
                  label="Food allergies"
                  label-placement="stacked"
                  placeholder="Optional"
                  :maxlength="300"
                  auto-grow
                  :disabled="saving"
                />
              </ion-item>
              <p v-if="errors.foodAllergies" class="field-error">{{ errors.foodAllergies }}</p>
              <ion-item>
                <ion-textarea
                  v-model="draft.fitnessGoal"
                  label="Fitness goal"
                  label-placement="stacked"
                  placeholder="Optional, for example, maintain an active routine"
                  :maxlength="300"
                  auto-grow
                  :disabled="saving"
                />
              </ion-item>
              <p v-if="errors.fitnessGoal" class="field-error">{{ errors.fitnessGoal }}</p>
            </ion-card-content>
          </ion-card>

          <ion-card class="bmi-card">
            <ion-card-content>
              <p class="section-label">BMI RESULT</p>
              <h2 v-if="bmiResult">{{ bmiResult.value.toFixed(2) }}</h2>
              <p v-else class="bmi-placeholder">Enter height and weight to calculate BMI.</p>
              <p v-if="bmiResult?.category" class="bmi-category">{{ bmiResult.category }} · Adult screening category</p>
              <p v-if="bmiResult" class="bmi-explanation">{{ bmiResult.explanation }}</p>
              <p v-if="bmiResult" class="bmi-date">Calculated {{ bmiCalculationDate }} · Height in cm, weight in kg</p>
              <p class="bmi-disclaimer">BMI is a screening estimate, not a diagnosis.</p>
            </ion-card-content>
          </ion-card>

          <p v-if="!profileCompleted" class="completion-note">
            Add age or birth date, height, weight, and activity level to complete your profile. You can also skip.
          </p>
          <div class="form-actions">
            <ion-button expand="block" type="submit" :disabled="saving || loading">
              <ion-spinner v-if="saving" name="crescent" />
              <span>{{ saving ? 'Saving…' : 'Save and continue' }}</span>
            </ion-button>
            <ion-button fill="outline" expand="block" :disabled="saving || loading" @click="skipForNow">
              Skip for now
            </ion-button>
            <ion-button v-if="hasSavedProfile" fill="clear" color="danger" :disabled="saving || loading" @click="deleteAlertOpen = true">
              Delete health profile
            </ion-button>
          </div>
          </form>
        </section>

        <ion-alert
          :is-open="deleteAlertOpen"
          header="Delete health profile?"
          message="This permanently removes the health information saved to your account. Onboarding will be shown again the next time you enter the main app."
          :buttons="deleteButtons"
          @didDismiss="deleteAlertOpen = false"
        />
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { AuthenticatedUser as User } from '../services/authService';
import { useRoute, useRouter } from 'vue-router';
import AppNavigation from '../components/AppNavigation.vue';
import {
  IonAlert,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonInput,
  IonItem,
  IonNote,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
} from '@ionic/vue';
import { observeAuth } from '../services/authService';
import {
  deleteHealthProfile,
  getHealthProfile,
  saveHealthProfile,
  skipHealthOnboarding,
} from '../services/healthProfileService';
import {
  activityLevels,
  calculateAge,
  calculateBmi,
  emptyHealthProfileDraft,
  isHealthProfileComplete,
  validateHealthProfileDraft,
  type HealthProfile,
  type HealthProfileDraft,
} from '../utils/healthProfile';

const route = useRoute();
const router = useRouter();
const user = ref<User | null>(null);
const storedProfile = ref<HealthProfile | null>(null);
const draft = ref<HealthProfileDraft>(emptyHealthProfileDraft());
const ageInput = ref('');
const errors = ref<Partial<Record<keyof HealthProfileDraft, string>>>({});
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const deleteAlertOpen = ref(false);
let unsubscribe: (() => void) | undefined;
let loadSequence = 0;
const today = localDate(new Date());
const hasSavedProfile = computed(() => storedProfile.value !== null);
const resolvedAge = computed(() => draft.value.dateOfBirth
  ? calculateAge(draft.value.dateOfBirth)
  : draft.value.age);
const bmiResult = computed(() => calculateBmi(
  draft.value.heightCm,
  draft.value.weightKg,
  resolvedAge.value,
));
const bmiCalculationDate = computed(() => {
  const profile = storedProfile.value;
  const unchanged = profile !== null
    && profile.bmiValue === bmiResult.value?.value
    && profile.dateOfBirth === draft.value.dateOfBirth
    && profile.age === draft.value.age
    && profile.heightCm === draft.value.heightCm
    && profile.weightKg === draft.value.weightKg;
  const date = unchanged && profile?.bmiCalculatedAt
    ? new Date(profile.bmiCalculatedAt)
    : new Date();
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
});
const profileCompleted = computed(() => isHealthProfileComplete(draft.value));
const deleteButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Delete profile', role: 'destructive', handler: () => { void removeProfile(); } },
];

function localDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

onMounted(() => {
  if (route.query.profileError === 'load') {
    errorMessage.value = 'Your health profile could not be checked. Retry loading before continuing.';
  }
  unsubscribe = observeAuth((authenticatedUser) => {
    loadSequence += 1;
    user.value = authenticatedUser;
    storedProfile.value = null;
    draft.value = emptyHealthProfileDraft();
    ageInput.value = '';
    if (authenticatedUser) void loadProfile(authenticatedUser.uid);
    else {
      storedProfile.value = null;
      loading.value = false;
    }
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });
});

onUnmounted(() => unsubscribe?.());

async function loadProfile(userId: string): Promise<void> {
  const sequence = ++loadSequence;
  loading.value = true;
  errorMessage.value = '';
  try {
    const profile = await getHealthProfile(userId);
    if (sequence !== loadSequence || user.value?.uid !== userId) return;
    storedProfile.value = profile;
    if (profile) {
      draft.value = {
        dateOfBirth: profile.dateOfBirth,
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel,
        dietaryPreferences: profile.dietaryPreferences,
        foodAllergies: profile.foodAllergies,
        fitnessGoal: profile.fitnessGoal,
      };
      ageInput.value = profile.age === null ? '' : String(profile.age);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

function clearAge(): void {
  if (!draft.value.dateOfBirth) return;
  draft.value.age = null;
  ageInput.value = '';
  delete errors.value.age;
}

function updateAge(event: CustomEvent<{ value?: string | null }>): void {
  const value = event.detail.value?.trim() ?? '';
  ageInput.value = value;
  draft.value.age = value === '' ? null : Number(value);
  if (value) draft.value.dateOfBirth = '';
  delete errors.value.age;
  delete errors.value.dateOfBirth;
}

function updateNumber(
  field: 'heightCm' | 'weightKg',
  event: CustomEvent<{ value?: string | null }>,
): void {
  const value = event.detail.value?.trim() ?? '';
  draft.value[field] = value === '' ? null : Number(value);
  delete errors.value[field];
}

async function saveAndContinue(): Promise<void> {
  const authenticatedUser = user.value;
  if (!authenticatedUser || saving.value) return;
  errors.value = validateHealthProfileDraft(draft.value);
  if (Object.keys(errors.value).length) return;

  saving.value = true;
  errorMessage.value = '';
  try {
    await saveHealthProfile(authenticatedUser.uid, draft.value);
    await router.replace('/home');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

async function skipForNow(): Promise<void> {
  const authenticatedUser = user.value;
  if (!authenticatedUser || saving.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await skipHealthOnboarding(authenticatedUser.uid);
    await router.replace('/home');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

async function removeProfile(): Promise<void> {
  const authenticatedUser = user.value;
  if (!authenticatedUser || saving.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await deleteHealthProfile(authenticatedUser.uid);
    storedProfile.value = null;
    draft.value = emptyHealthProfileDraft();
    ageInput.value = '';
    await router.replace('/home');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

</script>

<style scoped>
.profile-content { --background: var(--app-bg); --color: var(--app-text); }
.health-page { width: min(920px, 100%); margin: 0 auto; padding: 24px 20px 72px; color: var(--app-text); }
.health-hero { margin-bottom: 18px; padding: 21px 22px; border: 1px solid #dce9df; border-radius: 16px; background: linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%), url('/images/food-banner.svg') center / cover no-repeat; box-shadow: 0 14px 32px rgb(25 80 61 / 13%); color: #fff; }
.eyebrow, .section-label { margin: 0; color: #2f8568; font-size: 0.69rem; font-weight: 750; letter-spacing: 0.1em; }
.health-hero .eyebrow { color: #bcebd0; }
.health-hero h1 { margin: 7px 0; font-size: clamp(1.7rem, 5vw, 2.2rem); }
.health-hero p:last-child { margin: 0; color: #b7b7b7; line-height: 1.5; }
.health-details-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; scroll-margin-top: 20px; margin: 0 0 14px; }
.health-details-heading h2 { margin: 5px 0; color: var(--app-text); font-size: 1.25rem; }
.health-details-heading > p:last-child { margin: 0; color: var(--app-muted); font-size: .85rem; }
.back-to-profile { flex: 0 0 auto; margin: 0; --color: var(--app-green); font-size: .78rem; }
.account-details-section { padding: 18px; border: 1px solid var(--app-border); border-radius: 18px; background: var(--app-card); box-shadow: 0 5px 18px rgb(22 55 43 / 4%); }
.profile-form { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 14px; }
.bmi-card, .completion-note, .form-actions { grid-column: 1 / -1; }
.measurements-card, .preferences-card { grid-column: 1; }
.form-card, .bmi-card { margin: 0; border: 1px solid #e4ece6; border-radius: 15px; background: var(--app-card); box-shadow: 0 5px 16px rgb(28 65 48 / 4%); color: var(--app-text); }
.form-card ion-card-content, .bmi-card ion-card-content { display: grid; gap: 9px; padding: 18px; }
.form-card h2 { margin: 0; color: #244737; font-size: 1.1rem; }
.section-help { margin: 0 0 4px; color: #77857c; font-size: 0.82rem; line-height: 1.5; }
.form-card ion-item { --background: #f7f9f7; --color: #23342d; --border-color: #e4ece6; --border-radius: 10px; }
.form-card ion-input, .form-card ion-textarea, .form-card ion-select { --color: #23342d; --placeholder-color: #77857c; }
.form-card ion-note { padding: 0 10px; color: #728078; font-size: 0.72rem; line-height: 1.4; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.field-grid > div { min-width: 0; }
.field-error { margin: 0; padding: 0 10px; color: var(--ion-color-danger); font-size: 0.76rem; }
.bmi-card { background: #f6faf6; }
.bmi-card h2 { margin: 0; color: #244737; font-size: 2rem; }
.bmi-category { margin: 0; color: #2c795b; font-weight: 700; }
.bmi-explanation, .bmi-date, .bmi-disclaimer, .bmi-placeholder { margin: 0; color: #65756a; font-size: 0.82rem; line-height: 1.5; }
.bmi-disclaimer { padding-top: 8px; border-top: 1px solid #e1ebe3; }
.completion-note { margin: 0; color: #77857c; font-size: 0.78rem; line-height: 1.45; }
.form-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.form-actions ion-button { --border-radius: 11px; --color: #2e7d32; }
.form-actions ion-button[type="submit"] { --background: #2e7d32; --color: #fff; }
.form-actions ion-button[type="submit"] { min-width: 190px; }
.error-card { border: 1px solid #f1d3cd; border-radius: 12px; box-shadow: none; color: #943e33; }

@media (max-width: 760px) {
  .health-page { padding: 16px 12px 36px; }
  .health-hero { padding: 18px; }
  .account-details-section { padding: 14px; }
  .profile-form { gap: 12px; }
  .measurements-card, .preferences-card, .bmi-card, .completion-note, .form-actions { grid-column: 1; }
  .field-grid { grid-template-columns: 1fr; }
  .form-actions { display: grid; }
}
@media (max-width: 380px) { .health-details-heading { flex-direction: column; } }
</style>
