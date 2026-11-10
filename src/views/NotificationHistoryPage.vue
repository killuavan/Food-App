<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="notification-page">
        <header class="page-hero">
          <div>
            <h1>Notification history</h1>
          </div>
          <div class="header-actions">
            <ion-button fill="clear" @click="router.back()">Back</ion-button>
            <ion-button fill="outline" router-link="/notifications">Email settings</ion-button>
          </div>
        </header>

        <section class="filters" aria-label="Filter notification history">
          <ion-item>
            <ion-label position="stacked">Type</ion-label>
            <ion-select v-model="type" interface="popover">
              <ion-select-option value="ALL">All notification types</ion-select-option>
              <ion-select-option v-for="value in notificationTypes" :key="value" :value="value">
                {{ typeLabel(value) }}
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">From</ion-label>
            <ion-input v-model="fromDate" type="date" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">To</ion-label>
            <ion-input v-model="toDate" type="date" />
          </ion-item>
          <ion-button :disabled="loading" @click="loadHistory">Apply filters</ion-button>
        </section>

        <ion-progress-bar v-if="loading" type="indeterminate" />
        <ion-card v-if="errorMessage" color="danger"><ion-card-content role="alert">{{ errorMessage }}</ion-card-content></ion-card>
        <section v-if="!user && !loading" class="empty-state">
          <h2>Sign in to view your history</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>
        <ion-list v-else-if="user && entries.length" class="history-list">
          <ion-item v-for="entry in entries" :key="entry.id">
            <ion-icon :icon="notificationsOutline" slot="start" color="success" />
            <ion-label>
              <h2>{{ entry.title }}</h2>
              <p>{{ entry.summary }}</p>
              <p>{{ formatDate(entry.created_at) }}</p>
            </ion-label>
            <ion-badge :color="entry.status === 'SENT' ? 'success' : entry.status === 'FAILED' ? 'danger' : 'medium'">
              {{ entry.status }}
            </ion-badge>
          </ion-item>
        </ion-list>
        <section v-else-if="user && !loading" class="empty-state">
          <h2>No notifications found</h2>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonInput,
  IonItem, IonLabel, IonList, IonPage, IonProgressBar, IonSelect, IonSelectOption,
} from '@ionic/vue';
import { notificationsOutline } from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import { observeAuth, type AuthenticatedUser } from '../services/authService';
import {
  listNotificationHistory,
  notificationTypes,
  type NotificationHistoryEntry,
  type NotificationType,
} from '../services/notificationService';

const route = useRoute();
const router = useRouter();
const user = ref<AuthenticatedUser | null>(null);
const entries = ref<NotificationHistoryEntry[]>([]);
const type = ref<NotificationType | 'ALL'>('ALL');
const fromDate = ref('');
const toDate = ref('');
const loading = ref(false);
const errorMessage = ref('');
let activeLoad = 0;
let unsubscribe: (() => void) | undefined;
onMounted(() => {
  unsubscribe = observeAuth((nextUser) => {
    user.value = nextUser;
    if (nextUser) void loadHistory();
    else entries.value = [];
  }, (error) => { errorMessage.value = error.message; });
});
onUnmounted(() => unsubscribe?.());
watch(() => route.fullPath, () => { if (user.value) void loadHistory(); });

async function loadHistory(): Promise<void> {
  if (!user.value) return;
  const loadId = ++activeLoad;
  loading.value = true;
  errorMessage.value = '';
  try {
    entries.value = await listNotificationHistory(user.value.id, {
      type: type.value,
      fromDate: fromDate.value,
      toDate: toDate.value,
    });
  } catch (error) {
    if (loadId === activeLoad) errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (loadId === activeLoad) loading.value = false;
  }
}

function typeLabel(value: NotificationType): string {
  return ({
    FOOD_EXPIRING: 'Food expiring',
    FOOD_EXPIRED: 'Food expired',
    LOW_STOCK: 'Low stock',
    OUT_OF_STOCK: 'Out of stock',
    GROCERY_REMINDER: 'Grocery reminder',
  })[value];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}
</script>

<style scoped>
.notification-page { width: min(940px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 90px; color: var(--app-text); }
.page-hero { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 24px; }
.header-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.eyebrow { color: #2e7d32; font-size: .72rem; font-weight: 800; letter-spacing: .12em; }
h1 { margin: 4px 0 8px; font-size: clamp(1.8rem, 5vw, 2.5rem); }
.page-hero p:last-child { color: #65736b; }
.filters { display: grid; grid-template-columns: repeat(3, 1fr) auto; align-items: end; gap: 8px; margin-bottom: 18px; }
.history-list { overflow: hidden; border: 1px solid var(--app-border); border-radius: 16px; }
.empty-state { padding: 42px 12px; text-align: center; color: #65736b; }
@media (max-width: 700px) { .page-hero { align-items: flex-start; flex-direction: column; } .filters { grid-template-columns: 1fr 1fr; } }
</style>

<script lang="ts">
export default { name: 'NotificationHistoryPage' };
</script>
