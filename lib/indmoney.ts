import crypto from 'crypto';
import { createServerClient } from './supabase-server';

// ─── token persistence (Supabase wealth_manual table reused with special keys) ──

// Prefix keys by env so localhost and prod don't overwrite each other in shared Supabase
const ENV = process.env.NEXT_PUBLIC_APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
const TOKEN_KEY_ACCESS          = `_indmoney_access_token_${ENV}`;
const TOKEN_KEY_REFRESH         = `_indmoney_refresh_token_${ENV}`;
const TOKEN_KEY_EXPIRY          = `_indmoney_token_expiry_${ENV}`;
const TOKEN_KEY_REFRESH_EXPIRY  = `_indmoney_refresh_token_expiry_${ENV}`;
const TOKEN_KEY_CLIENT_ID       = `_indmoney_client_id_${ENV}`;
const TOKEN_KEY_CLIENT_SECRET   = `_indmoney_client_secret_${ENV}`;
const TOKEN_KEY_CLIENT_REDIRECT = `_indmoney_client_redirect_${ENV}`;

// How long we consider a refresh token valid if IndMoney doesn't tell us
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Minimum access token lifetime we'll use even if IndMoney says shorter
const MIN_ACCESS_TOKEN_TTL_S = 24 * 60 * 60; // 24 hours

async function getStoredValue(userId: string, key: string): Promise<string | null> {
  const db = createServerClient();
  const { data } = await db
    .from('wealth_manual')
    .select('note')
    .eq('user_id', userId)
    .eq('key', key)
    .single();
  return data?.note ?? null;
}

async function setStoredValue(userId: string, key: string, value: string): Promise<void> {
  const db = createServerClient();
  await db
    .from('wealth_manual')
    .upsert(
      { user_id: userId, key, value: 0, note: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    );
}

// ─── PKCE helpers ────────────────────────────────────────────────────────────

export function generatePKCE() {
  const verifier  = crypto.randomBytes(64).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state     = crypto.randomBytes(24).toString('base64url');
  return { verifier, challenge, state };
}

// ─── Dynamic client registration ─────────────────────────────────────────────

export async function registerClient(redirectUri: string): Promise<{ client_id: string; client_secret: string }> {
  const res = await fetch('https://mcp.indmoney.com/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'finance-dashboard',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      scope: 'portfolio:read',
    }),
  });
  if (!res.ok) throw new Error(`Client registration failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getOrRegisterClient(userId: string, redirectUri: string): Promise<{ client_id: string; client_secret: string }> {
  const [id, secret, storedRedirect] = await Promise.all([
    getStoredValue(userId, TOKEN_KEY_CLIENT_ID),
    getStoredValue(userId, TOKEN_KEY_CLIENT_SECRET),
    getStoredValue(userId, TOKEN_KEY_CLIENT_REDIRECT),
  ]);
  // Reuse only if the redirect URI matches — different origins (prod vs localhost) need separate clients
  if (id && secret && storedRedirect === redirectUri) return { client_id: id, client_secret: secret };

  const creds = await registerClient(redirectUri);
  await Promise.all([
    setStoredValue(userId, TOKEN_KEY_CLIENT_ID, creds.client_id),
    setStoredValue(userId, TOKEN_KEY_CLIENT_SECRET, creds.client_secret),
    setStoredValue(userId, TOKEN_KEY_CLIENT_REDIRECT, redirectUri),
  ]);
  return creds;
}

// ─── Authorization URL ────────────────────────────────────────────────────────

export function buildAuthUrl(clientId: string, redirectUri: string, challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'portfolio:read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `https://mcp.indmoney.com/authorize?${params}`;
}

// ─── Token exchange ───────────────────────────────────────────────────────────

export async function exchangeCode(
  code: string,
  verifier: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch('https://mcp.indmoney.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: verifier,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  refreshExpiresIn?: number,
): Promise<void> {
  // Use at least MIN_ACCESS_TOKEN_TTL_S so IndMoney's short-lived tokens don't force constant re-auth
  const effectiveExpiry = Math.max(expiresIn, MIN_ACCESS_TOKEN_TTL_S);
  const expiry = String(Date.now() + effectiveExpiry * 1000);
  const refreshExpiry = String(Date.now() + (refreshExpiresIn ? refreshExpiresIn * 1000 : REFRESH_TOKEN_TTL_MS));
  await Promise.all([
    setStoredValue(userId, TOKEN_KEY_ACCESS, accessToken),
    setStoredValue(userId, TOKEN_KEY_REFRESH, refreshToken),
    setStoredValue(userId, TOKEN_KEY_EXPIRY, expiry),
    setStoredValue(userId, TOKEN_KEY_REFRESH_EXPIRY, refreshExpiry),
  ]);
}

// ─── Get a valid access token ────────────────────────────────────────────────

export async function getValidAccessToken(userId: string): Promise<string> {
  const [access, refresh, expiryStr, refreshExpiryStr, clientId, clientSecret] = await Promise.all([
    getStoredValue(userId, TOKEN_KEY_ACCESS),
    getStoredValue(userId, TOKEN_KEY_REFRESH),
    getStoredValue(userId, TOKEN_KEY_EXPIRY),
    getStoredValue(userId, TOKEN_KEY_REFRESH_EXPIRY),
    getStoredValue(userId, TOKEN_KEY_CLIENT_ID),
    getStoredValue(userId, TOKEN_KEY_CLIENT_SECRET),
  ]);

  if (!access || !refresh || !clientId || !clientSecret) {
    throw new Error('not_connected');
  }

  // If refresh token is expired, must re-auth — no point trying to refresh
  const refreshExpiry = refreshExpiryStr ? parseInt(refreshExpiryStr, 10) : Date.now() + REFRESH_TOKEN_TTL_MS;
  if (refreshExpiry < Date.now()) {
    throw new Error('not_connected');
  }

  // If access token still valid (with 60s buffer), return it
  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
  if (expiry > Date.now() + 60_000) return access;

  // Access token expired — IndMoney refresh tokens don't reliably produce valid tokens,
  // so treat expiry as not_connected and force re-auth via the OAuth flow.
  throw new Error('not_connected');
}

// ─── MCP tool call ────────────────────────────────────────────────────────────

let _rpcId = 1;

async function mcpFetch(token: string, body: object, sessionId?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    Authorization: `Bearer ${token}`,
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  return fetch('https://mcp.indmoney.com/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
}


export async function callMcpTool<T = unknown>(userId: string, toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = await getValidAccessToken(userId);

  const res = await mcpFetch(token, {
    jsonrpc: '2.0',
    id: _rpcId++,
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('not_connected');
    const body = await res.text().catch(() => '');
    throw new Error(`MCP HTTP error: ${res.status}${body ? ` — ${body}` : ''}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  let json: Record<string, unknown>;

  if (contentType.includes('text/event-stream')) {
    // Parse SSE stream — collect all `data:` lines until stream closes
    const text = await res.text();
    let merged: Record<string, unknown> | null = null;
    for (const line of text.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        // Last message with a `result` or `error` field is the response
        if (parsed.result !== undefined || parsed.error !== undefined) merged = parsed;
      } catch { /* skip non-JSON data lines */ }
    }
    if (!merged) throw new Error('MCP SSE: no result found in stream');
    json = merged;
  } else {
    json = await res.json();
  }

  if (json.error) {
    const err = json.error as Record<string, unknown>;
    throw new Error(`MCP error: ${err.message ?? JSON.stringify(err)}`);
  }

  // Unwrap text content envelope
  const result = json.result as Record<string, unknown> | undefined;
  const content = result?.content;
  if (Array.isArray(content) && (content[0] as Record<string, unknown>)?.text) {
    const text = (content[0] as Record<string, unknown>).text as string;
    try { return JSON.parse(text) as T; } catch { return text as T; }
  }
  return result as T;
}

// ─── High-level helpers ───────────────────────────────────────────────────────

export interface USStock {
  investment: string;       // e.g. "Vanguard S&P 500 ETF"
  invested_amount: number;  // cost basis in INR
  market_value: number;     // current value in INR
  total_pnl: number;
  pnl_per: number;
  total_units: number;
  unit_price: number;
}

interface NetworthHoldingsResult {
  holdings?: USStock[];
}

export async function getUSStocks(userId: string): Promise<{ invested: number; current: number; stocks: USStock[] }> {
  const raw = await callMcpTool<NetworthHoldingsResult>(userId, 'networth_holdings', { asset_type: 'US_STOCK' });
  const stocks: USStock[] = raw?.holdings ?? [];
  const invested = stocks.reduce((s, x) => s + (x.invested_amount ?? 0), 0);
  const current  = stocks.reduce((s, x) => s + (x.market_value   ?? 0), 0);
  return { invested, current, stocks };
}

export async function isConnected(userId: string): Promise<boolean> {
  try { await getValidAccessToken(userId); return true; } catch { return false; }
}
