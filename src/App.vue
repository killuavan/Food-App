<template>
  <ion-app>
    <ExpirationAlertMonitor />
    <ion-router-outlet />
    <div v-if="!startupReady" class="startup-screen" role="status">
      <img :src="brandMark" alt="" />
      <strong>Pantry &amp; Plate</strong>
      <span>{{ startupError || 'Starting app…' }}</span>
      <button v-if="startupError" type="button" @click="reloadApp">Retry</button>
    </div>
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { useRouter } from 'vue-router';
import ExpirationAlertMonitor from './components/ExpirationAlertMonitor.vue';
import { initializeAuthState } from './services/authService';

const router = useRouter();
const startupReady = ref(false);
const startupError = ref('');
const brandMark = '/images/pantry-plate-mark.svg';

onMounted(() => {
  initializeAuthState();
  void router.isReady().then(() => {
    startupReady.value = true;
  }).catch((error: unknown) => {
    startupError.value = error instanceof Error
      ? 'The app could not finish starting. Check your internet connection and retry.'
      : 'The app could not finish starting. Retry.';
    console.error('App startup failed:', error);
  });
});

function reloadApp(): void {
  window.location.reload();
}
</script>

<style>
.startup-screen {
  position: fixed;
  z-index: 9999;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: #f7f8f4;
  color: #173e31;
  font: 16px system-ui, sans-serif;
  text-align: center;
}

.startup-screen img {
  width: 76px;
  height: 76px;
  border-radius: 20px;
}

.startup-screen strong {
  font-size: 22px;
}

.startup-screen button {
  margin-top: 8px;
  padding: 10px 20px;
  border: 0;
  border-radius: 10px;
  background: #2e7d32;
  color: white;
  font: inherit;
}
</style>
