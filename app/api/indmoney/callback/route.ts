import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, storeTokens, getOrRegisterClient } from '@/lib/indmoney';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function popPKCEVerifier(db: ReturnType<typeof createServerClient>, userId: string, state: string): Promise<string | null> {
  const key = `_pkce_state_${state}`;
  const { data } = await db
    .from('wealth_manual')
    .select('note')
    .eq('user_id', userId)
    .eq('key', key)
    .single();
  if (data?.note) {
    // Clean up one-time state entry
    await db.from('wealth_manual').delete().eq('user_id', userId).eq('key', key);
    return data.note;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url      = new URL(req.url);
  const code     = url.searchParams.get('code');
  const state    = url.searchParams.get('state');
  const errParam = url.searchParams.get('error');

  if (errParam) {
    return NextResponse.redirect(`${url.origin}/wealth?indmoney_error=${encodeURIComponent(errParam)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${url.origin}/wealth?indmoney_error=missing_params`);
  }

  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // getUser() verifies with the Supabase auth server — if it fails the session is
    // genuinely invalid. Redirect to login; the PKCE state entry persists in the DB
    // so the user can retry immediately after re-authenticating.
    return NextResponse.redirect(`${url.origin}/login?redirect=/wealth`);
  }

  try {
    const redirectUri = `${url.origin}/api/indmoney/callback`;
    const verifier = await popPKCEVerifier(supabase, user.id, state);
    if (!verifier) {
      return NextResponse.redirect(`${url.origin}/wealth?indmoney_error=state_mismatch`);
    }

    const { client_id, client_secret } = await getOrRegisterClient(user.id, redirectUri);
    const tokens = await exchangeCode(code, verifier, client_id, client_secret, redirectUri);
    if (!tokens.access_token) {
      return NextResponse.redirect(`${url.origin}/wealth?indmoney_error=${encodeURIComponent('token_exchange_returned_no_access_token:' + JSON.stringify(tokens))}`);
    }
    await storeTokens(user.id, tokens.access_token, tokens.refresh_token, tokens.expires_in);

    return NextResponse.redirect(`${url.origin}/wealth?indmoney_connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${url.origin}/wealth?indmoney_error=${encodeURIComponent(msg)}`);
  }
}
