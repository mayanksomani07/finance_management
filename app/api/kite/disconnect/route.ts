import { NextResponse } from 'next/server';
import { clearKiteTokens } from '@/lib/kite';

export const dynamic = 'force-dynamic';

export async function GET() {
  await clearKiteTokens();
  return NextResponse.json({ success: true });
}
