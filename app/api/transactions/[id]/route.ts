import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, user } = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });

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
    const { supabase, user } = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    const updates = {
      ...(body.amount         !== undefined && { amount: body.amount }),
      ...(body.type           !== undefined && { type: body.type }),
      ...(body.category       !== undefined && { category: body.category }),
      ...(body.description    !== undefined && { description: body.description }),
      ...(body.transaction_at !== undefined && { transaction_at: body.transaction_at }),
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

    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    return NextResponse.json({ success: true, transaction: data });
  } catch (err) {
    console.error('Patch transaction error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
