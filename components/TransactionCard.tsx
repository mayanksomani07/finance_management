'use client';

import { useState } from 'react';
import type { Transaction } from '@/lib/supabase';

interface Props {
  transaction: Transaction;
  onDelete: (id: string) => void;
  deleting: boolean;
}

const CATEGORY_META: Record<string, { bg: string; text: string; dot: string }> = {
  'Need':                   { bg: 'rgba(245,158,11,0.1)',   text: '#d97706',  dot: '#f59e0b' },
  'Want':                   { bg: 'rgba(239,68,68,0.1)',    text: '#dc2626',  dot: '#ef4444' },
  'Investment':             { bg: 'rgba(79,70,229,0.1)',    text: '#4f46e5',  dot: '#6366f1' },
  'Monthly Payslip':        { bg: 'rgba(13,146,104,0.1)',   text: '#0d9268',  dot: '#10d9a0' },
  'Interest':               { bg: 'rgba(14,165,233,0.1)',   text: '#0284c7',  dot: '#0ea5e9' },
  'Money Back from Others': { bg: 'rgba(139,92,246,0.1)',   text: '#7c3aed',  dot: '#a78bfa' },
};

const SOURCE_LABEL: Record<string, string> = {
  sbi: 'Bank', bank: 'Bank', gpay: 'GPay', mobikwik: 'MobiKwik', neft: 'NEFT', manual: 'Manual', email: 'Email',
};

function sourceIcon(source: string | null): string {
  switch (source?.toLowerCase()) {
    case 'sbi':
    case 'bank': return '🏦';
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
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function TransactionCard({ transaction: tx, onDelete, deleting }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isIncome = tx.type === 'income';
  const amtColor = isIncome ? 'var(--income)' : 'var(--expense)';
  const cat = tx.category ? (CATEGORY_META[tx.category] ?? { bg: 'rgba(136,136,170,0.1)', text: 'var(--text3)', dot: 'var(--muted)' }) : null;

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3"
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: isIncome ? 'rgba(13,146,104,0.1)' : 'rgba(192,57,43,0.1)' }}
      >
        {sourceIcon(tx.source)}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
          {tx.description || 'Transaction'}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {cat && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{ background: cat.bg, color: cat.text }}
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: cat.dot }} />
              {tx.category}
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--text4)' }}>{formatDate(tx.transaction_at)}</span>
          {tx.account_last4 && (
            <span className="text-[10px]" style={{ color: 'var(--text4)' }}>••{tx.account_last4}</span>
          )}
        </div>
      </div>

      {/* Amount & actions */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[15px] font-extrabold" style={{ color: amtColor }}>
          {isIncome ? '+' : '-'}{formatAmount(Number(tx.amount))}
        </span>
        <span
          className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
          style={{
            background: isIncome ? 'rgba(13,146,104,0.1)' : 'rgba(192,57,43,0.1)',
            color: amtColor,
          }}
        >
          {tx.type}
        </span>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-[11px] mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text4)', background: 'var(--bg2)' }}
            aria-label="Delete"
          >
            ✕
          </button>
        ) : (
          <div className="flex gap-1.5 mt-0.5">
            <button
              onClick={() => onDelete(tx.id)}
              disabled={deleting}
              className="text-[10px] px-2 py-0.5 rounded-lg font-semibold"
              style={{ color: '#fff', background: 'var(--expense)' }}
            >
              {deleting ? '…' : 'Del'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-[10px] px-2 py-0.5 rounded-lg font-semibold"
              style={{ color: 'var(--text3)', background: 'var(--bg2)' }}
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
