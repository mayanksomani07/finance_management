import { NextResponse } from 'next/server';
import { clearKiteTokens } from '@/lib/kite';
import { getAuthUser, unauthorized } from '@/lib/auth-server';
import { isWealthUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return unauthorized();
  const { user } = auth;
  if (!isWealthUser(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await clearKiteTokens(user.id);
  } catch (err) {
    console.error('Kite disconnect error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
