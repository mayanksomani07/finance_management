'use client';

import { useState, useRef, useEffect } from 'react';
import type { LocalTransaction } from '@/lib/localStore';

const EXPENSE_SUBCATS = [
  { value: 'PG Rent',           main: 'Need',       emoji: '🏠', label: 'PG Rent' },
  { value: 'Health',            main: 'Need',       emoji: '💊', label: 'Health' },
  { value: 'Recharge',          main: 'Need',       emoji: '📱', label: 'Recharge' },
  { value: 'Mess Bill',         main: 'Need',       emoji: '🍱', label: 'Mess Bill' },
  { value: 'Education',         main: 'Need',       emoji: '📚', label: 'Education' },
  { value: 'Home',              main: 'Need',       emoji: '🏡', label: 'Home' },
  { value: 'Donation',          main: 'Need',       emoji: '🤝', label: 'Donation' },
  { value: 'Washing',           main: 'Need',       emoji: '👕', label: 'Washing' },
  { value: 'Xerox',             main: 'Need',       emoji: '📄', label: 'Xerox' },
  { value: 'Interest',          main: 'Need',       emoji: '💹', label: 'Interest' },
  { value: 'Food',              main: 'Want',       emoji: '🍽️', label: 'Food' },
  { value: 'Groceries',         main: 'Want',       emoji: '🛒', label: 'Groceries' },
  { value: 'Transportation',    main: 'Want',       emoji: '🚌', label: 'Transport' },
  { value: 'Leisure',           main: 'Want',       emoji: '🎮', label: 'Leisure' },
  { value: 'Gifts',             main: 'Want',       emoji: '🎁', label: 'Gifts' },
  { value: 'Other',             main: 'Want',       emoji: '📋', label: 'Other' },
  { value: 'Investment',        main: 'Investment', emoji: '📈', label: 'Investment' },
  { value: 'Investment (Debt)', main: 'Investment', emoji: '🏦', label: 'Invest (Debt)' },
];

const INCOME_SUBCATS = [
  { value: 'Paycheck',    emoji: '💰', label: 'Payslip' },
  { value: 'Interest',    emoji: '💹', label: 'Interest' },
  { value: 'Money Back',  emoji: '↩️', label: 'Money Back' },
  { value: 'Gift',        emoji: '🎁', label: 'Gift' },
];

const MAIN_COLORS: Record<string, string> = {
  Need: '#f59e0b', Want: '#ef4444', Investment: '#6366f1',
};

interface Props {
  transaction: LocalTransaction;
  onClose: () => void;
  onSaved: (updated: LocalTransaction) => void;
}

export default function EditTransactionModal({ transaction, onClose, onSaved }: Props) {
  const [amount, setAmount]   = useState(String(transaction.amount));
  const [type, setType]       = useState<'income' | 'expense'>(transaction.type);
  const [subCat, setSubCat]   = useState(transaction.category);
  const [comment, setComment] = useState(transaction.comment);
  const [date, setDate]       = useState(transaction.date.slice(0, 10));
  const [error, setError]     = useState('');

  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => { amountRef.current?.focus(); }, []);

  const typeColor = type === 'income' ? 'var(--income)' : 'var(--expense)';

  const grouped = type === 'expense'
    ? [
        { main: 'Need',       items: EXPENSE_SUBCATS.filter(s => s.main === 'Need') },
        { main: 'Want',       items: EXPENSE_SUBCATS.filter(s => s.main === 'Want') },
        { main: 'Investment', items: EXPENSE_SUBCATS.filter(s => s.main === 'Investment') },
      ]
    : [{ main: 'Income', items: INCOME_SUBCATS.map(s => ({ ...s, main: 'Income' })) }];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { setError('Enter a valid amount.'); return; }

    const updated: LocalTransaction = {
      ...transaction,
      amount: parsedAmount,
      type,
      category: subCat,
      comment: comment.trim(),
      date: date + 'T00:00:00',
    };

    onSaved(updated);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 -8px 48px rgba(0,0,0,0.25)' }}
      >
        {/* Handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-5 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--text4)' }}>Edit Transaction</p>
          </div>
          <div className="flex p-1 rounded-2xl" style={{ backgroundColor: 'var(--bg2)' }}>
            {(['expense', 'income'] as const).map(t => (
              <button key={t} type="button" onClick={() => { setType(t); setSubCat(t === 'expense' ? 'Food' : 'Paycheck'); }}
                className="py-2 px-4 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={type === t
                  ? { backgroundColor: t === 'income' ? 'var(--income)' : 'var(--expense)', color: '#fff' }
                  : { color: 'var(--text3)' }}>
                {t === 'income' ? 'Income' : 'Expense'}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 pb-8 space-y-4 overflow-y-auto max-h-[78vh]">

            {/* Amount */}
            <div className="rounded-2xl px-5 pt-5 pb-6 flex flex-col items-center"
              style={{ backgroundColor: 'var(--bg2)' }}>
              <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--text4)' }}>
                Amount (₹)
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold" style={{ color: typeColor, opacity: 0.8 }}>₹</span>
                <input
                  ref={amountRef}
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="bg-transparent font-bold focus:outline-none text-3xl"
                  style={{
                    color: 'var(--text)', caretColor: typeColor,
                    width: `${Math.max(2, (amount || '0').length + 0.5)}ch`, minWidth: '2ch',
                  }}
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2.5" style={{ color: 'var(--text4)' }}>Category</p>
              <div className="space-y-3">
                {grouped.map(({ main, items }) => (
                  <div key={main}>
                    {type === 'expense' && (
                      <p className="text-[10px] font-bold mb-1.5 px-0.5" style={{ color: MAIN_COLORS[main] ?? 'var(--text3)' }}>
                        {main}
                      </p>
                    )}
                    <div className="grid grid-cols-4 gap-1.5">
                      {items.map(c => {
                        const active = subCat === c.value;
                        const col = type === 'expense' ? (MAIN_COLORS[c.main] ?? typeColor) : typeColor;
                        return (
                          <button key={c.value} type="button" onClick={() => setSubCat(c.value)}
                            className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl text-center transition-all active:scale-95"
                            style={active
                              ? { background: `${col}18`, outline: `2px solid ${col}`, outlineOffset: '-1px' }
                              : { background: 'var(--bg2)', outline: '1.5px solid var(--border)', outlineOffset: '-1px' }}>
                            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{c.emoji}</span>
                            <p className="text-[9px] font-bold leading-tight" style={{ color: active ? col : 'var(--text3)' }}>{c.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text4)' }}>
                Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </p>
              <input type="text" value={comment} onChange={e => setComment(e.target.value)}
                placeholder="What was this for?"
                className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg2)', color: 'var(--text)' }} />
            </div>

            {/* Date */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--text4)' }}>Date</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg2)', color: 'var(--text)' }} />
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-xl font-medium"
                style={{ color: 'var(--expense)', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="py-3.5 px-5 rounded-2xl font-semibold text-sm active:scale-95 transition-all"
                style={{ color: 'var(--text3)', background: 'var(--bg2)' }}>
                Cancel
              </button>
              <button type="submit" disabled={!amount}
                className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
                style={{ background: type === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
