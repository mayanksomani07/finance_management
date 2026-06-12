import { NextResponse } from 'next/server';
import { callMcpTool, isConnected } from '@/lib/indmoney';
import { createServerClient } from '@/lib/supabase-server';

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

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
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
  if (!connected) return NextResponse.json({ stored, error: 'not_connected — tokens missing or refresh failed' });

  try {
    const all = await callMcpTool(user.id, 'networth_holdings', {});
    const usStock = await callMcpTool(user.id, 'networth_holdings', { asset_type: 'US_STOCK' });
    return NextResponse.json({ stored, all, usStock });
  } catch (err) {
    return NextResponse.json({ stored, error: String(err) });
  }
}
