# Supabase setup and Firebase migration

The app's authentication and Firestore-backed services have been switched to Supabase. Existing Firebase data is not deleted. Keep the Firebase project until its records have been imported and verified.

## 1. Configure the Supabase project

In Supabase, open **Project Settings → API Keys** and copy the project URL and **publishable** key into `App/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never put a Supabase secret key or Firebase service-account key in a `VITE_` variable or in client code. Restart the Vite server after editing environment variables.

## 2. Create the database table and policies

Open the project's **SQL Editor** and apply both additive migrations in timestamp order:

1. `supabase/migrations/20261109210000_user_data.sql`
2. `supabase/migrations/20261109220000_email_notifications.sql`

The notification migration adds per-user preferences and history, service-only delivery state, and RLS policies. It does not reset or modify existing inventory data. Users can read their own notification history but cannot insert, update, or delete history records; only the scheduled server function can record delivery attempts.

## 3. Enable Google sign-in

In **Authentication → Sign In / Providers → Google**, enable Google and enter the OAuth Client ID and Client Secret from Google Cloud Console. In Supabase's Google-provider screen, copy its callback URL into the authorized redirect URIs in Google Cloud.

Then in **Authentication → URL Configuration**, set:

- **Site URL** to the app's local origin while testing (for example `http://localhost:5173`).
- **Redirect URLs** to include the same local origin and the production app URL when available.

The app also needs a Google OAuth client configured for the Supabase provider; the old Firebase Google provider settings do not automatically carry over.

## 4. Deploy scheduled email notifications

The scheduled function uses Resend and reads recipients from the signed-in Supabase Auth account. It sends generic alert summaries, not inventory notes, nutrition details, or other health information.

1. Deploy the Edge Function from the `App` folder:

   ```powershell
   supabase functions deploy send-inventory-notifications
   ```

   `supabase/config.toml` keeps JWT verification enabled. The function additionally requires a service-role JWT. It will not accept an arbitrary recipient from the request.
2. In **Project Settings → API Keys**, obtain the legacy **service_role JWT** for server-to-server use. Do not use the publishable key, expose this token in the frontend, or commit it.
3. Configure function secrets:

   ```powershell
   supabase secrets set RESEND_API_KEY=re_your_server_key EMAIL_FROM="Pantry & Plate <alerts@your-verified-domain.example>"
   ```

   The sender domain must be verified with Resend. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not place any of these values in `VITE_` variables.
4. In the Supabase SQL Editor, enable `pg_cron`, `pg_net`, and Vault if they are not enabled. Add the project URL and the service-role JWT to Vault (replace the values locally and do not save them in project SQL files):

   ```sql
   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'inventory_notifications_project_url');
   select vault.create_secret('YOUR_SERVICE_ROLE_JWT', 'inventory_notifications_service_role_jwt');
   ```

5. Schedule an hourly invocation. The function calculates each user's local date and applies each preference's daily or weekly cadence. Re-running during the same local day does not repeat the same alert; a unique key and an atomic lease also protect against overlapping invocations.

   ```sql
   select cron.schedule(
     'send-inventory-notifications-hourly',
     '0 * * * *',
     $job$
       select net.http_post(
         url := (
           select decrypted_secret || '/functions/v1/send-inventory-notifications'
           from vault.decrypted_secrets
           where name = 'inventory_notifications_project_url'
         ),
         headers := jsonb_build_object(
           'Authorization', 'Bearer ' || (
             select decrypted_secret
             from vault.decrypted_secrets
             where name = 'inventory_notifications_service_role_jwt'
           ),
           'Content-Type', 'application/json'
         ),
         body := '{}'::jsonb
       );
     $job$
   );
   ```

   Check **Integrations → Cron** and the Edge Function logs after deployment. Remove the job with `select cron.unschedule('send-inventory-notifications-hourly');` if needed. Failed provider sends are retried at most three times; successful history is recorded only after Resend accepts the message.

## 5. Import old Firebase records

The import matches Firebase and Supabase users by email. Sign into the new Ionic app with the same Google account used in Firebase before starting the import. The importer covers `inventoryItems`, `consumptionLogs`, `inventoryMovements`, `groceryItems`, `healthProfile`, `weeklyMealPlans`, and `weeklyMealFavorites`.

1. In Firebase Console, open **Project settings → Service accounts → Generate new private key**. Store the downloaded JSON outside the app folder; do not share or commit it.
2. In Supabase **Project Settings → API Keys**, create/copy a **secret key** for local server-side migration only. Do not use the publishable key for this step, and never put the secret key in client code.
3. Create `App/.env.migrate.local` (it is ignored by Git) with these local-only values:

   ```env
   FIREBASE_SERVICE_ACCOUNT_PATH=C:\path\outside\the\app\firebase-service-account.json
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=your-secret-key
   ```

4. In a terminal at the `App` folder, run:

   ```powershell
   npm run migrate:firebase
   ```

The import is safe to re-run: it upserts records while preserving Firestore document IDs. The script prints only a record count. It stops if a Firebase account cannot be matched to a Supabase account by email. Do not delete the Firebase project until you have checked the imported data in the app.

## 6. Run and validate

```powershell
npm run dev
npm run build
npm run test:unit -- --run
```

If you change either Supabase frontend environment variable, restart `npm run dev`. The Supabase `secret` key is used only by the local import script and must never be exposed in the browser or committed.