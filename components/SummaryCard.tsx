'use client';

interface SummaryCardProps {
  label: string;
  amount: number;
  color: string;
}

function formatAmount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(abs / 1000).toFixed(1)}K`;
  return `₹${abs.toFixed(0)}`;
}

const ICONS: Record<string, React.ReactNode> = {
  Income: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
    </svg>
  ),
  Expense: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
    </svg>
  ),
  Savings: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
};

export default function SummaryCard({ label, amount, color }: SummaryCardProps) {
  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-2"
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{ICONS[label]}</span>
        <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text3)' }}>{label}</p>
      </div>
      <p className="text-[15px] font-extrabold truncate leading-tight" style={{ color }}>
        {amount < 0 ? '-' : ''}{formatAmount(amount)}
      </p>
    </div>
  );
}
