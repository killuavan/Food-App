<template>
  <ion-page>
    <AppNavigation />
    <ion-content class="sign-in-content">
      <section class="sign-in-card">
        <div class="sign-in-icon" aria-hidden="true">🥬</div>
        <h1>Sign in to your inventory</h1>

        <ion-progress-bar v-if="loading" type="indeterminate" />
        <ion-card v-if="errorMessage" class="setup-card">
          <ion-card-content>
            <h2>Supabase setup needed</h2>
            <p>{{ errorMessage }}</p>
            <ol>
              <li>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>.</li>
              <li>Run the SQL migration in the project's <code>supabase/migrations</code> folder.</li>
              <li>Enable Google under Supabase Authentication → Providers and configure its OAuth redirect URLs.</li>
            </ol>
          </ion-card-content>
        </ion-card>

        <ion-button class="google-button" expand="block" :disabled="loading || Boolean(errorMessage)" @click="login">
          <ion-icon slot="start" :icon="logoGoogle" />
          Continue with Google
        </ion-button>
        <p v-if="authError" class="auth-error" role="alert">{{ authError }}</p>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppNavigation from '../components/AppNavigation.vue';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonPage,
  IonProgressBar,
} from '@ionic/vue';
import { logoGoogle } from 'ionicons/icons';
import { observeAuth, signInWithGoogle } from '../services/authService';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const authError = ref('');
let unsubscribe: (() => void) | undefined;

onMounted(() => {
  unsubscribe = observeAuth((user) => {
    loading.value = false;
    if (user) void router.replace('/home');
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });
});

onUnmounted(() => unsubscribe?.());

async function login(): Promise<void> {
  authError.value = '';
  loading.value = true;
  try {
    await signInWithGoogle();
  } catch (error) {
    authError.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.sign-in-content {
  --background: linear-gradient(150deg, #f2f7f3, #e9f2ec);
}

.sign-in-card {
  width: min(540px, calc(100% - 32px));
  margin: clamp(32px, 8vh, 88px) auto;
  padding: clamp(22px, 6vw, 42px);
  border: 1px solid #e3ece5;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 48px rgb(26 76 53 / 10%);
}

.sign-in-icon {
  display: grid;
  width: 62px;
  height: 62px;
  margin-bottom: 20px;
  place-items: center;
  border-radius: 18px;
  background: #eaf5ed;
  font-size: 2rem;
}

.eyebrow {
  color: var(--ion-color-primary);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.1em;
}

h1 {
  margin: 8px 0;
  color: #173f35;
  font-size: clamp(1.65rem, 5vw, 2.2rem);
  letter-spacing: -0.035em;
}

.intro {
  color: var(--ion-color-medium);
  line-height: 1.55;
}

.setup-card {
  margin: 22px 0;
  border: 1px solid #e6ece7;
  border-radius: 14px;
  box-shadow: none;
}

.setup-card h2 {
  margin-top: 0;
  color: #173f35;
  font-size: 1.05rem;
}

.setup-card p,
.setup-card li {
  color: var(--ion-color-medium);
  font-size: 0.86rem;
  line-height: 1.55;
}

.setup-card ol {
  padding-left: 20px;
}

.setup-card code {
  overflow-wrap: anywhere;
  color: #27674f;
}

.google-button {
  margin-top: 24px;
  --border-radius: 12px;
}

.auth-error {
  color: var(--ion-color-danger);
  font-size: 0.86rem;
}

</style>
