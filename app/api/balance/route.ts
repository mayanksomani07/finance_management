import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const { data: snapshot, error: snapshotError } = await supabase
      .from('balance_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshotError) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

    if (!snapshot) {
      return NextResponse.json({ success: true, snapshot: null, computed: null, drift: null });
    }

    const { data: txAfter } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', user.id)
      .gte('transaction_at', snapshot.snapshot_at);

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
  } catch (err) {
    console.error('Balance GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    let body: { actual_balance?: unknown; note?: unknown };
    try { body = await req.json(); }
    catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }
    const { actual_balance, note } = body;

    if (actual_balance == null || isNaN(Number(actual_balance))) {
      return NextResponse.json({ success: false, error: 'actual_balance required' }, { status: 400 });
    }

    const noteStr = note != null ? String(note).slice(0, 500) : null;
    const { data, error } = await supabase
      .from('balance_snapshots')
      .insert({ user_id: user.id, snapshot_at: new Date().toISOString(), actual_balance: Number(actual_balance), note: noteStr })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, snapshot: data });
  } catch (err) {
    console.error('Balance POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
