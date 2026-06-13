import { NextRequest, NextResponse } from 'next/server';
import { generatePKCE, getOrRegisterClient, buildAuthUrl } from '@/lib/indmoney';
import { getAuthUser, unauthorized } from '@/lib/auth-server';
import { setStoredValue } from '@/lib/wealth-store';
import { isWealthUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/indmoney/callback`;

  const auth = await getAuthUser();
  if (!auth) return unauthorized();
  const { user, supabase } = auth;
  if (!isWealthUser(user.email)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { client_id } = await getOrRegisterClient(user.id, redirectUri);
    const { verifier, challenge, state } = generatePKCE();

    // Store the new state first, then clean up other stale rows to avoid a race
    // where a delete of "all _pkce_state_%" removes the row we just inserted.
    await setStoredValue(user.id, `_pkce_state_${state}`, verifier);
    await supabase.from('wealth_manual').delete().eq('user_id', user.id).like('key', '_pkce_state_%').neq('key', `_pkce_state_${state}`);

    const authUrl = buildAuthUrl(client_id, redirectUri, challenge, state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('IndMoney connect error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
