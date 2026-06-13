import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 1000);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('transaction_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type === 'income' || type === 'expense') query = query.eq('type', type);
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) query = query.gte('transaction_at', fromDate.toISOString());
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        toDate.setDate(toDate.getDate() + 1);
        query = query.lt('transaction_at', toDate.toISOString());
      }
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

    return NextResponse.json({ success: true, transactions: data });
  } catch (err) {
    console.error('Transactions GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Transactions DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const body = await req.json();
    const { amount, type, category, description, transaction_at, source, account_last4 } = body as {
      amount?: number; type?: string; category?: string; description?: string;
      transaction_at?: string; source?: string; account_last4?: string;
    };

    if (!amount || typeof amount !== 'number' || amount <= 0)
      return NextResponse.json({ success: false, error: 'Valid amount is required' }, { status: 400 });
    if (type !== 'income' && type !== 'expense')
      return NextResponse.json({ success: false, error: 'type must be income or expense' }, { status: 400 });

    // Validate transaction_at — reject unparseable dates rather than storing garbage
    const txAt = transaction_at
      ? (() => { const d = new Date(transaction_at); return isNaN(d.getTime()) ? null : d.toISOString(); })()
      : new Date().toISOString();
    if (!txAt) return NextResponse.json({ success: false, error: 'Invalid transaction_at date' }, { status: 400 });

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        transaction_at: txAt,
        amount, type,
        category: category ? String(category).slice(0, 100) : null,
        description: description ? String(description).slice(0, 500) : null,
        source: source ? String(source).slice(0, 50) : 'manual',
        account_last4: account_last4 ? String(account_last4).slice(0, 4) : null,
        raw_text: null,
        balance_after: null,
      })
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    if (!data) return NextResponse.json({ success: false, error: 'Insert failed' }, { status: 500 });

    return NextResponse.json({ success: true, transaction: data }, { status: 201 });
  } catch (err) {
    console.error('Transactions POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
