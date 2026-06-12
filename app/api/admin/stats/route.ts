import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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
  const { count: txCount, error: txCountError } = await admin
    .from('transactions')
    .select('*', { count: 'exact', head: true });
  if (txCountError) console.error('[admin/stats] txCount error:', txCountError);

  // Active users: distinct users who added a transaction in last 30 days (by row created_at, not transaction date)
  const { data: activeData, error: activeError } = await admin
    .from('transactions')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo.toISOString());
  if (activeError) console.error('[admin/stats] activeData error:', activeError);
  const activeUsers = new Set(activeData?.map(r => r.user_id)).size;

  // User list — email + signup date + transaction count (no amounts, no descriptions)
  const userList = (authUsers?.users ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '—',
    name: (u.user_metadata?.full_name ?? u.user_metadata?.name ?? '—') as string,
    provider: (u.app_metadata?.provider ?? 'email') as string,
    created_at: u.created_at,
  }));

  // Per-user transaction count only (no amounts — privacy). Fetch all pages.
  let perUserCounts: { user_id: string }[] = [];
  {
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await admin
        .from('transactions')
        .select('user_id')
        .range(from, from + PAGE - 1);
      if (error) { console.error('[admin/stats] perUserCounts error:', error); break; }
      if (!data || data.length === 0) break;
      perUserCounts = perUserCounts.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
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
