/**
 * Creates the admin user in Supabase Auth (email/password).
 * Run once: node scripts/seed-admin.mjs
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   ADMIN_EMAIL       (defaults to admin@gmail.com)
 *   ADMIN_PASSWORD    (defaults to admin@123 — change before deploying!)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually (no dotenv dependency needed)
const envPath = resolve(process.cwd(), '.env.local');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const k = trimmed.slice(0, idx).trim();
  const v = trimmed.slice(idx + 1).trim();
  if (k) process.env[k] = v;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL;
const ADMIN_PASS   = process.env.ADMIN_PASSWORD;

const missing = [];
if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!SERVICE_KEY)  missing.push('SUPABASE_SERVICE_KEY');
if (!ADMIN_EMAIL)  missing.push('ADMIN_EMAIL');
if (!ADMIN_PASS)   missing.push('ADMIN_PASSWORD');
if (missing.length) {
  console.error('Missing required env vars in .env.local:', missing.join(', '));
  process.exit(1);
}

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// ── Step 1: create user via Auth Admin API ───────────────────────────────────
console.log(`Creating admin user: ${ADMIN_EMAIL}`);

let userId;

const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
    email_confirm: true,
    user_metadata: { full_name: 'Admin' },
  }),
});

const createBody = await createRes.json();

if (createRes.ok) {
  userId = createBody.id;
  console.log(`Admin user created: ${userId}`);
} else if (createBody.msg?.includes('already been registered') || createBody.code === 'email_exists') {
  console.log('Admin user already exists — looking up existing user.');

  // List all users and find by email
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
  const listBody = await listRes.json();
  if (!listRes.ok) {
    console.error('Error listing users:', JSON.stringify(listBody));
    process.exit(1);
  }
  const users = listBody.users ?? listBody;
  const existing = users.find(u => u.email === ADMIN_EMAIL);
  if (!existing) {
    console.error(`Could not find ${ADMIN_EMAIL} in Auth — check ADMIN_EMAIL.`);
    process.exit(1);
  }
  userId = existing.id;
  console.log(`Found existing user: ${userId}`);
} else {
  console.error('Error creating admin:', JSON.stringify(createBody));
  process.exit(1);
}

// ── Step 2: upsert user_profiles row with role=admin ─────────────────────────
const upsertRes = await fetch(
  `${SUPABASE_URL}/rest/v1/user_profiles`,
  {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: userId, email: ADMIN_EMAIL, role: 'admin', full_name: 'Admin' }),
  }
);

if (!upsertRes.ok) {
  const body = await upsertRes.text();
  console.error('Error setting admin profile:', body);
  process.exit(1);
}

console.log('Admin profile role set to admin.');
console.log(`Done. You can now log in with ${ADMIN_EMAIL} and visit /admin.`);
