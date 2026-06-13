import { NextResponse } from 'next/server';
import { getUSStocks, isConnected } from '@/lib/indmoney';
import { getAuthUser, unauthorized } from '@/lib/auth-server';
import { isWealthUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return unauthorized();
  const { user } = auth;
  if (!isWealthUser(user.email)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const connected = await isConnected(user.id);
  if (!connected) {
    return NextResponse.json({ success: false, error: 'not_connected' });
  }

  try {
    const { invested, current, stocks } = await getUSStocks(user.id);
    return NextResponse.json({
      success: true,
      invested,
      current,
      stocks,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNotConnected = msg === 'not_connected' || msg === 'token_expired';
    if (isNotConnected) {
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'IndMoney API error' }, { status: 500 });
  }
}
