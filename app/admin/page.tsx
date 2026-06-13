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
  is_admin: boolean;
}

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google', github: 'GitHub', facebook: 'Facebook',
  linkedin_oidc: 'LinkedIn', email: 'Email',
};

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'google') return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
  if (provider === 'github') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#6e40c9">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
  if (provider === 'facebook') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
  if (provider === 'linkedin_oidc') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}

function formatJoinDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

function avatarGradient(email: string) {
  const p = [['#6366f1','#8b5cf6'],['#f59e0b','#f97316'],['#10b981','#14b8a6'],['#ef4444','#f43f5e'],['#3b82f6','#6366f1'],['#ec4899','#a855f7']];
  let h = 0;
  for (let i = 0; i < email.length; i++) h = email.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

function FinTrackLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id="ftl_admin" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#ftl_admin)"/>
      <rect x="8"  y="22" width="6" height="10" rx="1.5" fill="white" fillOpacity="0.5"/>
      <rect x="17" y="16" width="6" height="16" rx="1.5" fill="white" fillOpacity="0.75"/>
      <rect x="26" y="10" width="6" height="22" rx="1.5" fill="white"/>
      <polyline points="11,21 20,15 29,9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9"/>
      <circle cx="29" cy="9" r="2" fill="white"/>
    </svg>
  );
}

export default function AdminDashboard() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => { if (!loading && !isAdmin) router.replace('/'); }, [loading, isAdmin, router]);

  function fetchStats() {
    setFetching(true);
    setFetchError(null);
    fetch('/api/admin/stats').then(r => r.json())
      .then(d => { setKpis(d.kpis); setUsers(d.users); })
      .catch(err => { console.error('fetchStats error:', err); setFetchError('Failed to load stats. Please refresh.'); })
      .finally(() => setFetching(false));
  }

  useEffect(() => { if (!isAdmin) return; fetchStats(); }, [isAdmin]);

  async function handleRemoveUser(userId: string) {
    setRemovingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) fetchStats();
    } finally { setRemovingId(null); setConfirmId(null); }
  }

  if (loading || fetching) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {fetchError
          ? <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--expense)' }}>{fetchError}</p>
          : <><div className="animate-spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid var(--border)', borderTopColor: 'var(--accent)' }}/><p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text3)' }}>Loading…</p></>}
      </div>
    </div>
  );

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text)', paddingBottom: 80 }}>

      {/* ═══════════════════════════════════════
          NAVBAR — full width, matches app style
          ═══════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        left: 0, right: 0,
        backgroundColor: 'var(--nav-bg)',
        borderBottom: '1.5px solid var(--border)',
        boxShadow: '0 1px 24px rgba(0,0,0,0.10)',
      }}>
        <div style={{
          maxWidth: 720, margin: '0 auto',
          padding: '0 20px', height: 68,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FinTrackLogo size={38}/>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text)', lineHeight: 1 }}>
                  FinTrack
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.09em',
                  padding: '3px 8px', borderRadius: 6,
                  background: 'var(--accent-bg)', color: 'var(--accent)',
                  border: '1px solid var(--accent-border)', lineHeight: 1,
                }}>ADMIN</span>
              </div>
              <p className="admin-nav-email" style={{ fontSize: 11, marginTop: 3, lineHeight: 1, fontWeight: 500, letterSpacing: '0.01em' }}>
                {user?.email}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle/>
            <button
              onClick={() => setShowSignOutConfirm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 12,
                fontSize: 13, fontWeight: 600, lineHeight: 1,
                background: 'var(--bg2)', border: '1.5px solid var(--border)',
                color: 'var(--text2)', cursor: 'pointer',
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════
          PAGE CONTENT
          ═══════════════════ */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 0' }}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1, margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 5, fontWeight: 500 }}>
            Platform overview &amp; user management
          </p>
        </div>

        {/* ── KPI grid ── */}
        {kpis && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--text4)', marginBottom: 12 }}>
              Overview
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                { label: 'Total Users',   value: String(kpis.totalUsers),                  sub: 'registered',   bar: '#6366f1' },
                { label: 'New Users',     value: `+${kpis.newUsers}`,                      sub: 'this month',   bar: '#10b981' },
                { label: 'Active Users',  value: String(kpis.activeUsers),                 sub: 'last 30 days', bar: '#f59e0b' },
                { label: 'Transactions',  value: kpis.totalTransactions.toLocaleString(),  sub: 'total',        bar: '#3b82f6' },
              ] as const).map(c => (
                <div key={c.label} style={{
                  background: 'var(--card)', border: '1.5px solid var(--border)',
                  borderRadius: 20, padding: '16px 18px 18px',
                  boxShadow: 'var(--shadow-card)',
                }}>
                  <div style={{ width: 36, height: 3, borderRadius: 99, background: c.bar, marginBottom: 14 }}/>
                  <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }}>
                    {c.value}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 10, lineHeight: 1 }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginTop: 3 }}>
                    {c.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Users section ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--text4)', margin: 0 }}>
              Registered Users
            </p>
            <span style={{
              fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 99,
              background: 'var(--accent-bg)', color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
            }}>{users.length}</span>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <svg style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: 'var(--text4)',
            }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                paddingLeft: 40, paddingRight: 16, paddingTop: 11, paddingBottom: 11,
                borderRadius: 14, fontSize: 14, outline: 'none', fontWeight: 400,
                background: 'var(--card)', border: '1.5px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          {/* User cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredUsers.map(u => {
              const { date, time } = formatJoinDate(u.created_at);
              const [g1, g2] = avatarGradient(u.email);
              const initial = (u.name?.[0] ?? u.email[0]).toUpperCase();
              const isAdminUser = u.is_admin;
              const isConfirming = confirmId === u.id;
              const isRemoving = removingId === u.id;

              return (
                <div key={u.id} style={{
                  background: 'var(--card)', border: '1.5px solid var(--border)',
                  borderRadius: 20, padding: '14px 16px',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex', alignItems: 'flex-start', gap: 13,
                }}>

                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, ${g1}, ${g2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800, color: '#fff',
                    position: 'relative',
                  }}>
                    {initial}
                    {isAdminUser && (
                      <span style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--card)', border: '1.5px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Name / email / provider */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                        {u.name || '—'}
                      </span>
                      {isAdminUser && (
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                          padding: '3px 7px', borderRadius: 6, lineHeight: 1,
                          background: 'var(--accent-bg)', color: 'var(--accent)',
                          border: '1px solid var(--accent-border)',
                        }}>ADMIN</span>
                      )}
                    </div>
                    <p style={{
                      fontSize: 12, fontWeight: 400, color: 'var(--text3)',
                      marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {u.email}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 7,
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <ProviderIcon provider={u.provider}/>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>
                        {PROVIDER_LABEL[u.provider] ?? u.provider}
                      </span>
                    </div>
                  </div>

                  {/* Right column: txns · date · time · remove */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 10px', borderRadius: 99,
                      background: 'rgba(59,130,246,0.10)', color: '#3b82f6',
                      border: '1px solid rgba(59,130,246,0.22)',
                    }}>{u.tx_count} txns</span>

                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>{date}</p>
                      <p style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', lineHeight: 1.4, margin: 0 }}>{time}</p>
                    </div>

                    {!isAdminUser && (
                      isConfirming ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleRemoveUser(u.id)}
                            disabled={isRemoving}
                            style={{
                              fontSize: 12, fontWeight: 700,
                              padding: '5px 12px', borderRadius: 10, cursor: 'pointer',
                              background: 'rgba(239,68,68,0.10)', color: '#ef4444',
                              border: '1.5px solid rgba(239,68,68,0.30)',
                            }}>
                            {isRemoving ? '…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            style={{
                              fontSize: 12, fontWeight: 600,
                              padding: '5px 12px', borderRadius: 10, cursor: 'pointer',
                              background: 'var(--bg2)', color: 'var(--text2)',
                              border: '1.5px solid var(--border)',
                            }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(u.id)}
                          style={{
                            fontSize: 12, fontWeight: 600,
                            padding: '5px 12px', borderRadius: 10, cursor: 'pointer',
                            background: 'var(--bg2)', color: 'var(--text2)',
                            border: '1.5px solid var(--border)',
                          }}>
                          Remove
                        </button>
                      )
                    )}
                  </div>

                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 0', gap: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16,
                  background: 'var(--bg2)', border: '1.5px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text4)' }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>No users found</p>
                <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Try a different search term</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════
          SIGN-OUT BOTTOM SHEET
          ═══════════════════════ */}
      {showSignOutConfirm && (
        <div
          onClick={() => setShowSignOutConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 384,
              borderRadius: 24,
              padding: 24,
              background: 'var(--card)', border: '1px solid var(--border)',
              boxShadow: '0 8px 48px rgba(0,0,0,0.28)',
            }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, margin: '0 auto 16px',
              background: 'rgba(108,99,255,0.10)', border: '1.5px solid rgba(108,99,255,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', color: 'var(--text)', margin: '0 0 4px' }}>Sign out?</p>
            <p style={{ fontSize: 13, textAlign: 'center', color: 'var(--text3)', margin: '0 0 24px', fontWeight: 400 }}>
              You&apos;ll be returned to the login screen. Your data is safely saved.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 16, cursor: 'pointer',
                  fontSize: 14, fontWeight: 700,
                  background: 'var(--bg2)', color: 'var(--text2)',
                  border: '1.5px solid var(--border)',
                }}>
                Cancel
              </button>
              <button
                onClick={signOut}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 16, cursor: 'pointer',
                  fontSize: 14, fontWeight: 800, color: '#fff', border: 'none',
                  background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
                  boxShadow: '0 4px 16px rgba(108,99,255,0.35)',
                }}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
