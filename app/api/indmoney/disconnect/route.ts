import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = createServerClient();

  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data } = await db
    .from('wealth_manual')
    .select('key')
    .eq('user_id', user.id)
    .like('key', '_indmoney_%');
  const keys = (data ?? []).map(r => r.key);
  if (keys.length) {
    await db.from('wealth_manual').delete().eq('user_id', user.id).in('key', keys);
  }
  return NextResponse.json({ success: true, cleared: keys });
}
