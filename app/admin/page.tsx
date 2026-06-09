'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ThemeToggle from '@/components/ThemeToggle';

interface KPIs {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  totalTransactions: number;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  provider: string;
  created_at: string;
  tx_count: number;
}

const PROVIDER_ICON: Record<string, string> = {
  google: '🇬', github: '🐙', facebook: '📘', linkedin_oidc: '💼', email: '📧',
};

export default function AdminDashboard() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'admin@gmail.com';

  useEffect(() => {
    if (!loading && !isAdmin) router.replace('/');
  }, [loading, isAdmin]);

  function fetchStats() {
    setFetching(true);
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setKpis(d.kpis); setUsers(d.users); })
      .finally(() => setFetching(false));
  }

  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();
  }, [isAdmin]);

  async function handleRemoveUser(userId: string) {
    setRemovingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        fetchStats();
      }
    } finally {
      setRemovingId(null);
      setConfirmId(null);
    }
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading admin panel…</div>
      </div>
    );
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={signOut}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* KPI Cards */}
        {kpis && (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Platform KPIs
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Total Users" value={kpis.totalUsers.toString()} icon="👥" />
              <KpiCard label="New (30d)" value={kpis.newUsers.toString()} icon="🆕" />
              <KpiCard label="Active Users (30d)" value={kpis.activeUsers.toString()} icon="⚡" />
              <KpiCard label="Total Transactions" value={kpis.totalTransactions.toLocaleString()} icon="🔢" />
            </div>
          </>
        )}

        {/* Users Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Registered Users ({users.length})
            </h2>
          </div>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none mb-3"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <div className="space-y-2">
            {filteredUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: 'var(--bg)' }}>
                  {u.name?.[0]?.toUpperCase() ?? u.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name || '—'}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="text-xs font-medium">{u.tx_count} txns</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {PROVIDER_ICON[u.provider] ?? '🔑'} {new Date(u.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'2-digit' })}
                  </p>
                  {u.email !== ADMIN_EMAIL && (
                    confirmId === u.id ? (
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => handleRemoveUser(u.id)}
                          disabled={removingId === u.id}
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                        >
                          {removingId === u.id ? 'Removing…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(u.id)}
                        className="text-xs px-2 py-0.5 rounded mt-1"
                        style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        Remove
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No users found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
