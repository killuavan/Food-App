import { ref, watch } from 'vue';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, setSupabaseCurrentUser } from './supabaseClient';

export type AuthenticatedUser = User & { uid: string; displayName: string | null };

export const authenticatedUser = ref<AuthenticatedUser | null>(null);
export const authStateReady = ref(false);
export const authStateError = ref('');

let unsubscribeSharedAuth: (() => void) | undefined;

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

export function waitForAuthStateReady(): Promise<void> {
  if (authStateReady.value) return Promise.resolve();
  initializeAuthState();
  return new Promise((resolve) => {
    const stop = watch(authStateReady, (ready) => {
      if (!ready) return;
      stop();
      resolve();
    }, { immediate: true });
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
