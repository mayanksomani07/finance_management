import { NextResponse } from 'next/server';
import { getUSStocks, isConnected } from '@/lib/indmoney';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

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
    if (msg === 'not_connected') {
      return NextResponse.json({ success: false, error: 'not_connected' });
    }
    return NextResponse.json({ success: false, error: msg });
  }
}
