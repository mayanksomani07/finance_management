'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const path = usePathname();

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
      <div className="flex max-w-lg mx-auto">
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
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, letterSpacing: '0.04em' }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
