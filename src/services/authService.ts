import { ref, watch } from 'vue';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, setSupabaseCurrentUser } from './supabaseClient';

export type AuthenticatedUser = User & { uid: string; displayName: string | null };
const nativeOAuthRedirectUrl = 'io.killuavan.foodapp://auth/callback';

export const authenticatedUser = ref<AuthenticatedUser | null>(null);
export const authStateReady = ref(false);
export const authStateError = ref('');

let unsubscribeSharedAuth: (() => void) | undefined;
let nativeOAuthListener: ReturnType<typeof NativeApp.addListener> | undefined;
let exchangedOAuthCode: string | undefined;

async function handleNativeOAuthCallback(url: string): Promise<void> {
  let callback: URL;
  try {
    callback = new URL(url);
  } catch {
    return;
  }
  if (
    callback.protocol !== 'io.killuavan.foodapp:'
    || callback.hostname !== 'auth'
    || callback.pathname !== '/callback'
  ) return;

  const providerError = callback.searchParams.get('error_description')
    ?? callback.searchParams.get('error');
  if (providerError) {
    authStateError.value = `Google sign-in failed: ${providerError}`;
    await Browser.close();
    return;
  }

  const code = callback.searchParams.get('code');
  if (!code || code === exchangedOAuthCode) return;
  exchangedOAuthCode = code;
  const { error } = await getSupabaseClient().auth.exchangeCodeForSession(code);
  if (error) {
    exchangedOAuthCode = undefined;
    authStateError.value = `Google sign-in could not finish: ${error.message}`;
    await Browser.close();
    return;
  }
  await Browser.close();
}

function initializeNativeOAuthCallback(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  nativeOAuthListener ??= NativeApp.addListener('appUrlOpen', ({ url }) => {
    void handleNativeOAuthCallback(url).catch((error: unknown) => {
      authStateError.value = error instanceof Error
        ? `Google sign-in could not finish: ${error.message}`
        : 'Google sign-in could not finish. Please try again.';
    });
  });
  return nativeOAuthListener.then(() => undefined);
}

function toAuthenticatedUser(user: User | null): AuthenticatedUser | null {
  return user ? {
    ...user,
    uid: user.id,
    displayName: typeof user.user_metadata.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata.name === 'string'
        ? user.user_metadata.name
        : null,
  } : null;
}

export function initializeAuthState(): void {
  if (unsubscribeSharedAuth) return;

  authStateReady.value = false;
  authStateError.value = '';
  void initializeNativeOAuthCallback().catch((error: unknown) => {
    authStateError.value = error instanceof Error ? error.message : String(error);
  });
  try {
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setSupabaseCurrentUser(user);
      authenticatedUser.value = toAuthenticatedUser(user);
      authStateReady.value = true;
      authStateError.value = '';
    });
    unsubscribeSharedAuth = () => subscription.unsubscribe();
  } catch (error) {
    authStateError.value = error instanceof Error ? error.message : String(error);
    authStateReady.value = true;
  }
}

export function waitForAuthStateReady(timeoutMs = 10_000): Promise<void> {
  if (authStateReady.value) return Promise.resolve();
  initializeAuthState();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stop();
      resolve();
    };
    const stop = watch(authStateReady, (ready) => {
      if (ready) finish();
    });
    const timer = setTimeout(() => {
      if (!authStateReady.value) {
        authStateError.value = 'Supabase connection is taking too long. Check your internet connection and retry.';
      }
      finish();
    }, timeoutMs);
    if (authStateReady.value) finish();
  });
}

export function observeAuth(
  onChange: (user: AuthenticatedUser | null) => void,
  onError: (error: Error) => void,
): () => void {
  try {
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      onChange(toAuthenticatedUser(session?.user ?? null));
    });
    void getSupabaseClient().auth.getSession().then(({ data, error }) => {
      if (error) onError(new Error(`Authentication could not be checked: ${error.message}`));
      else onChange(toAuthenticatedUser(data.session?.user ?? null));
    }).catch((error: unknown) => {
      onError(error instanceof Error ? error : new Error(String(error)));
    });
    return () => subscription.unsubscribe();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => undefined;
  }
}

export async function signInWithGoogle(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await initializeNativeOAuthCallback();
    const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: nativeOAuthRedirectUrl,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Google sign-in did not return an authorization URL.');
    await Browser.open({ url: data.url });
    return;
  }

  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/home` },
  });
  if (error) throw error;
}

export async function signOutUser(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
