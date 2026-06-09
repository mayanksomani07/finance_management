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

  const { data: snapshot } = await supabase
    .from('balance_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single();

  if (!snapshot) {
    return NextResponse.json({ success: true, snapshot: null, computed: null, drift: null });
  }

  const { data: txAfter } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', user.id)
    .gte('created_at', snapshot.created_at);

  let delta = 0;
  for (const tx of txAfter ?? []) {
    if (tx.type === 'income') delta += Number(tx.amount);
    else delta -= Number(tx.amount);
  }

  const computed = Number(snapshot.actual_balance) + delta;

  return NextResponse.json({
    success: true,
    snapshot,
    computed: Math.round(computed * 100) / 100,
    delta: Math.round(delta * 100) / 100,
    tx_count: (txAfter ?? []).length,
  });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { actual_balance, note } = body;

  if (actual_balance == null || isNaN(Number(actual_balance))) {
    return NextResponse.json({ success: false, error: 'actual_balance required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('balance_snapshots')
    .insert({ user_id: user.id, actual_balance: Number(actual_balance), note: note ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, snapshot: data });
}
