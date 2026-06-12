import { NextRequest, NextResponse } from 'next/server';
import { exchangeRequestToken, storeKiteToken } from '@/lib/kite';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url          = new URL(req.url);
  const requestToken = url.searchParams.get('request_token');
  const status       = url.searchParams.get('status');
  const errParam     = url.searchParams.get('error');

  if (errParam || status === 'error') {
    const msg = errParam ?? 'kite_auth_failed';
    return NextResponse.redirect(`${url.origin}/wealth?kite_error=${encodeURIComponent(msg)}`);
  }

  if (!requestToken) {
    return NextResponse.redirect(`${url.origin}/wealth?kite_error=missing_request_token`);
  }

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${url.origin}/login?redirect=/wealth`);
  }

  try {
    const { access_token } = await exchangeRequestToken(requestToken);
    if (!access_token) {
      return NextResponse.redirect(`${url.origin}/wealth?kite_error=no_access_token`);
    }
    await storeKiteToken(user.id, access_token);
    return NextResponse.redirect(`${url.origin}/wealth?kite_connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${url.origin}/wealth?kite_error=${encodeURIComponent(msg)}`);
  }
}
