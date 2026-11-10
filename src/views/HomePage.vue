<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="dashboard-page">
        <header class="dashboard-hero">
          <div>
            <h1>Your dashboard</h1>
          </div>
          <span class="today-chip">{{ todayLabel }}</span>
        </header>

        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>

        <section class="activity-section" aria-labelledby="activity-heading">
          <div class="section-title">
            <div>
              <h2 id="activity-heading">Today's activity</h2>
            </div>
            <ion-button fill="clear" router-link="/exercise">
              View exercise details
              <ion-icon slot="end" :icon="arrowForwardOutline" />
            </ion-button>
          </div>

          <div class="activity-grid">
            <ion-card class="activity-card">
              <ion-card-content>
                <span class="metric-icon time-icon"><ion-icon :icon="timeOutline" /></span>
                <div class="metric-copy">
                  <span>Workout duration</span>
                  <strong>{{ todayMinutes }} <small>min</small></strong>
                </div>
              </ion-card-content>
            </ion-card>
            <ion-card class="activity-card">
              <ion-card-content>
                <span class="metric-icon energy-icon"><ion-icon :icon="flameOutline" /></span>
                <div class="metric-copy">
                  <span>Exercise energy</span>
                  <strong>{{ todayCalories }} <small>kcal est.</small></strong>
                </div>
              </ion-card-content>
            </ion-card>
            <ion-card class="activity-card">
              <ion-card-content>
                <span class="metric-icon sessions-icon"><ion-icon :icon="checkmarkDoneOutline" /></span>
                <div class="metric-copy">
                  <span>Completed sessions</span>
                  <strong>{{ todayWorkouts.length }} <small>today</small></strong>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
        </section>

        <section class="modules-section" aria-labelledby="modules-heading">
          <div class="section-title">
            <div>
              <h2 id="modules-heading">Choose where to go</h2>
            </div>
          </div>

          <div class="module-grid">
            <ion-card class="module-card inventory-module">
              <ion-card-content>
                <div class="module-art inventory-art" aria-hidden="true">
                  <ion-icon :icon="basketOutline" />
                  <span>🥬</span>
                </div>
                <h3>Food inventory</h3>
                <ion-button expand="block" router-link="/inventory">
                  Open food inventory
                  <ion-icon slot="end" :icon="arrowForwardOutline" />
                </ion-button>
              </ion-card-content>
            </ion-card>

            <ion-card class="module-card consumption-module">
              <ion-card-content>
                <div class="module-art consumption-art" aria-hidden="true">
                  <ion-icon :icon="restaurantOutline" />
                  <span>🥣</span>
                </div>
                <h3>Food consumption</h3>
                <ion-button expand="block" fill="outline" router-link="/consumption">
                  Open food journal
                  <ion-icon slot="end" :icon="arrowForwardOutline" />
                </ion-button>
              </ion-card-content>
            </ion-card>

            <ion-card class="module-card nutrition-module">
              <ion-card-content>
                <div class="module-art nutrition-art" aria-hidden="true">
                  <ion-icon :icon="leafOutline" />
                  <span>🥑</span>
                </div>
                <h3>Food nutrition</h3>
                <ion-button expand="block" fill="outline" router-link="/nutrition">
                  Search food nutrition
                  <ion-icon slot="end" :icon="arrowForwardOutline" />
                </ion-button>
              </ion-card-content>
            </ion-card>

            <ion-card class="module-card nutrition-module">
              <ion-card-content>
                <div class="module-art nutrition-art" aria-hidden="true">
                  <ion-icon :icon="leafOutline" />
                  <span>🥗</span>
                </div>
                <h3>Weekly nutrition plan</h3>
                <ion-button expand="block" fill="outline" router-link="/weekly-nutrition">
                  Open weekly plan
                  <ion-icon slot="end" :icon="arrowForwardOutline" />
                </ion-button>
              </ion-card-content>
            </ion-card>

            <ion-card class="module-card exercise-module">
              <ion-card-content>
                <div class="module-art exercise-art" aria-hidden="true">
                  <ion-icon :icon="fitnessOutline" />
                  <span>🏃</span>
                </div>
                <h3>Exercise &amp; movement</h3>
                <ion-button expand="block" fill="outline" router-link="/exercise">
                  Open exercise page
                  <ion-icon slot="end" :icon="arrowForwardOutline" />
                </ion-button>
              </ion-card-content>
            </ion-card>
          </div>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppNavigation from '../components/AppNavigation.vue';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonPage,
} from '@ionic/vue';
import {
  arrowForwardOutline,
  basketOutline,
  checkmarkDoneOutline,
  fitnessOutline,
  flameOutline,
  leafOutline,
  restaurantOutline,
  timeOutline,
} from 'ionicons/icons';
import { getWorkoutHistory, type WorkoutLog } from '../services/exerciseService';

const workoutHistory = ref<WorkoutLog[]>([]);
const errorMessage = ref('');
const todayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date());

const todayWorkouts = computed(() => workoutHistory.value.filter((workout) => {
  const date = new Date(workout.workoutDate);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}));
const todayMinutes = computed(() => todayWorkouts.value.reduce((sum, workout) => sum + workout.durationMinutes, 0));
const todayCalories = computed(() => todayWorkouts.value.reduce((sum, workout) => sum + workout.estimatedCalories, 0));

onMounted(() => {
  try {
    workoutHistory.value = getWorkoutHistory();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
});
</script>

<style scoped>
.dashboard-page {
  width: min(1080px, 100%);
  margin: 0 auto;
  padding: 30px 26px 58px;
}

.dashboard-hero {
  display: flex;
  min-height: 154px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 34px;
  padding: 28px 32px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 85% 15%, rgb(172 223 185 / 23%), transparent 28%),
    linear-gradient(115deg, #123f35, #23785f 70%, #398670);
  box-shadow: 0 14px 32px rgb(25 80 61 / 13%);
  color: #fff;
}

.eyebrow {
  margin: 0;
  color: #398670;
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.11em;
}

.dashboard-hero .eyebrow {
  color: #bcebd0;
}

.dashboard-hero h1 {
  margin: 7px 0;
  font-size: clamp(1.9rem, 4vw, 2.5rem);
  letter-spacing: -0.04em;
}

.dashboard-hero p:last-child {
  margin: 0;
  color: rgb(255 255 255 / 82%);
  line-height: 1.5;
}

.today-chip {
  flex-shrink: 0;
  padding: 9px 13px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 999px;
  background: rgb(255 255 255 / 12%);
  color: #fff;
  font-size: 0.78rem;
}

.section-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title h2 {
  margin: 5px 0 0;
  color: #20352d;
  font-size: 1.35rem;
  letter-spacing: -0.025em;
}

.section-title ion-button {
  --color: #287354;
  font-size: 0.82rem;
  font-weight: 650;
  text-transform: none;
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.activity-card,
.module-card {
  margin: 0;
  border: 1px solid #e5ece7;
  border-radius: 17px;
  background: #fff;
  box-shadow: 0 5px 18px rgb(22 55 43 / 5%);
}

.activity-card ion-card-content {
  display: flex;
  min-height: 112px;
  align-items: center;
  gap: 14px;
  padding: 18px;
}

.metric-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 14px;
  font-size: 1.25rem;
}

.time-icon {
  background: #eaf2ff;
  color: #5573b4;
}

.energy-icon {
  background: #fff3e7;
  color: #c47a35;
}

.sessions-icon {
  background: #e9f6ee;
  color: #32805a;
}

.metric-copy {
  display: grid;
  gap: 6px;
}

.metric-copy > span {
  color: #748078;
  font-size: 0.8rem;
}

.metric-copy strong {
  color: #183e32;
  font-size: 1.65rem;
  line-height: 1;
}

.metric-copy small {
  color: #77857c;
  font-size: 0.72rem;
  font-weight: 500;
}

.modules-section {
  margin-top: 38px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.module-card ion-card-content {
  padding: 20px;
}

.module-art {
  display: flex;
  min-height: 105px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 14px;
  font-size: 2.5rem;
}

.module-art ion-icon {
  font-size: 2.2rem;
}

.inventory-art {
  background: linear-gradient(120deg, #e8f4eb, #f2f7e9);
  color: #3a8058;
}

.exercise-art {
  background: linear-gradient(120deg, #e8f0fb, #f1eefb);
  color: #607bb8;
}

.consumption-art {
  background: linear-gradient(120deg, #fff1e5, #fff7e8);
  color: #b77942;
}

.nutrition-art {
  background: linear-gradient(120deg, #e8f5ed, #edf8e6);
  color: #39845c;
}

.module-kicker {
  margin: 17px 0 5px;
  color: #47896d;
  font-size: 0.66rem;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.module-card h3 {
  margin: 0;
  color: #20352d;
  font-size: 1.18rem;
}

.module-description {
  min-height: 46px;
  margin: 8px 0 16px;
  color: #718077;
  font-size: 0.86rem;
  line-height: 1.55;
}

.module-card ion-button {
  --border-radius: 11px;
  --box-shadow: none;
  text-transform: none;
}

.error-card {
  margin: 0 0 22px;
  border: 1px solid var(--ion-color-danger);
  color: var(--ion-color-danger);
}

@media (max-width: 720px) {
  .dashboard-page {
    padding: 22px 16px 42px;
  }

  .dashboard-hero {
    min-height: 140px;
    align-items: flex-start;
    flex-direction: column;
    padding: 23px;
  }

  .module-grid {
    grid-template-columns: 1fr;
  }

  .module-description {
    min-height: 0;
  }
}

@media (max-width: 480px) {
  .activity-grid {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .activity-card ion-card-content {
    min-height: 85px;
  }

  .section-title {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
