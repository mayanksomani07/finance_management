import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const supabase = createServerClient();
    const { error } = await supabase.from('transactions').delete().eq('id', id);
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
    const { id } = params;
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const body = await req.json() as {
      amount?: number; type?: string; category?: string;
      description?: string; transaction_at?: string;
    };

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('transactions')
      .update({
        ...(body.amount        !== undefined && { amount: body.amount }),
        ...(body.type          !== undefined && { type: body.type }),
        ...(body.category      !== undefined && { category: body.category }),
        ...(body.description   !== undefined && { description: body.description }),
        ...(body.transaction_at !== undefined && { transaction_at: body.transaction_at }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    return NextResponse.json({ success: true, transaction: data });
  } catch (err) {
    console.error('Patch transaction error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
