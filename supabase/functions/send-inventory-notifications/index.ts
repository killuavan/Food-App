import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AlertType = 'FOOD_EXPIRING' | 'FOOD_EXPIRED' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'GROCERY_REMINDER';
type Preferences = {
  user_id: string;
  email_enabled: boolean;
  food_expiring_enabled: boolean;
  food_expired_enabled: boolean;
  low_stock_enabled: boolean;
  out_of_stock_enabled: boolean;
  grocery_reminder_enabled: boolean;
  expiration_days: number;
  grocery_frequency: 'DAILY' | 'WEEKLY';
  time_zone: string;
};
type InventoryPayload = {
  foodName?: unknown;
  quantity?: unknown;
  lowStockThreshold?: unknown;
  expirationDate?: unknown;
};
type DataRecord = { record_id: string; payload: Record<string, unknown> };
type Alert = { type: AlertType; key: string; title: string; summary: string };

const endpoint = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const resendKey = Deno.env.get('RESEND_API_KEY');
const fromAddress = Deno.env.get('EMAIL_FROM');
const maxAlertsPerRun = 100;

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!endpoint || !serviceKey || !resendKey || !fromAddress) {
    console.error('Scheduled notification function is missing server configuration.');
    return new Response('Notification service is not configured', { status: 500 });
  }
  if (!isServiceRoleToken(request.headers.get('authorization'))) {
    return new Response('Service role authorization required', { status: 401 });
  }

  const supabase = createClient(endpoint, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: preferences, error } = await supabase
    .from('notification_preferences')
    .select('user_id,email_enabled,food_expiring_enabled,food_expired_enabled,low_stock_enabled,out_of_stock_enabled,grocery_reminder_enabled,expiration_days,grocery_frequency,time_zone');
  if (error) {
    console.error('Could not load notification preferences:', error.message);
    return new Response('Could not load notification preferences', { status: 500 });
  }

  let processed = 0;
  for (const pref of (preferences ?? []) as Preferences[]) {
    try {
      const { data: account, error: accountError } = await supabase.auth.admin.getUserById(pref.user_id);
      if (accountError) throw accountError;
      const recipient = account.user?.email;
      if (!recipient) continue;

      const localDate = dateInTimeZone(new Date(), pref.time_zone);
      const [inventoryResult, groceryResult, stateResult] = await Promise.all([
        supabase.from('user_data').select('record_id,payload')
          .eq('user_id', pref.user_id).eq('collection_name', 'inventoryItems'),
        supabase.from('user_data').select('record_id,payload')
          .eq('user_id', pref.user_id).eq('collection_name', 'groceryItems'),
        supabase.from('notification_item_state').select('item_id,stock_status,episode')
          .eq('user_id', pref.user_id),
      ]);
      if (inventoryResult.error) throw inventoryResult.error;
      if (groceryResult.error) throw groceryResult.error;
      if (stateResult.error) throw stateResult.error;

      const inventory = (inventoryResult.data ?? []) as DataRecord[];
      const groceries = (groceryResult.data ?? []) as DataRecord[];
      const previousStates = new Map((stateResult.data ?? []).map((state) => [state.item_id, state]));
      const alerts: Alert[] = [];

      for (const entry of inventory) {
        const item = entry.payload as InventoryPayload;
        const quantity = Number(item.quantity);
        const threshold = Number(item.lowStockThreshold);
        if (Number.isFinite(quantity) && Number.isFinite(threshold)) {
          const currentStatus = quantity <= 0 ? 'out' : quantity <= threshold ? 'low' : 'good';
          const previous = previousStates.get(entry.record_id);
          let episode = previous?.episode ?? (currentStatus === 'good' ? 0 : 1);
          if (previous?.stock_status === 'good' && currentStatus !== 'good') episode = Math.max(1, episode + 1);

          const { error: stateError } = await supabase.from('notification_item_state').upsert({
            user_id: pref.user_id,
            item_id: entry.record_id,
            stock_status: currentStatus,
            episode,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,item_id' });
          if (stateError) throw stateError;

          if (pref.email_enabled && currentStatus === 'low' && pref.low_stock_enabled) {
            alerts.push({
              type: 'LOW_STOCK',
              key: `stock:${entry.record_id}:${episode}:low`,
              title: 'Low-stock reminder',
              summary: 'An item in your food inventory is at or below its low-stock threshold.',
            });
          }
          if (pref.email_enabled && currentStatus === 'out' && pref.out_of_stock_enabled) {
            alerts.push({
              type: 'OUT_OF_STOCK',
              key: `stock:${entry.record_id}:${episode}:out`,
              title: 'Out-of-stock reminder',
              summary: 'An item in your food inventory has reached zero quantity.',
            });
          }
        }

        if (pref.email_enabled && typeof item.expirationDate === 'string') {
          const daysUntil = daysBetween(localDate, item.expirationDate);
          if (daysUntil === 0 || daysUntil === 1 || daysUntil === pref.expiration_days) {
            if (pref.food_expiring_enabled) {
              alerts.push({
                type: 'FOOD_EXPIRING',
                key: `expiration:${entry.record_id}:${item.expirationDate}:day-${daysUntil}`,
                title: 'Food expiration reminder',
                summary: 'One item in your inventory is approaching its expiration date.',
              });
            }
          } else if (daysUntil !== null && daysUntil < 0 && pref.food_expired_enabled) {
            alerts.push({
              type: 'FOOD_EXPIRED',
              key: `expired:${entry.record_id}:${item.expirationDate}`,
              title: 'Food expiration update',
              summary: 'One item in your inventory is past its expiration date.',
            });
          }
        }
      }

      const pendingGroceries = groceries.filter((entry) => entry.payload.status === 'PENDING').length;
      const dayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
        .format(new Date(`${localDate}T12:00:00.000Z`));
      const shouldRemindGroceries = pref.grocery_frequency === 'DAILY' || dayParts === 'Monday';
      if (pref.email_enabled && pref.grocery_reminder_enabled && pendingGroceries > 0 && shouldRemindGroceries) {
        alerts.push({
          type: 'GROCERY_REMINDER',
          key: `grocery:${pref.grocery_frequency}:${localDate}`,
          title: 'Grocery list reminder',
          summary: `You have ${pendingGroceries} pending item${pendingGroceries === 1 ? '' : 's'} on your grocery list.`,
        });
      }

      if (!pref.email_enabled) continue;
      const { data: retryable, error: retryError } = await supabase.from('notification_history')
        .select('dedupe_key,notification_type').eq('user_id', pref.user_id)
        .in('status', ['PENDING', 'FAILED']).lt('attempts', 3)
        .lte('next_attempt_at', new Date().toISOString()).limit(maxAlertsPerRun);
      if (retryError) throw retryError;
      const enabledTypes: Record<AlertType, boolean> = {
        FOOD_EXPIRING: pref.food_expiring_enabled,
        FOOD_EXPIRED: pref.food_expired_enabled,
        LOW_STOCK: pref.low_stock_enabled,
        OUT_OF_STOCK: pref.out_of_stock_enabled,
        GROCERY_REMINDER: pref.grocery_reminder_enabled,
      };
      const keys = new Set<string>((retryable ?? [])
        .filter((row) => enabledTypes[row.notification_type as AlertType])
        .map((row) => row.dedupe_key));
      for (const alert of alerts) {
        if (processed >= maxAlertsPerRun) break;
        const { error: insertError } = await supabase.from('notification_history').upsert({
          user_id: pref.user_id,
          notification_type: alert.type,
          dedupe_key: alert.key,
          title: alert.title,
          summary: alert.summary,
        }, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
        if (insertError) throw insertError;
        keys.add(alert.key);
      }
      for (const key of keys) {
        if (processed >= maxAlertsPerRun) break;
        await deliver(supabase, pref.user_id, key, recipient, resendKey, fromAddress);
        processed += 1;
      }
    } catch (userError) {
      console.error(`Notification processing failed for user ${pref.user_id}:`, userError);
    }
  }
  return Response.json({ processed });
});

async function deliver(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  dedupeKey: string,
  recipient: string,
  apiKey: string,
  from: string,
): Promise<void> {
  const { data: id, error: claimError } = await supabase.rpc('claim_notification_history', {
    p_user_id: userId,
    p_dedupe_key: dedupeKey,
  });
  if (claimError) throw claimError;
  if (!id) return;

  const { data: row, error: readError } = await supabase.from('notification_history')
    .select('title,summary').eq('id', id).single();
  if (readError) throw readError;

  let responseBody: Record<string, unknown>;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: row.title,
        text: `${row.title}\n\n${row.summary}\n\nManage these alerts in your Pantry & Plate notification settings.`,
        html: `<main><h1>${escapeHtml(row.title)}</h1><p>${escapeHtml(row.summary)}</p><p>Manage these alerts in your Pantry &amp; Plate notification settings.</p></main>`,
      }),
    });
    responseBody = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Email provider rejected the message (${response.status}).`);
  } catch (deliveryError) {
    const { error: updateError } = await supabase.from('notification_history').update({
      status: 'FAILED',
      next_attempt_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      claim_until: null,
    }).eq('id', id);
    if (updateError) console.error('Could not record email delivery failure:', updateError.message);
    console.error('Email delivery failed:', deliveryError);
    return;
  }
  const { error: updateError } = await supabase.from('notification_history').update({
    status: 'SENT',
    sent_at: new Date().toISOString(),
    provider_message_id: typeof responseBody.id === 'string' ? responseBody.id : null,
    claim_until: null,
  }).eq('id', id);
  if (updateError) console.error('Email was accepted, but SENT status could not be recorded:', updateError.message);
}

function isServiceRoleToken(header: string | null): boolean {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

function validTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value;
  } catch {
    return 'UTC';
  }
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysBetween(fromDate: string, toDate: string): number | null {
  if (!isDate(fromDate) || !isDate(toDate)) return null;
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000);
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}
