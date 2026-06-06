'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex z-50 safe-bottom"
      style={{
        backgroundColor: 'var(--nav-bg)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
      }}
    >
      {[
        {
          href: '/',
          label: 'Transactions',
          icon: (active: boolean) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
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
      ].map(({ href, label, icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 py-3.5 flex flex-col items-center gap-1 transition-colors"
            style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
          >
            <div
              className="rounded-xl px-4 py-1 transition-all"
              style={active ? { background: 'rgba(79,70,229,0.12)' } : {}}
            >
              {icon(active)}
            </div>
            <span className="text-[10px] font-bold tracking-wide">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
