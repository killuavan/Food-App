import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const migrationEnvPath = resolve(process.cwd(), '.env.migrate.local');
let migrationEnv;
try {
  migrationEnv = readFileSync(migrationEnvPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((values, line) => {
      const separator = line.indexOf('=');
      if (separator > 0) {
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
        values[key] = value;
      }
      return values;
    }, {});
} catch {
  throw new Error('Create .env.migrate.local using the instructions in SUPABASE_SETUP.md.');
}

const required = ['FIREBASE_SERVICE_ACCOUNT_PATH', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
const missing = required.filter((name) => !migrationEnv[name]);
if (missing.length) throw new Error(`Missing ${missing.join(', ')} in .env.migrate.local.`);

const serviceAccount = JSON.parse(readFileSync(resolve(migrationEnv.FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8'));
const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});
const firebaseAuth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const supabase = createClient(migrationEnv.SUPABASE_URL, migrationEnv.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listSupabaseUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function serialize(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

const supabaseUsers = await listSupabaseUsers();
const supabaseUsersByEmail = new Map(
  supabaseUsers
    .filter((user) => user.email)
    .map((user) => [user.email.toLowerCase(), user.id]),
);
const firebaseUsers = await firestore.collection('users').get();
const collections = [
  'inventoryItems',
  'consumptionLogs',
  'inventoryMovements',
  'groceryItems',
  'healthProfile',
  'weeklyMealPlans',
  'weeklyMealFavorites',
];
const rows = [];

for (const firebaseUserDocument of firebaseUsers.docs) {
  let firebaseUser;
  try {
    firebaseUser = await firebaseAuth.getUser(firebaseUserDocument.id);
  } catch {
    throw new Error('A Firebase user record could not be matched to an account. Resolve it before importing.');
  }
  const userId = firebaseUser.email
    ? supabaseUsersByEmail.get(firebaseUser.email.toLowerCase())
    : undefined;
  if (!userId) {
    throw new Error(
      'Sign in to the new app with each Firebase user’s same Google account before running the migration.',
    );
  }

  for (const collectionName of collections) {
    const snapshot = await firebaseUserDocument.ref.collection(collectionName).get();
    for (const document of snapshot.docs) {
      rows.push({
        user_id: userId,
        collection_name: collectionName,
        record_id: document.id,
        payload: serialize(document.data()),
      });
    }
  }
}

for (let offset = 0; offset < rows.length; offset += 500) {
  const { error } = await supabase
    .from('user_data')
    .upsert(rows.slice(offset, offset + 500), {
      onConflict: 'user_id,collection_name,record_id',
    });
  if (error) throw error;
}

console.log(`Imported ${rows.length} Firebase records for ${firebaseUsers.size} user accounts.`);
