import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

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
    if (!map[row.key]) map[row.key] = { value: row.value, updated_at: row.updated_at, note: row.note };
  }
  return NextResponse.json({ success: true, data: map });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { key, value, note } = body;
  if (!key || value === undefined) {
    return NextResponse.json({ success: false, error: 'key and value required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('wealth_manual')
    .upsert(
      { user_id: user.id, key, value: parseFloat(value), note: note ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    );

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
