import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = createServerClient();
  // Delete all indmoney keys regardless of env prefix
  const { data } = await db.from('wealth_manual').select('key').like('key', '_indmoney_%');
  const keys = (data ?? []).map(r => r.key);
  if (keys.length) await db.from('wealth_manual').delete().in('key', keys);
  return NextResponse.json({ success: true, cleared: keys });
}
