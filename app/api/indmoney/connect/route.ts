import { NextRequest, NextResponse } from 'next/server';
import { generatePKCE, getOrRegisterClient, buildAuthUrl } from '@/lib/indmoney';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Stores PKCE state + verifier temporarily in Supabase so the callback can verify
async function storePKCEState(userId: string, state: string, verifier: string): Promise<void> {
  const db = createServerClient();
  await db.from('wealth_manual').upsert(
    { user_id: userId, key: `_pkce_state_${state}`, value: 0, note: verifier, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' },
  );
}

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/indmoney/callback`;

  const db = createServerClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { client_id } = await getOrRegisterClient(user.id, redirectUri);
    const { verifier, challenge, state } = generatePKCE();

    // Store the new state first, then clean up other stale rows to avoid a race
    // where a delete of "all _pkce_state_%" removes the row we just inserted.
    await storePKCEState(user.id, state, verifier);
    await db.from('wealth_manual').delete().eq('user_id', user.id).like('key', '_pkce_state_%').neq('key', `_pkce_state_${state}`);

    const authUrl = buildAuthUrl(client_id, redirectUri, challenge, state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
