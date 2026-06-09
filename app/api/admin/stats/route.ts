import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getCallerEmail(): Promise<string | null> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export async function GET(_req: NextRequest) {
  const email = await getCallerEmail();
  if (email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Total registered users (from auth.users via service key)
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const totalUsers = authUsers?.users?.length ?? 0;

  // Users who signed up in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newUsers = authUsers?.users?.filter(u =>
    new Date(u.created_at) >= thirtyDaysAgo
  ).length ?? 0;

  // Transaction count only — no amounts
  const { count: txCount } = await admin
    .from('transactions')
    .select('*', { count: 'exact', head: true });

  // Active users (had a transaction in last 30 days) — just the count
  const { data: activeData } = await admin
    .from('transactions')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo.toISOString());
  const activeUsers = new Set(activeData?.map(r => r.user_id)).size;

  // User list — email + signup date + transaction count (no amounts, no descriptions)
  const userList = (authUsers?.users ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '—',
    name: (u.user_metadata?.full_name ?? u.user_metadata?.name ?? '—') as string,
    provider: (u.app_metadata?.provider ?? 'email') as string,
    created_at: u.created_at,
  }));

  // Per-user transaction count only (no amounts — privacy)
  const { data: perUserCounts } = await admin
    .from('transactions')
    .select('user_id');
  const countMap: Record<string, number> = {};
  perUserCounts?.forEach(r => {
    countMap[r.user_id] = (countMap[r.user_id] ?? 0) + 1;
  });

  const enrichedUsers = userList.map(u => ({
    ...u,
    tx_count: countMap[u.id] ?? 0,
  }));

  return NextResponse.json({
    kpis: {
      totalUsers,
      newUsers,
      activeUsers,
      totalTransactions: txCount ?? 0,
    },
    users: enrichedUsers,
  });
}
