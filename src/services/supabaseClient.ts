import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
let currentUser: User | null = null;

export function getSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the app.',
    );
  }
  client ??= createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      flowType: 'pkce',
    },
  });
  return client;
}

export function setSupabaseCurrentUser(user: User | null): void {
  currentUser = user;
}

export function getSupabaseServices() {
  const supabase = getSupabaseClient();
  return {
    db: supabase,
    auth: {
      get currentUser(): { uid: string } | null {
        return currentUser ? { uid: currentUser.id } : null;
      },
    },
    app: { options: { projectId: new URL(import.meta.env.VITE_SUPABASE_URL).hostname } },
  };
}

export function assertSupabaseUser(userId: string): void {
  if (!userId || currentUser?.id !== userId) {
    throw new Error('Sign in again before changing your data.');
  }
}