import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/balance — returns latest snapshot + reconciliation
export async function GET() {
  const supabase = createServerClient();

  // Latest snapshot
  const { data: snapshot } = await supabase
    .from('balance_snapshots')
    .select('*')
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single();

  if (!snapshot) {
    return NextResponse.json({ success: true, snapshot: null, computed: null, drift: null });
  }

  // Sum all transactions created (inserted) on or after the snapshot was saved.
  // Use created_at not transaction_at — so manually back-dated entries are still counted.
  const { data: txAfter } = await supabase
    .from('transactions')
    .select('amount, type')
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

// POST /api/balance — save a new snapshot
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { actual_balance, note } = body;

  if (actual_balance == null || isNaN(Number(actual_balance))) {
    return NextResponse.json({ success: false, error: 'actual_balance required' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('balance_snapshots')
    .insert({ actual_balance: Number(actual_balance), note: note ?? null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, snapshot: data });
}
