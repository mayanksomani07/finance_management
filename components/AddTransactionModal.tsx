'use client';

import { useState, useRef, useEffect } from 'react';
import type { Transaction } from '@/lib/supabase';

const EXPENSE_CATEGORIES = [
  { value: 'Need',       label: '🧾 Need',       hint: 'Rent, groceries, bills, medicine' },
  { value: 'Want',       label: '🛍️ Want',       hint: 'Dining out, shopping, entertainment' },
  { value: 'Investment', label: '📈 Investment', hint: 'SIP, stocks, FD, insurance' },
];

const INCOME_CATEGORIES = [
  { value: 'Monthly Payslip',       label: '💼 Monthly Payslip',       hint: 'Salary / freelance payout' },
  { value: 'Interest',              label: '🏦 Interest',              hint: 'FD interest, savings interest' },
  { value: 'Money Back from Others', label: '🤝 Money Back from Others', hint: 'UPI repayments, reimbursements' },
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

  // Reset category to first option when type changes
  useEffect(() => {
    setCategory(type === 'expense' ? 'Need' : 'Monthly Payslip');
  }, [type]);

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount,
          type,
          category,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#1a1a2e] rounded-t-3xl p-6 pb-10 border border-[#2a2a4a] border-b-0">
        <div className="w-10 h-1 bg-[#2a2a4a] rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-bold text-white mb-5">Add Transaction</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-[#2a2a4a]">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize ${
                  type === t
                    ? t === 'income' ? 'bg-[#00d9a6] text-[#0f0f23]' : 'bg-[#ff6b6b] text-white'
                    : 'text-[#8888aa]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-[#8888aa] mb-1.5">Amount (INR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888aa]">₹</span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#0f0f23] border border-[#2a2a4a] rounded-xl pl-8 pr-4 py-3 text-white text-lg font-medium focus:outline-none focus:border-[#6c63ff] transition-colors"
                required
              />
            </div>
          </div>

          {/* Category — card-style selection */}
          <div>
            <label className="block text-xs text-[#8888aa] mb-2">Category</label>
            <div className="space-y-2">
              {categories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                    category === c.value
                      ? 'border-[#6c63ff] bg-[#6c63ff]/10'
                      : 'border-[#2a2a4a] bg-[#0f0f23]'
                  }`}
                >
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${category === c.value ? 'text-white' : 'text-[#8888aa]'}`}>
                      {c.label}
                    </p>
                    <p className="text-[10px] text-[#555577] mt-0.5">{c.hint}</p>
                  </div>
                  {category === c.value && (
                    <div className="w-4 h-4 rounded-full bg-[#6c63ff] flex items-center justify-center text-[8px] text-white">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-[#8888aa] mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              className="w-full bg-[#0f0f23] border border-[#2a2a4a] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#6c63ff] transition-colors"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-[#8888aa] mb-1.5">Date & Time</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#0f0f23] border border-[#2a2a4a] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#6c63ff] transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-[#ff6b6b] bg-[#ff6b6b]/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#2a2a4a] text-[#8888aa] font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-[#6c63ff] text-white font-medium disabled:opacity-50 transition-opacity">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
