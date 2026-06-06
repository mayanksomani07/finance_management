'use client';

import { useState } from 'react';
import type { Transaction } from '@/lib/supabase';

interface Props {
  transaction: Transaction;
  onDelete: (id: string) => void;
  deleting: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Need':                    { bg: 'rgba(255,165,0,0.15)',   text: '#ffa500' },
  'Want':                    { bg: 'rgba(255,107,107,0.15)', text: '#ff6b6b' },
  'Investment':              { bg: 'rgba(108,99,255,0.15)',  text: '#6c63ff' },
  'Monthly Payslip':         { bg: 'rgba(0,217,166,0.15)',   text: '#00d9a6' },
  'Interest':                { bg: 'rgba(0,191,255,0.15)',   text: '#00bfff' },
  'Money Back from Others':  { bg: 'rgba(180,180,255,0.15)', text: '#b4b4ff' },
};

function sourceIcon(source: string | null): string {
  switch (source?.toLowerCase()) {
    case 'sbi': return '🏦';
    case 'gpay': return '🔵';
    case 'mobikwik': return '👛';
    case 'neft': return '🔄';
    case 'manual': return '✏️';
    case 'email': return '📧';
    default: return '💳';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

export default function TransactionCard({ transaction: tx, onDelete, deleting }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="bg-[#1a1a2e] rounded-2xl p-4 border border-[#2a2a4a] flex items-center gap-3">
      {/* Source icon */}
      <div className="w-10 h-10 rounded-full bg-[#0f0f23] flex items-center justify-center text-xl flex-shrink-0">
        {sourceIcon(tx.source)}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {tx.description || 'Transaction'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {tx.category && (() => {
            const c = CATEGORY_COLORS[tx.category] ?? { bg: 'rgba(136,136,170,0.15)', text: '#8888aa' };
            return (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: c.bg, color: c.text }}>
                {tx.category}
              </span>
            );
          })()}
          <span className="text-[10px] text-[#8888aa]">{formatDate(tx.transaction_at)}</span>
        </div>
        {tx.account_last4 && (
          <span className="text-[10px] text-[#8888aa]">••••{tx.account_last4}</span>
        )}
      </div>

      {/* Amount & delete */}
      <div className="flex flex-col items-end gap-1">
        <span
          className="text-base font-bold"
          style={{ color: tx.type === 'income' ? '#00d9a6' : '#ff6b6b' }}
        >
          {tx.type === 'income' ? '+' : '-'}
          {formatAmount(Number(tx.amount))}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{
            background: tx.type === 'income' ? 'rgba(0,217,166,0.15)' : 'rgba(255,107,107,0.15)',
            color: tx.type === 'income' ? '#00d9a6' : '#ff6b6b',
          }}
        >
          {tx.type}
        </span>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-[10px] text-[#8888aa] hover:text-[#ff6b6b] transition-colors mt-1"
            aria-label="Delete"
          >
            ✕
          </button>
        ) : (
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => onDelete(tx.id)}
              disabled={deleting}
              className="text-[10px] text-[#ff6b6b] font-medium"
            >
              {deleting ? '...' : 'Del'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-[10px] text-[#8888aa]"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
