'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Transaction } from '@/lib/supabase';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionCard from '@/components/TransactionCard';
import SummaryCard from '@/components/SummaryCard';
import BalanceCheck from '@/components/BalanceCheck';
import ThemeToggle from '@/components/ThemeToggle';

type FilterTab = 'all' | 'income' | 'expense';

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [balanceTick, setBalanceTick] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getMonthRange();
      const params = new URLSearchParams({ from, to, limit: '100' });
      if (filter !== 'all') params.set('type', filter);
      const res = await fetch(`/api/transactions?${params}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.transactions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Compute summary from ALL transactions for this month regardless of filter
  const [allMonthTransactions, setAllMonthTransactions] = useState<Transaction[]>([]);
  useEffect(() => {
    const { from, to } = getMonthRange();
    fetch(`/api/transactions?from=${from}&to=${to}&limit=500`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAllMonthTransactions(json.transactions);
      })
      .catch(console.error);
  }, [transactions]); // refresh summary when transactions change

  const totalIncome = allMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = allMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netSavings = totalIncome - totalExpense;

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setAllMonthTransactions((prev) => prev.filter((t) => t.id !== id));
      setBalanceTick((n) => n + 1);
    } finally {
      setDeletingId(null);
    }
  }

  function handleAdded(tx: Transaction) {
    setTransactions((prev) => [tx, ...prev]);
    setAllMonthTransactions((prev) => [tx, ...prev]);
    setBalanceTick((n) => n + 1);
    setShowAdd(false);
  }

  const monthLabel = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-lg mx-auto pb-24 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header className="px-4 pt-12 pb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>FinTrack</h1>
          </div>
          <p className="text-sm ml-0.5" style={{ color: 'var(--text3)' }}>{monthLabel}</p>
        </div>
        <div className="mt-1"><ThemeToggle /></div>
      </header>

      {/* Summary Cards */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-5">
        <SummaryCard label="Income" amount={totalIncome} color="var(--income)" />
        <SummaryCard label="Expense" amount={totalExpense} color="var(--expense)" />
        <SummaryCard
          label="Savings"
          amount={netSavings}
          color={netSavings >= 0 ? 'var(--accent)' : 'var(--expense)'}
        />
      </div>

      {/* Balance Reconciliation */}
      <BalanceCheck lastUpdated={balanceTick} />

      {/* Filter Tabs */}
      <div className="px-4 mb-4 flex gap-2">
        {(['all', 'income', 'expense'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className="px-4 py-1.5 rounded-xl text-sm font-bold transition-all capitalize active:scale-95"
            style={filter === tab
              ? { backgroundColor: 'var(--accent)', color: '#fff', boxShadow: '0 2px 14px rgba(79,70,229,0.35)' }
              : { backgroundColor: 'var(--card)', color: 'var(--text3)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Transactions list */}
      <div className="px-4 space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <p className="text-xs" style={{ color: 'var(--text3)' }}>Loading transactions…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>💳</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>No transactions yet this month.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text4)' }}>Tap + to add one manually.</p>
          </div>
        ) : (
          transactions.slice(0, 20).map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              onDelete={handleDelete}
              deleting={deletingId === tx.id}
            />
          ))
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all z-40"
        aria-label="Add transaction"
        style={{
          background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
          boxShadow: '0 4px 20px rgba(79,70,229,0.45), 0 1px 0 rgba(255,255,255,0.15) inset',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Add Transaction Modal */}
      {showAdd && (
        <AddTransactionModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
