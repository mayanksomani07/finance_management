import { NextRequest, NextResponse } from 'next/server';
import { parseSMS } from '@/lib/sms-parser';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, body: emailBody, api_key } = body as {
      subject?: string;
      body?: string;
      api_key?: string;
    };

    // Validate API key
    if (!api_key || api_key !== process.env.API_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!emailBody || typeof emailBody !== 'string') {
      return NextResponse.json({ success: false, error: 'body is required' }, { status: 400 });
    }

    // Use the combined subject + body text for parsing
    const fullText = subject ? `${subject}\n${emailBody}` : emailBody;
    const parsed = parseSMS(fullText);

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        transaction_at: parsed.transaction_at.toISOString(),
        amount: parsed.amount,
        type: parsed.type,
        source: parsed.source === 'unknown' ? 'email' : parsed.source,
        description: parsed.description,
        raw_text: fullText,
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
    console.error('Email route error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
