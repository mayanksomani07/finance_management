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
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually (no dotenv dependency needed)
const envPath = resolve(process.cwd(), '.env.local');
const envLines = readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL    ?? 'admin@gmail.com';
const ADMIN_PASS   = process.env.ADMIN_PASSWORD ?? 'admin@123';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Creating admin user: ${ADMIN_EMAIL}`);

const { data, error } = await supabase.auth.admin.createUser({
  email: ADMIN_EMAIL,
  password: ADMIN_PASS,
  email_confirm: true,
  user_metadata: { full_name: 'Admin' },
});

if (error) {
  if (error.message.includes('already been registered')) {
    console.log('Admin user already exists — skipping.');
  } else {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
} else {
  console.log(`Admin user created: ${data.user.id}`);
}

// Set role in user_profiles
const userId = data?.user?.id ?? (
  await supabase.from('user_profiles').select('id').eq('email', ADMIN_EMAIL).single()
).data?.id;

if (userId) {
  await supabase.from('user_profiles').upsert({ id: userId, email: ADMIN_EMAIL, role: 'admin', full_name: 'Admin' });
  console.log('Admin profile role set.');
}

console.log('Done. Set NEXT_PUBLIC_ADMIN_EMAIL=' + ADMIN_EMAIL + ' in your .env.local');
