'use client';

import { useState, useRef, useEffect } from 'react';
import type { Transaction } from '@/lib/supabase';

const EXPENSE_CATEGORIES = [
  { value: 'Need',       label: 'Need',       emoji: '🧾', hint: 'Rent, groceries, bills, medicine' },
  { value: 'Want',       label: 'Want',       emoji: '🛍️', hint: 'Dining out, shopping, entertainment' },
  { value: 'Investment', label: 'Investment', emoji: '📈', hint: 'SIP, stocks, FD, insurance' },
];

const INCOME_CATEGORIES = [
  { value: 'Monthly Payslip',        label: 'Payslip',   emoji: '💼', hint: 'Salary / freelance payout' },
  { value: 'Interest',               label: 'Interest',  emoji: '🏦', hint: 'FD interest, savings interest' },
  { value: 'Money Back from Others', label: 'Money Back',emoji: '🤝', hint: 'UPI repayments, reimbursements' },
];

interface Props {
  onClose: () => void;
  onAdded: (tx: Transaction) => void;
}

export default function AddTransactionModal({ onClose, onAdded }: Props) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('Need');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => { amountRef.current?.focus(); }, []);
  useEffect(() => { setCategory(type === 'expense' ? 'Need' : 'Monthly Payslip'); }, [type]);

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const typeColor = type === 'income' ? 'var(--income)' : 'var(--expense)';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { setError('Please enter a valid amount.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount, type, category,
          description: description.trim() || null,
          transaction_at: new Date(date).toISOString(),
          source: 'manual',
        }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Failed to save.'); return; }
      onAdded(json.transaction);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 -8px 48px rgba(0,0,0,0.2)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Type toggle + close */}
        <div className="px-5 pb-4 flex items-center gap-3">
          <div className="flex flex-1 p-1 rounded-2xl" style={{ backgroundColor: 'var(--bg2)' }}>
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={type === t
                  ? { backgroundColor: t === 'income' ? 'var(--income)' : 'var(--expense)', color: '#fff', boxShadow: `0 2px 8px ${t === 'income' ? 'rgba(16,217,160,0.3)' : 'rgba(244,91,91,0.3)'}` }
                  : { color: 'var(--text3)' }
                }
              >
                {t === 'income' ? 'Income' : 'Expense'}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
            style={{ background: 'var(--bg2)', color: 'var(--text3)' }}
          >✕</button>
        </div>

        <div className="px-5 pb-8 space-y-4 overflow-y-auto max-h-[75vh]">

          {/* Amount — hero */}
          <div
            className="rounded-2xl px-5 pt-6 pb-7 flex flex-col items-center"
            style={{ backgroundColor: 'var(--bg2)' }}
          >
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-4" style={{ color: 'var(--text4)' }}>
              {type === 'income' ? 'Income Amount' : 'Expense Amount'}
            </p>
            <div className="flex items-baseline justify-center gap-0" style={{ lineHeight: 1 }}>
              <span
                className="font-bold select-none"
                style={{ fontSize: '2.25rem', lineHeight: 1, color: typeColor, opacity: 0.85, paddingRight: '3px' }}
              >
                ₹
              </span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="bg-transparent font-bold focus:outline-none"
                style={{
                  fontSize: '2.25rem',
                  lineHeight: 1,
                  color: 'var(--text)',
                  width: `${Math.max(2, (amount || '0').length + 0.5)}ch`,
                  minWidth: '2ch',
                  maxWidth: '100%',
                  caretColor: typeColor,
                }}
                required
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text4)' }}>Category</p>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className="flex flex-col items-center gap-1 px-2 py-3 rounded-2xl text-center transition-all active:scale-95"
                  style={category === c.value
                    ? { backgroundColor: 'var(--bg2)', outline: `2px solid ${typeColor}`, outlineOffset: '-1px' }
                    : { backgroundColor: 'var(--bg2)', outline: '1.5px solid var(--border)', outlineOffset: '-1px' }
                  }
                >
                  <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{c.emoji}</span>
                  <p className="text-xs font-bold mt-1" style={{ color: category === c.value ? typeColor : 'var(--text)' }}>{c.label}</p>
                  <p className="text-[9px] leading-snug" style={{ color: 'var(--text4)' }}>{c.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text4)' }}>
              Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </p>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--bg2)', color: 'var(--text)' }}
            />
          </div>

          {/* Date */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text4)' }}>Date & Time</p>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--bg2)', color: 'var(--text)' }}
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-xl font-medium" style={{ color: 'var(--expense)', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)' }}>{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-3.5 px-5 rounded-2xl font-semibold text-sm active:scale-95 transition-all"
              style={{ color: 'var(--text3)', background: 'var(--bg2)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !amount}
              className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
              style={{ background: type === 'income' ? 'var(--income)' : 'var(--expense)', boxShadow: `0 4px 16px ${type === 'income' ? 'rgba(16,217,160,0.3)' : 'rgba(244,91,91,0.3)'}` }}
            >
              {loading ? 'Saving…' : `Save ${type === 'income' ? 'Income' : 'Expense'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
