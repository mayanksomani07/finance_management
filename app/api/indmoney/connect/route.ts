import { NextRequest, NextResponse } from 'next/server';
import { generatePKCE, getOrRegisterClient, buildAuthUrl } from '@/lib/indmoney';
import { createServerClient } from '@/lib/supabase';

// Stores PKCE state + verifier temporarily in Supabase so the callback can verify
async function storePKCEState(state: string, verifier: string): Promise<void> {
  const db = createServerClient();
  await db.from('wealth_manual').upsert(
    { key: `_pkce_state_${state}`, value: 0, note: verifier, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
}

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/indmoney/callback`;

  try {
    const { client_id } = await getOrRegisterClient(redirectUri);
    const { verifier, challenge, state } = generatePKCE();

    await storePKCEState(state, verifier);

    const authUrl = buildAuthUrl(client_id, redirectUri, challenge, state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
