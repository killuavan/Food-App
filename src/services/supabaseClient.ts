import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
let currentUser: User | null = null;

export function getSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the app.',
    );
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      'Supabase URL is invalid. In GitHub Actions secrets, set VITE_SUPABASE_URL to the full Project URL from Supabase Project Settings > API, starting with https://.',
    );
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    throw new Error(
      'Supabase URL is invalid. In GitHub Actions secrets, set VITE_SUPABASE_URL to the full Project URL from Supabase Project Settings > API, starting with https://.',
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
    app: { options: { projectId: new URL(import.meta.env.VITE_SUPABASE_URL.trim()).hostname } },
  };
}

export function assertSupabaseUser(userId: string): void {
  if (!userId || currentUser?.id !== userId) {
    throw new Error('Sign in again before changing your data.');
  }
}