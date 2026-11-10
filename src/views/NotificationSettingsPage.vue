<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="notification-page">
        <header class="page-hero">
          <div>
            <h1>Email notifications</h1>
          </div>
          <ion-button fill="outline" router-link="/notifications/history">Notification history</ion-button>
        </header>

        <ion-progress-bar v-if="loading || saving" type="indeterminate" />
        <ion-card v-if="message" :color="error ? 'danger' : 'success'">
          <ion-card-content role="status">{{ message }}</ion-card-content>
        </ion-card>
        <section v-if="!user && !loading" class="settings-card">
          <h2>Sign in to manage notifications</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>
        <ion-card v-else-if="user" class="settings-card">
          <ion-card-header>
            <ion-card-title>Email preferences</ion-card-title>
            <ion-card-subtitle>Alerts are evaluated hourly using your time zone and delivery schedule.</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label>
                <h2>Enable email notifications</h2>
              </ion-label>
              <ion-toggle v-model="preferences.email_enabled" aria-label="Enable email notifications" />
            </ion-item>
            <div class="preference-group">
              <h2>Food and inventory alerts</h2>
              <ion-item v-for="option in alertOptions" :key="option.key">
                <ion-label>{{ option.label }}</ion-label>
                <ion-toggle v-model="preferences[option.key]" :aria-label="option.label" />
              </ion-item>
              <ion-item>
                <ion-label>Expiration warning period</ion-label>
                <ion-select v-model.number="preferences.expiration_days" interface="popover">
                  <ion-select-option v-for="days in [1, 2, 3, 5, 7, 14]" :key="days" :value="days">
                    {{ days }} days
                  </ion-select-option>
                </ion-select>
              </ion-item>
            </div>
            <div class="preference-group">
              <h2>Grocery reminders</h2>
              <ion-item>
                <ion-label>Reminder frequency</ion-label>
                <ion-select v-model="preferences.grocery_frequency" interface="popover">
                  <ion-select-option value="DAILY">Daily</ion-select-option>
                  <ion-select-option value="WEEKLY">Weekly (Monday)</ion-select-option>
                </ion-select>
              </ion-item>
            </div>
            <ion-item>
              <ion-label position="stacked">Time zone (IANA)</ion-label>
              <ion-input v-model="preferences.time_zone" placeholder="America/Los_Angeles" />
            </ion-item>
            <p class="timezone-help">Use a time zone such as America/Los_Angeles or Europe/London.</p>
            <div class="actions">
              <ion-button :disabled="saving || loading" @click="save">Save preferences</ion-button>
              <ion-button fill="clear" router-link="/notifications/history">View history</ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import {
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle,
  IonContent, IonInput, IonItem, IonLabel, IonPage, IonProgressBar, IonSelect,
  IonSelectOption, IonToggle,
} from '@ionic/vue';
import AppNavigation from '../components/AppNavigation.vue';
import { observeAuth, type AuthenticatedUser } from '../services/authService';
import {
  defaultNotificationPreferences,
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '../services/notificationService';

const user = ref<AuthenticatedUser | null>(null);
const preferences = reactive<NotificationPreferences>(defaultNotificationPreferences());
const loading = ref(true);
const saving = ref(false);
const error = ref(false);
const message = ref('');
const alertOptions = [
  { key: 'food_expiring_enabled', label: 'Food approaching its expiration date' },
  { key: 'food_expired_enabled', label: 'Food past its expiration date' },
  { key: 'low_stock_enabled', label: 'Low-stock items' },
  { key: 'out_of_stock_enabled', label: 'Out-of-stock items' },
  { key: 'grocery_reminder_enabled', label: 'Pending grocery list reminders' },
] as const;
let requestVersion = 0;
let unsubscribe: (() => void) | undefined;
onMounted(() => {
  unsubscribe = observeAuth((nextUser) => {
    user.value = nextUser;
    const version = ++requestVersion;
    if (nextUser) {
      loading.value = true;
      void getNotificationPreferences(nextUser.id).then((saved) => {
        if (version === requestVersion) Object.assign(preferences, saved);
      }).catch(showError).finally(() => {
        if (version === requestVersion) loading.value = false;
      });
    } else {
      loading.value = false;
    }
  }, showError);
});
onUnmounted(() => unsubscribe?.());

async function save(): Promise<void> {
  if (!user.value) return;
  try {
    new Intl.DateTimeFormat('en', { timeZone: preferences.time_zone });
  } catch {
    showError(new Error('Enter a valid IANA time zone, such as America/Los_Angeles.'));
    return;
  }
  saving.value = true;
  error.value = false;
  message.value = '';
  try {
    await saveNotificationPreferences(user.value.id, { ...preferences });
    message.value = 'Notification preferences saved.';
  } catch (saveError) {
    showError(saveError);
  } finally {
    saving.value = false;
  }
}

function showError(value: unknown): void {
  error.value = true;
  message.value = value instanceof Error ? value.message : String(value);
}
</script>

<style scoped>
.notification-page { width: min(940px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 90px; color: var(--app-text); }
.page-hero { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 24px; }
.eyebrow { color: #2e7d32; font-size: .72rem; font-weight: 800; letter-spacing: .12em; }
h1 { margin: 4px 0 8px; font-size: clamp(1.8rem, 5vw, 2.5rem); }
.page-hero p:last-child { color: #65736b; }
.settings-card { border: 1px solid var(--app-border); border-radius: 18px; box-shadow: 0 8px 28px rgb(22 55 43 / 5%); }
.preference-group { margin: 22px 0 12px; }
.preference-group > h2 { margin: 0 16px 8px; font-size: 1rem; }
.timezone-help { margin: 8px 16px; color: #65736b; font-size: .82rem; }
.actions { display: flex; gap: 8px; margin: 20px 8px 4px; }
@media (max-width: 600px) { .page-hero { align-items: flex-start; flex-direction: column; } }
</style>

<script lang="ts">
export default { name: 'NotificationSettingsPage' };
</script>
