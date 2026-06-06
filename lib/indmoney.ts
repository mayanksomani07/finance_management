import crypto from 'crypto';
import { createServerClient } from './supabase';

// ─── token persistence (Supabase wealth_manual table reused with special keys) ──

// Prefix keys by env so localhost and prod don't overwrite each other in shared Supabase
const ENV = process.env.NEXT_PUBLIC_APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
const TOKEN_KEY_ACCESS  = `_indmoney_access_token_${ENV}`;
const TOKEN_KEY_REFRESH = `_indmoney_refresh_token_${ENV}`;
const TOKEN_KEY_EXPIRY  = `_indmoney_token_expiry_${ENV}`;
const TOKEN_KEY_CLIENT_ID       = `_indmoney_client_id_${ENV}`;
const TOKEN_KEY_CLIENT_SECRET   = `_indmoney_client_secret_${ENV}`;
const TOKEN_KEY_CLIENT_REDIRECT = `_indmoney_client_redirect_${ENV}`;

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

export async function getOrRegisterClient(redirectUri: string): Promise<{ client_id: string; client_secret: string }> {
  const [id, secret, storedRedirect] = await Promise.all([
    getStoredValue(TOKEN_KEY_CLIENT_ID),
    getStoredValue(TOKEN_KEY_CLIENT_SECRET),
    getStoredValue(TOKEN_KEY_CLIENT_REDIRECT),
  ]);
  // Reuse only if the redirect URI matches — different origins (prod vs localhost) need separate clients
  if (id && secret && storedRedirect === redirectUri) return { client_id: id, client_secret: secret };

  const creds = await registerClient(redirectUri);
  await Promise.all([
    setStoredValue(TOKEN_KEY_CLIENT_ID, creds.client_id),
    setStoredValue(TOKEN_KEY_CLIENT_SECRET, creds.client_secret),
    setStoredValue(TOKEN_KEY_CLIENT_REDIRECT, redirectUri),
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

export async function storeTokens(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
  const expiry = String(Date.now() + expiresIn * 1000);
  await Promise.all([
    setStoredValue(TOKEN_KEY_ACCESS, accessToken),
    setStoredValue(TOKEN_KEY_REFRESH, refreshToken),
    setStoredValue(TOKEN_KEY_EXPIRY, expiry),
  ]);
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch('https://mcp.indmoney.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Get a valid access token (auto-refresh) ─────────────────────────────────

export async function getValidAccessToken(): Promise<string> {
  const [access, refresh, expiryStr, clientId, clientSecret] = await Promise.all([
    getStoredValue(TOKEN_KEY_ACCESS),
    getStoredValue(TOKEN_KEY_REFRESH),
    getStoredValue(TOKEN_KEY_EXPIRY),
    getStoredValue(TOKEN_KEY_CLIENT_ID),
    getStoredValue(TOKEN_KEY_CLIENT_SECRET),
  ]);

  if (!access || !refresh || !clientId || !clientSecret) {
    throw new Error('not_connected');
  }

  // If token still valid (with 60s buffer), return it
  const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
  if (access && expiry > Date.now() + 60_000) return access;

  // Refresh
  const tokens = await refreshAccessToken(clientId, clientSecret, refresh);
  await storeTokens(tokens.access_token, tokens.refresh_token ?? refresh, tokens.expires_in ?? 3600);
  return tokens.access_token;
}

// ─── MCP tool call ────────────────────────────────────────────────────────────

let _rpcId = 1;

export async function callMcpTool<T = unknown>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = await getValidAccessToken();

  const res = await fetch('https://mcp.indmoney.com/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // MCP Streamable HTTP spec requires both; omitting text/event-stream → 406
      'Accept': 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: _rpcId++,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`MCP HTTP error: ${res.status}`);

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

export async function getUSStocks(): Promise<{ invested: number; current: number; stocks: USStock[] }> {
  const raw = await callMcpTool<NetworthHoldingsResult>('networth_holdings', { asset_type: 'US_STOCK' });
  const stocks: USStock[] = raw?.holdings ?? [];
  const invested = stocks.reduce((s, x) => s + (x.invested_amount ?? 0), 0);
  const current  = stocks.reduce((s, x) => s + (x.market_value   ?? 0), 0);
  return { invested, current, stocks };
}

export async function isConnected(): Promise<boolean> {
  try { await getValidAccessToken(); return true; } catch { return false; }
}
