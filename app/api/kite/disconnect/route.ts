import { NextResponse } from 'next/server';
import { clearKiteTokens } from '@/lib/kite';

export async function GET() {
  await clearKiteTokens();
  return NextResponse.json({ success: true });
}
