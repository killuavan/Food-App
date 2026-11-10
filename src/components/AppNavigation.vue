<template>
  <ion-header class="app-header">
    <ion-toolbar class="main-toolbar">
      <router-link to="/home" class="brand" slot="start" aria-label="Pantry and Plate home">
        <span class="brand-mark"><img :src="brandMark" alt="" /></span>
        <span class="brand-copy">
          <strong>Pantry<span>&amp;</span>Plate</strong>
          <small>Food, thoughtfully managed</small>
        </span>
      </router-link>

      <nav class="desktop-navigation" aria-label="Main navigation">
        <ion-button
          v-for="item in desktopLinks"
          :key="item.route"
          :router-link="item.route"
          fill="clear"
          :class="{ 'nav-active': isActive(item.route) }"
          :aria-current="isActive(item.route) ? 'page' : undefined"
        >
          <ion-icon slot="start" :icon="item.icon" />
          {{ item.label }}
        </ion-button>
      </nav>

      <div class="account-actions" slot="end">
        <ion-button
          v-if="!authenticatedUser && authStateReady && route.path !== '/sign-in'"
          class="account-button sign-in-button"
          router-link="/sign-in"
          fill="solid"
        >
          <ion-icon slot="start" :icon="personCircleOutline" />
          <span class="account-label">Sign in</span>
        </ion-button>
      </div>
    </ion-toolbar>
  </ion-header>

  <nav class="mobile-bottom-nav" aria-label="Primary navigation">
    <router-link
      v-for="item in mobileLinks"
      :key="item.route"
      :to="item.route"
      class="bottom-nav-item"
      :class="{ 'bottom-nav-active': isActive(item.route) }"
      :aria-current="isActive(item.route) ? 'page' : undefined"
    >
      <span class="bottom-nav-icon"><ion-icon :icon="item.icon" /></span>
      <span>{{ item.label }}</span>
    </router-link>
  </nav>

  <ion-toast
    :is-open="Boolean(authStateError)"
    :message="authStateError"
    color="danger"
    :duration="3500"
    position="bottom"
  />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { IonButton, IonHeader, IonIcon, IonToast, IonToolbar } from '@ionic/vue';
import {
  analyticsOutline,
  basketOutline,
  calendarOutline,
  fitnessOutline,
  gridOutline,
  leafOutline,
  personCircleOutline,
  restaurantOutline,
} from 'ionicons/icons';
import {
  authStateError,
  authStateReady,
  authenticatedUser,
} from '../services/authService';

const route = useRoute();
const brandMark = '/images/pantry-plate-mark.svg';
const mobileLinks = [
  { route: '/home', label: 'Home', icon: gridOutline },
  { route: '/daily-nutrition', label: 'Nutrition', icon: analyticsOutline },
  { route: '/consumption', label: 'Log food', icon: restaurantOutline },
  { route: '/inventory', label: 'Inventory', icon: basketOutline },
  { route: '/expiration', label: 'Expiration', icon: calendarOutline },
  { route: '/profile', label: 'Profile', icon: personCircleOutline },
] as const;
const desktopLinks = [
  { route: '/home', label: 'Home', icon: gridOutline },
  { route: '/inventory', label: 'Inventory', icon: basketOutline },
  { route: '/consumption', label: 'Food journal', icon: restaurantOutline },
  { route: '/daily-nutrition', label: 'Nutrition', icon: analyticsOutline },
  { route: '/macronutrients', label: 'Macros', icon: leafOutline },
  { route: '/micronutrients', label: 'Micros', icon: leafOutline },
  { route: '/nutrition', label: 'USDA search', icon: analyticsOutline },
  { route: '/weekly-nutrition', label: 'Meal plan', icon: calendarOutline },
  { route: '/expiration', label: 'Expiration', icon: calendarOutline },
  { route: '/exercise', label: 'Exercise', icon: fitnessOutline },
] as const;

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<style scoped>
.app-header { border-bottom: 1px solid var(--app-border); background: var(--app-card); box-shadow: 0 3px 14px rgb(28 65 48 / 4%); }
.main-toolbar { --background: var(--app-card); --color: var(--app-text); --min-height: 68px; --padding-start: max(16px, calc((100vw - 1200px) / 2)); --padding-end: max(12px, calc((100vw - 1200px) / 2)); }
.brand { display: flex; align-items: center; gap: 9px; color: inherit; text-decoration: none; }
.brand-mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 13px; overflow: hidden; }
.brand-mark img { width: 100%; height: 100%; }
.brand-copy { display: grid; gap: 1px; }
.brand-copy strong { color: #1f2937; font-size: .99rem; letter-spacing: -.03em; }
.brand-copy strong span { color: #2e7d32; }
.brand-copy small { color: #6b7280; font-size: .62rem; }
.desktop-navigation { display: none; align-items: center; justify-content: center; gap: 1px; margin: 0 10px; }
.desktop-navigation ion-button { --color: #526158; --padding-start: 8px; --padding-end: 8px; min-height: 38px; font-size: .68rem; text-transform: none; }
.desktop-navigation ion-button.nav-active { --color: #1b5e20; --background: #e8f5e9; --border-radius: 9px; font-weight: 700; }
.account-actions { display: flex; align-items: center; }
.account-button { --color: #506056; --padding-start: 7px; --padding-end: 7px; font-size: .72rem; text-transform: none; }
.sign-in-button { --background: #2e7d32; --border-radius: 10px; --color: #fff; }
.mobile-bottom-nav { position: fixed; z-index: 20; right: 0; bottom: 0; left: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 2px; padding: 7px 6px max(7px, env(safe-area-inset-bottom)); border-top: 1px solid var(--app-border); background: var(--app-card); box-shadow: 0 -5px 18px rgb(22 55 43 / 7%); }
.bottom-nav-item { display: grid; min-width: 0; min-height: 50px; justify-items: center; align-content: center; gap: 2px; border-radius: 13px; color: #727d76; font-size: .58rem; font-weight: 600; line-height: 1.1; text-align: center; text-decoration: none; -webkit-tap-highlight-color: transparent; }
.bottom-nav-icon { display: grid; width: 34px; height: 26px; place-items: center; border-radius: 999px; font-size: 1.08rem; transition: background .15s ease; }
.bottom-nav-active { color: #1b5e20; }
.bottom-nav-active .bottom-nav-icon { background: #e8f5e9; }
@media (min-width: 1100px) {
  .desktop-navigation { display: flex; }
  .mobile-bottom-nav { display: none; }
}
@media (max-width: 420px) {
  .main-toolbar { --min-height: 62px; --padding-start: 12px; --padding-end: 9px; }
  .brand-mark { width: 35px; height: 35px; }
  .brand-copy small { display: none; }
  .account-label { display: none; }
}
</style>
