import { NextRequest, NextResponse } from 'next/server';
import { parseSMS } from '@/lib/sms-parser';
import { createAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sms_text, api_key, user_id } = body as { sms_text?: string; api_key?: string; user_id?: string };

    // Validate API key
    if (!api_key || api_key !== process.env.API_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!sms_text || typeof sms_text !== 'string') {
      return NextResponse.json({ success: false, error: 'sms_text is required' }, { status: 400 });
    }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify user_id belongs to a real auth user before inserting
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(user_id);
    if (authErr || !authUser?.user) {
      return NextResponse.json({ success: false, error: 'Invalid user_id' }, { status: 400 });
    }

    const parsed = parseSMS(sms_text);

    if (!parsed.amount || parsed.amount <= 0) {
      return NextResponse.json({ success: false, error: 'Could not parse a valid amount from SMS' }, { status: 422 });
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id,
        transaction_at: parsed.transaction_at.toISOString(),
        amount: parsed.amount,
        type: parsed.type,
        source: parsed.source === 'unknown' ? 'sms' : parsed.source,
        description: parsed.description,
        raw_text: sms_text,
        account_last4: parsed.account_last4,
        balance_after: parsed.balance_after,
        category: null,
      })
      .select()
      .single();

    if (error) {
      console.error('DB error:', error);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, transaction: data });
  } catch (err) {
    console.error('SMS route error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
