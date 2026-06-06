'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const path = usePathname();
  const active = 'text-[#6c63ff]';
  const inactive = 'text-[#8888aa]';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] border-t border-[#2a2a4a] flex z-50 safe-area-bottom">
      <Link
        href="/"
        className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${path === '/' ? active : inactive}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        <span className="text-[10px] font-medium">Transactions</span>
      </Link>
      <Link
        href="/wealth"
        className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${path === '/wealth' ? active : inactive}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span className="text-[10px] font-medium">Wealth</span>
      </Link>
    </nav>
  );
}
