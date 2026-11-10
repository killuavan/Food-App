<template>
  <ion-app>
    <ExpirationAlertMonitor />
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import ExpirationAlertMonitor from './components/ExpirationAlertMonitor.vue';
import { initializeAuthState } from './services/authService';

onMounted(initializeAuthState);
</script>
