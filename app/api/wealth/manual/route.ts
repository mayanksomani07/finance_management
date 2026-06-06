import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET: return latest snapshot for each key
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('wealth_manual')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Return as key → record map (latest per key)
  const map: Record<string, { value: number; updated_at: string; note?: string }> = {};
  for (const row of data ?? []) {
    if (!map[row.key]) map[row.key] = { value: row.value, updated_at: row.updated_at, note: row.note };
  }
  return NextResponse.json({ success: true, data: map });
}

// POST: upsert a manual wealth entry
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, value, note } = body;
  if (!key || value === undefined) {
    return NextResponse.json({ success: false, error: 'key and value required' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('wealth_manual')
    .upsert({ key, value: parseFloat(value), note: note ?? null, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
