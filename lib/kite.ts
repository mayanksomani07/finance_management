import crypto from 'crypto';
import { createServerClient } from './supabase';

// ─── token persistence (Supabase wealth_manual table, same pattern as indmoney) ──

const ENV = process.env.NEXT_PUBLIC_APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
const KEY_ACCESS   = `_kite_access_token_${ENV}`;
const KEY_EXPIRY   = `_kite_token_expiry_${ENV}`;
// api_key comes from env — no dynamic registration needed for Kite Connect Personal API
// api_secret comes from env — used server-side only for token exchange

async function getStoredValue(key: string): Promise<string | null> {
  const db = createServerClient();
  const { data } = await db
    .from('wealth_manual')
    .select('note')
    .eq('key', key)
    .single();
  return data?.note ?? null;
}

async function setStoredValue(key: string, value: string): Promise<void> {
  const db = createServerClient();
  await db
    .from('wealth_manual')
    .upsert({ key, value: 0, note: value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

// ─── Kite Connect OAuth helpers ───────────────────────────────────────────────
// Kite Connect Personal API uses a simpler flow than INDmoney:
// 1. Redirect user to kite.trade login with api_key
// 2. Kite redirects back with request_token
// 3. POST /session/token with api_key + api_secret + SHA256(api_key + request_token + api_secret)
// Access tokens expire daily — user must re-auth each day.

const KITE_BASE = 'https://kite.trade';
const KITE_API  = 'https://api.kite.trade';

export function buildKiteAuthUrl(redirectUri: string): string {
  const apiKey = process.env.ZERODHA_API_KEY;
  if (!apiKey) throw new Error('ZERODHA_API_KEY not configured');
  // Kite encodes redirect_uri itself — just pass v=3
  return `${KITE_BASE}/connect/login?api_key=${apiKey}&v=3`;
}

function checksumFor(apiKey: string, requestToken: string, apiSecret: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex');
}

export async function exchangeRequestToken(requestToken: string): Promise<{ access_token: string }> {
  const apiKey    = process.env.ZERODHA_API_KEY;
  const apiSecret = process.env.ZERODHA_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('ZERODHA_API_KEY / ZERODHA_API_SECRET not configured');

  const checksum = checksumFor(apiKey, requestToken, apiSecret);

  const res = await fetch(`${KITE_API}/session/token`, {
    method: 'POST',
    headers: {
      'X-Kite-Version': '3',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      api_key: apiKey,
      request_token: requestToken,
      checksum,
    }).toString(),
  });

  if (!res.ok) throw new Error(`Kite token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data ?? json;
}

export async function storeKiteToken(accessToken: string): Promise<void> {
  // Kite access tokens expire at ~6 AM IST next day — store with 23h TTL
  const expiry = String(Date.now() + 23 * 60 * 60 * 1000);
  await Promise.all([
    setStoredValue(KEY_ACCESS, accessToken),
    setStoredValue(KEY_EXPIRY, expiry),
  ]);
}

export async function getValidKiteToken(): Promise<string> {
  const apiKey = process.env.ZERODHA_API_KEY;
  if (!apiKey) throw new Error('not_configured');

  // Prefer env-var token (manual override) — useful during initial setup
  const envToken = process.env.ZERODHA_ACCESS_TOKEN;
  if (envToken) return envToken;

  const [token, expiryStr] = await Promise.all([
    getStoredValue(KEY_ACCESS),
    getStoredValue(KEY_EXPIRY),
  ]);

  if (!token) throw new Error('not_connected');

  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
  if (expiry < Date.now() + 60_000) throw new Error('token_expired');

  return token;
}

export async function clearKiteTokens(): Promise<void> {
  const db = createServerClient();
  const { data } = await db.from('wealth_manual').select('key').like('key', '_kite_%');
  const keys = (data ?? []).map((r) => r.key);
  if (keys.length) await db.from('wealth_manual').delete().in('key', keys);
}

export async function isKiteConnected(): Promise<boolean> {
  try { await getValidKiteToken(); return true; } catch { return false; }
}

// ─── Kite API call wrapper ────────────────────────────────────────────────────

export async function callKiteAPI<T = unknown>(path: string): Promise<T> {
  const apiKey = process.env.ZERODHA_API_KEY;
  if (!apiKey) throw new Error('not_configured');

  const token = await getValidKiteToken();

  const res = await fetch(`${KITE_API}${path}`, {
    headers: {
      'X-Kite-Version': '3',
      Authorization: `token ${apiKey}:${token}`,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Kite API ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return (json.data ?? json) as T;
}
