import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const { data, error } = await supabase
      .from('wealth_manual')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

    const map: Record<string, { value: number; updated_at: string; note?: string }> = {};
    for (const row of data ?? []) {
      // Skip internal OAuth/token keys — not meant for client consumption
      if (row.key.startsWith('_')) continue;
      if (!map[row.key]) map[row.key] = { value: row.value, updated_at: row.updated_at, note: row.note };
    }
    return NextResponse.json({ success: true, data: map });
  } catch (err) {
    console.error('Wealth manual GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    let body: { key?: unknown; value?: unknown; note?: unknown };
    try { body = await req.json(); }
    catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

    const { key, value, note } = body;
    const parsedValue = parseFloat(String(value));
    if (!key || value === undefined || value === null || isNaN(parsedValue)) {
      return NextResponse.json({ success: false, error: 'key and valid numeric value required' }, { status: 400 });
    }
    if (typeof key !== 'string' || key.startsWith('_')) {
      return NextResponse.json({ success: false, error: 'Invalid key' }, { status: 400 });
    }
    if (key.length > 100) {
      return NextResponse.json({ success: false, error: 'key too long (max 100 chars)' }, { status: 400 });
    }
    const noteStr = note != null ? String(note).slice(0, 500) : null;

    const { error } = await supabase
      .from('wealth_manual')
      .upsert(
        { user_id: user.id, key, value: parsedValue, note: noteStr, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );

    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Wealth manual POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
