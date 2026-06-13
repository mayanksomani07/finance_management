import { NextResponse } from 'next/server';
import { callMcpTool, isConnected } from '@/lib/indmoney';
import { getAuthUser, unauthorized } from '@/lib/auth-server';
import { isWealthUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

const ENV = process.env.NEXT_PUBLIC_APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
const INDMONEY_KEYS = [
  `_indmoney_access_token_${ENV}`,
  `_indmoney_refresh_token_${ENV}`,
  `_indmoney_token_expiry_${ENV}`,
  `_indmoney_refresh_token_expiry_${ENV}`,
  `_indmoney_client_id_${ENV}`,
  `_indmoney_client_secret_${ENV}`,
  `_indmoney_client_redirect_${ENV}`,
];

const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'prod' || process.env.NODE_ENV === 'production';

export async function GET() {
  if (isProd) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const auth = await getAuthUser();
  if (!auth) return unauthorized();
  const { user } = auth;
  if (!isWealthUser(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await auth.supabase
    .from('wealth_manual')
    .select('key, note')
    .eq('user_id', user.id)
    .in('key', INDMONEY_KEYS);

  const stored: Record<string, string | null> = {};
  for (const key of INDMONEY_KEYS) {
    const row = data?.find(r => r.key === key);
    if (!row) { stored[key] = null; continue; }
    stored[key] = row.note ? row.note.slice(0, 8) + '...' : '(empty)';
  }

  const connected = await isConnected(user.id);
  if (!connected) return NextResponse.json({ stored, error: 'not_connected — tokens missing or refresh failed' }, { status: 400 });

  try {
    const all = await callMcpTool(user.id, 'networth_holdings', {});
    const usStock = await callMcpTool(user.id, 'networth_holdings', { asset_type: 'US_STOCK' });
    return NextResponse.json({ stored, all, usStock });
  } catch (err) {
    console.error('IndMoney debug error:', err);
    return NextResponse.json({ stored, error: 'IndMoney API error' }, { status: 500 });
  }
}
