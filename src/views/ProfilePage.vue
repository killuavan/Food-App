<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="profile-page">
        <header class="profile-hero">
          <h1>Profile</h1>
        </header>

        <ion-progress-bar v-if="!authStateReady" type="indeterminate" />
        <ion-card v-if="authStateError || errorMessage" class="error-card">
          <ion-card-content role="alert">{{ authStateError || errorMessage }}</ion-card-content>
        </ion-card>

        <section v-if="user" class="profile-content">
          <ion-card class="account-card">
            <ion-card-content>
              <div class="account-avatar" aria-hidden="true">{{ accountInitial }}</div>
              <div class="account-copy">
                <strong>{{ accountName }}</strong>
                <span>{{ user.email || 'Signed-in account' }}</span>
              </div>
            </ion-card-content>
          </ion-card>

          <nav class="profile-actions" aria-label="Profile actions">
            <router-link to="/notifications/history" class="profile-action">
              <ion-icon :icon="notificationsOutline" aria-hidden="true" />
              <span>Alerts</span>
            </router-link>
            <router-link to="/notifications" class="profile-action">
              <ion-icon :icon="settingsOutline" aria-hidden="true" />
              <span>Preferences</span>
            </router-link>
            <router-link to="/health-profile" class="profile-action">
              <ion-icon :icon="personCircleOutline" aria-hidden="true" />
              <span>Health profile</span>
            </router-link>
            <button type="button" class="profile-action" :disabled="signingOut" @click="handleSignOut">
              <ion-icon :icon="logOutOutline" aria-hidden="true" />
              <span>{{ signingOut ? 'Signing out…' : 'Sign out' }}</span>
            </button>
          </nav>
        </section>

        <section v-else-if="authStateReady && !authStateError" class="sign-in-card">
          <div class="account-avatar guest-avatar" aria-hidden="true">
            <ion-icon :icon="personCircleOutline" />
          </div>
          <h2>Sign in to your profile</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>
      </main>
    </ion-content>
    <ion-toast
      :is-open="Boolean(errorMessage)"
      :message="errorMessage"
      color="danger"
      :duration="4000"
      position="bottom"
      @didDismiss="errorMessage = ''"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonPage,
  IonProgressBar,
  IonToast,
} from '@ionic/vue';
import {
  logOutOutline,
  notificationsOutline,
  personCircleOutline,
  settingsOutline,
} from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import {
  authStateError,
  authStateReady,
  observeAuth,
  signOutUser,
  type AuthenticatedUser,
} from '../services/authService';

const router = useRouter();
const user = ref<AuthenticatedUser | null>(null);
const errorMessage = ref('');
const signingOut = ref(false);
const accountName = computed(() => user.value?.displayName || user.value?.email?.split('@')[0] || 'Your account');
const accountInitial = computed(() => accountName.value.trim().charAt(0).toUpperCase() || 'U');
let unsubscribe: (() => void) | undefined;

onMounted(() => {
  unsubscribe = observeAuth((authenticatedUser) => {
    user.value = authenticatedUser;
  }, (error) => {
    errorMessage.value = error.message;
  });
});

onUnmounted(() => unsubscribe?.());

async function handleSignOut(): Promise<void> {
  if (signingOut.value) return;
  signingOut.value = true;
  errorMessage.value = '';
  try {
    await signOutUser();
    await router.replace('/sign-in');
  } catch (error) {
    errorMessage.value = `Unable to sign out: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    signingOut.value = false;
  }
}
</script>

<style scoped>
.profile-page { width: min(920px, 100%); margin: 0 auto; padding: 24px 20px 72px; color: var(--app-text); }
.profile-hero { margin-bottom: 20px; padding: 22px; border: 1px solid #dce9df; border-radius: 18px; background: linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%), url('/images/food-banner.svg') center / cover no-repeat; box-shadow: 0 14px 32px rgb(25 80 61 / 13%); color: #fff; }
.eyebrow { margin: 0; color: #bcebd0; font-size: .69rem; font-weight: 750; letter-spacing: .1em; }
.profile-hero h1 { margin: 7px 0; font-size: clamp(1.7rem, 5vw, 2.2rem); }
.profile-hero > p:last-child { margin: 0; color: rgb(255 255 255 / 84%); line-height: 1.5; }
.profile-content { display: grid; gap: 14px; }
.account-card { margin: 0; border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-card); box-shadow: 0 5px 16px rgb(28 65 48 / 4%); }
.account-card ion-card-content { display: flex; align-items: center; gap: 14px; min-height: 92px; padding: 16px; }
.account-avatar { display: grid; flex: 0 0 58px; width: 58px; height: 58px; place-items: center; border-radius: 50%; background: #e8f5e9; color: #2e7d32; font-size: 1.7rem; font-weight: 700; }
.account-copy { display: grid; min-width: 0; gap: 5px; }
.account-copy strong { overflow: hidden; color: var(--app-text); font-size: 1.2rem; text-overflow: ellipsis; white-space: nowrap; }
.account-copy span { overflow: hidden; color: var(--app-muted); font-size: .84rem; text-overflow: ellipsis; white-space: nowrap; }
.profile-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.profile-action { display: grid; min-width: 0; min-height: 82px; align-content: center; justify-items: center; gap: 9px; border: 1px solid var(--app-border); border-radius: 14px; background: var(--app-card); color: var(--app-muted); font: inherit; font-size: .78rem; text-decoration: none; cursor: pointer; transition: border-color .15s ease, color .15s ease, background .15s ease; }
.profile-action ion-icon { font-size: 1.35rem; }
.profile-action:hover, .profile-action:focus-visible { border-color: #a7d6b1; background: #f5fbf6; color: #1b5e20; }
.profile-action:disabled { opacity: .5; cursor: wait; }
.sign-in-card { display: grid; justify-items: center; gap: 10px; padding: 32px 20px; border: 1px solid var(--app-border); border-radius: 16px; background: var(--app-card); text-align: center; }
.guest-avatar { font-size: 1.8rem; }
.sign-in-card h2, .sign-in-card p { margin: 0; }
.sign-in-card p { max-width: 420px; color: var(--app-muted); }
.error-card { border: 1px solid #f1d3cd; border-radius: 12px; box-shadow: none; color: #943e33; }
@media (max-width: 560px) { .profile-page { padding: 16px 12px 64px; } .profile-hero { padding: 18px; } .profile-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
