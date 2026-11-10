<template>
  <ion-alert
    :is-open="alertOpen"
    header="Food expiration reminder"
    :message="alertMessage"
    :buttons="alertButtons"
    @didDismiss="alertOpen = false"
  />
  <ion-toast
    :is-open="Boolean(errorMessage)"
    :message="errorMessage"
    color="danger"
    :duration="5000"
    position="bottom"
    @didDismiss="errorMessage = ''"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { App as CapacitorApp } from '@capacitor/app';
import { IonAlert, IonToast } from '@ionic/vue';
import { observeAuth } from '../services/authService';
import {
  getExpirationWarningDays,
  hasShownExpirationAlertToday,
  markExpirationAlertShownToday,
} from '../services/foodExpirationService';
import {
  foodInventoryUpdatedEventName,
  listFoodItems,
} from '../services/foodInventoryService';
import { getCurrentExpirationWarnings } from '../utils/foodExpiration';

const router = useRouter();
const alertOpen = ref(false);
const alertMessage = ref('');
const errorMessage = ref('');
let activeUserId: string | null = null;
let isChecking = false;
let queuedUserId: string | null = null;
let unsubscribeAuth: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;
const alertButtons = [
  { text: 'View expiration tracking', handler: openExpirationPage },
  { text: 'Dismiss', role: 'cancel' },
];

onMounted(() => {
  unsubscribeAuth = observeAuth((user) => {
    activeUserId = user?.uid ?? null;
    if (activeUserId) void checkExpirations(activeUserId);
  }, (error) => {
    errorMessage.value = error.message;
  });

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener(foodInventoryUpdatedEventName, handleInventoryUpdated);
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && activeUserId) void checkExpirations(activeUserId);
  }).then((listener) => {
    foregroundListener = listener;
  }).catch((error: unknown) => {
    errorMessage.value = `Unable to monitor app foreground state: ${error instanceof Error ? error.message : String(error)}`;
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener(foodInventoryUpdatedEventName, handleInventoryUpdated);
  void foregroundListener?.remove();
});

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible' && activeUserId) {
    void checkExpirations(activeUserId);
  }
}

function handleInventoryUpdated(event: Event): void {
  const detail = (event as CustomEvent<{ userId?: string }>).detail;
  if (detail?.userId && detail.userId === activeUserId) {
    void checkExpirations(detail.userId);
  }
}

async function checkExpirations(userId: string): Promise<void> {
  if (isChecking) {
    queuedUserId = userId;
    return;
  }
  isChecking = true;
  try {
    const [warningDays, alreadyShown] = [
      getExpirationWarningDays(userId),
      hasShownExpirationAlertToday(userId),
    ];
    const items = await listFoodItems(userId);
    if (activeUserId !== userId) return;

    const warnings = getCurrentExpirationWarnings(items, warningDays);
    if (alertOpen.value) {
      if (!warnings.length) {
        alertOpen.value = false;
      } else {
        alertMessage.value = warnings
          .slice(0, 8)
          .map(({ item, result }) => `${item.foodName}: ${result.countdown}`)
          .join('\n');
      }
    }
    if (alreadyShown) return;
    if (!warnings.length) return;

    const lines = warnings.slice(0, 8).map(({ item, result }) => `${item.foodName}: ${result.countdown}`);
    const moreCount = warnings.length - lines.length;
    if (moreCount > 0) lines.push(`and ${moreCount} more item${moreCount === 1 ? '' : 's'}`);

    markExpirationAlertShownToday(userId);
    alertMessage.value = lines.join('\n');
    alertOpen.value = true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    isChecking = false;
    const nextUserId = queuedUserId;
    queuedUserId = null;
    if (nextUserId && nextUserId === activeUserId) {
      void checkExpirations(nextUserId);
    }
  }
}

function openExpirationPage(): void {
  alertOpen.value = false;
  if (router.currentRoute.value.path !== '/expiration') {
    void router.push('/expiration');
  }
}
</script>
