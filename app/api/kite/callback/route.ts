import { NextRequest, NextResponse } from 'next/server';
import { exchangeRequestToken, storeKiteToken } from '@/lib/kite';
import { getAuthUser } from '@/lib/auth-server';
import { getStoredValue, deleteStoredValue } from '@/lib/wealth-store';
import { isWealthUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url          = new URL(req.url);
  const requestToken = url.searchParams.get('request_token');
  const state        = url.searchParams.get('state');
  const status       = url.searchParams.get('status');
  const errParam     = url.searchParams.get('error');

  if (errParam || status === 'error') {
    return NextResponse.redirect(`${url.origin}/wealth?kite_error=auth_cancelled`);
  }

  if (!requestToken) {
    return NextResponse.redirect(`${url.origin}/wealth?kite_error=missing_request_token`);
  }

  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.redirect(`${url.origin}/login?redirect=/wealth`);
  }
  const { user } = auth;
  if (!isWealthUser(user.email)) {
    return NextResponse.redirect(`${url.origin}/?error=forbidden`);
  }

  // Validate state nonce to prevent CSRF token-swap attacks
  const storedState = await getStoredValue(user.id, '_kite_oauth_state');
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${url.origin}/wealth?kite_error=state_mismatch`);
  }
  // Consume the nonce immediately so it can't be replayed
  await deleteStoredValue(user.id, '_kite_oauth_state');

  try {
    const { access_token } = await exchangeRequestToken(requestToken);
    if (!access_token) {
      return NextResponse.redirect(`${url.origin}/wealth?kite_error=no_access_token`);
    }
    await storeKiteToken(user.id, access_token);
    return NextResponse.redirect(`${url.origin}/wealth?kite_connected=1`);
  } catch (err) {
    console.error('Kite callback error:', err);
    return NextResponse.redirect(`${url.origin}/wealth?kite_error=auth_failed`);
  }
}
