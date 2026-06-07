import { NextResponse } from 'next/server';
import { buildKiteAuthUrl } from '@/lib/kite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authUrl = buildKiteAuthUrl('');
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
