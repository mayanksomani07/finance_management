import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildKiteAuthUrl } from '@/lib/kite';
import { getAuthUser } from '@/lib/auth-server';
import { setStoredValue } from '@/lib/wealth-store';
import { isWealthUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/login?redirect=/wealth`);
  }
  const { user } = auth;
  if (!isWealthUser(user.email)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  try {
    const state = crypto.randomBytes(24).toString('base64url');
    await setStoredValue(user.id, `_kite_oauth_state`, state);
    const authUrl = buildKiteAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
