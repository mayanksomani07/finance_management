import { NextResponse } from 'next/server';
import { getUSStocks, isConnected } from '@/lib/indmoney';

export async function GET() {
  const connected = await isConnected();
  if (!connected) {
    return NextResponse.json({ success: false, error: 'not_connected' });
  }

  try {
    const { invested, current, stocks } = await getUSStocks();
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
