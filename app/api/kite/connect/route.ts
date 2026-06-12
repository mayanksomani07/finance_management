import { NextRequest, NextResponse } from 'next/server';
import { buildKiteAuthUrl } from '@/lib/kite';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/login?redirect=/wealth`);
  }

  try {
    const authUrl = buildKiteAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
