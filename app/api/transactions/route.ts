import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function getUser() {
  // createServerClient uses cookies() internally — works in route handlers
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('transaction_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type === 'income' || type === 'expense') query = query.eq('type', type);
    if (from) query = query.gte('transaction_at', from);
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt('transaction_at', toDate.toISOString());
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
    const { supabase, user } = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const { supabase, user } = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { amount, type, category, description, transaction_at, source, account_last4 } = body as {
      amount?: number; type?: string; category?: string; description?: string;
      transaction_at?: string; source?: string; account_last4?: string;
    };

    if (!amount || typeof amount !== 'number' || amount <= 0)
      return NextResponse.json({ success: false, error: 'Valid amount is required' }, { status: 400 });
    if (type !== 'income' && type !== 'expense')
      return NextResponse.json({ success: false, error: 'type must be income or expense' }, { status: 400 });

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        transaction_at: transaction_at || new Date().toISOString(),
        amount, type,
        category: category || null,
        description: description || null,
        source: source || 'manual',
        account_last4: account_last4 || null,
        raw_text: null,
        balance_after: null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

    return NextResponse.json({ success: true, transaction: data }, { status: 201 });
  } catch (err) {
    console.error('Transactions POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
