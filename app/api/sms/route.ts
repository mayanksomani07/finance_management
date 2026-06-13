import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { parseSMS } from '@/lib/sms-parser';
import { createAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sms_text, api_key, user_id } = body as { sms_text?: string; api_key?: string; user_id?: string };

    // Validate API key
    const secret = process.env.API_SECRET_KEY ?? '';
    const keyMatch = secret.length > 0 &&
      !!api_key &&
      api_key.length === secret.length &&
      crypto.timingSafeEqual(Buffer.from(api_key), Buffer.from(secret));
    if (!keyMatch) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!sms_text || typeof sms_text !== 'string') {
      return NextResponse.json({ success: false, error: 'sms_text is required' }, { status: 400 });
    }
    if (sms_text.length > 2000) {
      return NextResponse.json({ success: false, error: 'sms_text too long (max 2000 chars)' }, { status: 400 });
    }

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ success: false, error: 'user_id is required' }, { status: 400 });
    }

    // Restrict user_id to the configured owner(s) — this endpoint uses a shared
    // API key so we must not allow arbitrary user_id injection.
    // Fails closed: if SMS_WEBHOOK_ALLOWED_EMAILS is not set, all requests are rejected.
    const allowedEmails = (process.env.SMS_WEBHOOK_ALLOWED_EMAILS ?? '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    if (allowedEmails.length === 0) {
      return NextResponse.json({ success: false, error: 'Webhook not configured — set SMS_WEBHOOK_ALLOWED_EMAILS' }, { status: 503 });
    }

    const supabase = createAdminClient();

    // Verify user_id belongs to a real auth user before inserting
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(user_id);
    if (authErr || !authUser?.user) {
      return NextResponse.json({ success: false, error: 'Invalid user_id' }, { status: 400 });
    }

    // Scope check: only allow injecting for whitelisted email owners
    if (!allowedEmails.includes((authUser.user.email ?? '').toLowerCase())) {
      return NextResponse.json({ success: false, error: 'user_id not permitted for this endpoint' }, { status: 403 });
    }

    const parsed = parseSMS(sms_text);

    if (!parsed.amount || parsed.amount <= 0) {
      return NextResponse.json({ success: false, error: 'Could not parse a valid amount from SMS' }, { status: 422 });
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: authUser.user.id,
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
