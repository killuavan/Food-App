<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="notification-page">
        <header class="page-hero">
          <div>
            <h1>Notifications</h1>
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
        <template v-else-if="user">
        <ion-card class="settings-card">
          <ion-card-header>
            <ion-card-title>Device notifications</ion-card-title>
            <ion-card-subtitle>Food expiration reminders can appear while the app is closed on mobile. Browser reminders appear while the app is open.</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <p class="permission-status" :class="`permission-${devicePermission}`" role="status">
              {{ devicePermissionMessage }}
            </p>
            <ion-button
              v-if="devicePermission === 'prompt'"
              :disabled="requestingPermission || loading"
              @click="allowDeviceNotifications"
            >
              {{ requestingPermission ? 'Requesting permission…' : 'Allow notifications' }}
            </ion-button>
            <ion-button
              v-if="devicePermission === 'granted'"
              fill="outline"
              :disabled="sendingTestNotification"
              @click="sendTestNotification"
            >
              {{ sendingTestNotification ? 'Sending test…' : 'Send test notification' }}
            </ion-button>
          </ion-card-content>
        </ion-card>
        <ion-card class="settings-card">
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
        </template>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import {
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle,
  IonContent, IonInput, IonItem, IonLabel, IonPage, IonProgressBar, IonSelect,
  IonSelectOption, IonToggle, onIonViewWillEnter,
} from '@ionic/vue';
import AppNavigation from '../components/AppNavigation.vue';
import { observeAuth, type AuthenticatedUser } from '../services/authService';
import {
  defaultNotificationPreferences,
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '../services/notificationService';
import {
  getDeviceNotificationPermission,
  notifyDeviceNotificationPermissionChanged,
  requestDeviceNotificationPermission,
} from '../services/deviceNotificationPermissionService';
import { sendTestDeviceNotification } from '../services/foodExpirationNotificationService';

const user = ref<AuthenticatedUser | null>(null);
const preferences = reactive<NotificationPreferences>(defaultNotificationPreferences());
const loading = ref(true);
const saving = ref(false);
const requestingPermission = ref(false);
const sendingTestNotification = ref(false);
const devicePermission = ref<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
const error = ref(false);
const message = ref('');
const devicePermissionMessage = computed(() => {
  if (devicePermission.value === 'granted') return 'Notifications are allowed on this device.';
  if (devicePermission.value === 'denied') return 'Notifications are blocked. Allow them in your device or browser settings.';
  if (devicePermission.value === 'unsupported') return 'This device or browser does not support app notifications.';
  return 'Notifications are not enabled yet.';
});
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
      void getDeviceNotificationPermission().then((permission) => {
        if (version === requestVersion) devicePermission.value = permission;
      }).catch(showError);
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
onIonViewWillEnter(() => {
  void refreshDevicePermission();
});

async function refreshDevicePermission(): Promise<void> {
  try {
    devicePermission.value = await getDeviceNotificationPermission();
    if (devicePermission.value === 'granted') notifyDeviceNotificationPermissionChanged();
  } catch (permissionError) {
    showError(permissionError);
  }
}

async function allowDeviceNotifications(): Promise<void> {
  requestingPermission.value = true;
  error.value = false;
  message.value = '';
  try {
    devicePermission.value = await requestDeviceNotificationPermission();
    if (devicePermission.value === 'granted') {
      message.value = 'Device notifications are allowed.';
      notifyDeviceNotificationPermissionChanged();
    } else if (devicePermission.value === 'denied') {
      message.value = 'Notifications are blocked. Allow them in your device or browser settings.';
      error.value = true;
    } else if (devicePermission.value === 'unsupported') {
      message.value = 'This device or browser does not support app notifications.';
      error.value = true;
    }
  } catch (permissionError) {
    showError(permissionError);
  } finally {
    requestingPermission.value = false;
  }
}

async function sendTestNotification(): Promise<void> {
  sendingTestNotification.value = true;
  error.value = false;
  message.value = '';
  try {
    await sendTestDeviceNotification();
    message.value = 'Test notification sent. Check your notification tray.';
  } catch (testError) {
    showError(testError);
  } finally {
    sendingTestNotification.value = false;
  }
}

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
.permission-status { margin: 0 8px 12px; color: #65736b; font-size: .9rem; line-height: 1.5; }
.permission-granted { color: #24633b; }
.permission-denied { color: #943e33; }
.preference-group { margin: 22px 0 12px; }
.preference-group > h2 { margin: 0 16px 8px; font-size: 1rem; }
.timezone-help { margin: 8px 16px; color: #65736b; font-size: .82rem; }
.actions { display: flex; gap: 8px; margin: 20px 8px 4px; }
@media (max-width: 600px) { .page-hero { align-items: flex-start; flex-direction: column; } }
</style>

<script lang="ts">
export default { name: 'NotificationSettingsPage' };
</script>
