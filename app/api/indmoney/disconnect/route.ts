import { NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth-server';
import { isWealthUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return unauthorized();
  const { user, supabase } = auth;
  if (!isWealthUser(user.email)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { data } = await supabase
    .from('wealth_manual')
    .select('key')
    .eq('user_id', user.id)
    .like('key', '_indmoney_%');
  const keys = (data ?? []).map(r => r.key);
  if (keys.length) {
    await supabase.from('wealth_manual').delete().eq('user_id', user.id).in('key', keys);
  }
  return NextResponse.json({ success: true, cleared: keys });
}
