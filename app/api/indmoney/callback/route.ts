import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, storeTokens, getOrRegisterClient } from '@/lib/indmoney';
import { getAuthUser } from '@/lib/auth-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

async function popPKCEVerifier(db: SupabaseClient, userId: string, state: string): Promise<string | null> {
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

  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.redirect(`${url.origin}/login?redirect=/wealth`);
  }
  const { user, supabase } = auth;

  try {
    const redirectUri = `${url.origin}/api/indmoney/callback`;
    const verifier = await popPKCEVerifier(supabase, user.id, state);
    if (!verifier) {
      return NextResponse.redirect(`${url.origin}/wealth?indmoney_error=state_mismatch`);
    }

    const { client_id, client_secret } = await getOrRegisterClient(user.id, redirectUri);
    const tokens = await exchangeCode(code, verifier, client_id, client_secret, redirectUri);
    if (!tokens.access_token) {
      console.error('[indmoney callback] token exchange returned no access_token:', tokens);
      return NextResponse.redirect(`${url.origin}/wealth?indmoney_error=token_exchange_failed`);
    }
    await storeTokens(user.id, tokens.access_token, tokens.refresh_token, tokens.expires_in);

    return NextResponse.redirect(`${url.origin}/wealth?indmoney_connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${url.origin}/wealth?indmoney_error=${encodeURIComponent(msg)}`);
  }
}
