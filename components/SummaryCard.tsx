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

export default function SummaryCard({ label, amount, color }: SummaryCardProps) {
  return (
    <div
      className="bg-[#1a1a2e] rounded-2xl p-3 border border-[#2a2a4a]"
      style={{ borderTop: `2px solid ${color}` }}
    >
      <p className="text-[10px] text-[#8888aa] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-base font-bold truncate" style={{ color }}>
        {amount < 0 ? '-' : ''}
        {formatAmount(amount)}
      </p>
    </div>
  );
}
