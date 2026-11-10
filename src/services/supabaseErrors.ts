interface SupabaseErrorDetails {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return String(error);

  const { code, message, details, hint } = error as SupabaseErrorDetails;
  if (code === 'PGRST205' || code === '42P01') {
    return 'The Supabase user_data table is missing. Run the SQL migration from supabase/migrations in the Supabase SQL Editor.';
  }
  if (code === 'PGRST202') {
    return 'The Supabase database function is missing or outdated. Run the latest SQL migration from supabase/migrations.';
  }

  return [
    code ? `[${code}]` : '',
    message || 'Supabase request failed.',
    details,
    hint ? `Hint: ${hint}` : '',
  ].filter(Boolean).join(' ');
}
