import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const { id } = params;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const { error, count } = await supabase
      .from('transactions')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    if (!count || count === 0) return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete transaction error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthUser();
    if (!auth) return unauthorized();
    const { supabase, user } = auth;

    const { id } = params;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const body = await req.json() as {
      amount?: number; type?: string; category?: string;
      description?: string; transaction_at?: string;
    };

    if (body.amount !== undefined) {
      if (typeof body.amount !== 'number' || body.amount <= 0)
        return NextResponse.json({ success: false, error: 'Valid amount is required' }, { status: 400 });
    }
    if (body.type !== undefined && body.type !== 'income' && body.type !== 'expense') {
      return NextResponse.json({ success: false, error: 'type must be income or expense' }, { status: 400 });
    }

    let patchTxAt: string | undefined;
    if (body.transaction_at !== undefined) {
      const d = new Date(body.transaction_at);
      if (isNaN(d.getTime())) return NextResponse.json({ success: false, error: 'Invalid transaction_at date' }, { status: 400 });
      patchTxAt = d.toISOString();
    }

    const updates = {
      ...(body.amount         !== undefined && { amount: body.amount }),
      ...(body.type           !== undefined && { type: body.type }),
      ...(body.category       !== undefined && { category: body.category ? String(body.category).slice(0, 100) : null }),
      ...(body.description    !== undefined && { description: body.description ? String(body.description).slice(0, 500) : null }),
      ...(patchTxAt           !== undefined && { transaction_at: patchTxAt }),
    };

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
    return NextResponse.json({ success: true, transaction: data });
  } catch (err) {
    console.error('Patch transaction error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
