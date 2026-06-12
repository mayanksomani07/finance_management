import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('wealth_manual')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const map: Record<string, { value: number; updated_at: string; note?: string }> = {};
  for (const row of data ?? []) {
    // Skip internal OAuth/token keys — not meant for client consumption
    if (row.key.startsWith('_')) continue;
    if (!map[row.key]) map[row.key] = { value: row.value, updated_at: row.updated_at, note: row.note };
  }
  return NextResponse.json({ success: true, data: map });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { key, value, note } = body;
  const parsedValue = parseFloat(value);
  if (!key || value === undefined || value === null || isNaN(parsedValue)) {
    return NextResponse.json({ success: false, error: 'key and valid numeric value required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('wealth_manual')
    .upsert(
      { user_id: user.id, key, value: parsedValue, note: note ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    );

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
