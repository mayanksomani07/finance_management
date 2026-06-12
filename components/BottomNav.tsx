'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { isWealthUser } from '@/lib/users';

export default function BottomNav() {
  const path = usePathname();
  const { user, isAdmin, signOut } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);

  // Close confirm sheet whenever page changes or user logs out
  useEffect(() => { setShowConfirm(false); }, [path, user]);

  if (!user || path === '/login' || path === '/reset-password' || isAdmin) return null;

  // Non-wealth users get no bottom nav — sign out lives in the page header
  if (!isWealthUser(user.email)) return null;

  const tabs = [
    {
      href: '/',
      label: 'Transactions',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="M9 12h6M9 16h4"/>
        </svg>
      ),
    },
    {
      href: '/wealth',
      label: 'Wealth',
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          backgroundColor: 'var(--nav-bg)',
          borderTop: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 -2px 24px rgba(0,0,0,0.15)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex max-w-4xl mx-auto">
          {tabs.map(({ href, label, icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 pt-3 pb-3 flex flex-col items-center gap-1.5 transition-all active:scale-95"
                style={{ color: active ? 'var(--accent)' : 'var(--text4)' }}
              >
                <div
                  className="rounded-2xl px-5 py-1.5 transition-all"
                  style={active
                    ? { background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }
                    : {}}
                >
                  {icon(active)}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, letterSpacing: '0.04em' }}>
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Sign out tab — same visual weight as the other tabs */}
          <button
            onClick={() => setShowConfirm(true)}
            className="flex-1 pt-3 pb-3 flex flex-col items-center gap-1.5 transition-all active:scale-95"
            style={{ color: 'var(--text4)' }}
          >
            <div className="rounded-2xl px-5 py-1.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>Sign out</span>
          </button>
        </div>
      </nav>

      {/* Sign-out confirmation sheet */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl p-6"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: '0 -16px 64px rgba(0,0,0,0.35)',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(108,99,255,0.10)', border: '1.5px solid rgba(108,99,255,0.22)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <h3 className="text-base font-extrabold text-center mb-1" style={{ color: 'var(--text)' }}>
              Sign out?
            </h3>
            <p className="text-xs text-center mb-6" style={{ color: 'var(--text3)' }}>
              You'll be returned to the login screen. Your data is safely saved.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1.5px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={signOut}
                className="flex-1 py-3 rounded-2xl text-sm font-extrabold transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, var(--accent), #8b5cf6)', color: '#fff', boxShadow: '0 4px 16px rgba(108,99,255,0.35)' }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
