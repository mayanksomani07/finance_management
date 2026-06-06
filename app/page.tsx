'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Transaction } from '@/lib/supabase';
import AddTransactionModal from '@/components/AddTransactionModal';
import TransactionCard from '@/components/TransactionCard';
import SummaryCard from '@/components/SummaryCard';
import BalanceCheck from '@/components/BalanceCheck';

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
    <div className="max-w-md mx-auto pb-24">
      {/* Header */}
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">FinTrack</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">{monthLabel}</p>
      </header>

      {/* Summary Cards */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-6">
        <SummaryCard label="Income" amount={totalIncome} color="#00d9a6" />
        <SummaryCard label="Expense" amount={totalExpense} color="#ff6b6b" />
        <SummaryCard
          label="Savings"
          amount={netSavings}
          color={netSavings >= 0 ? '#6c63ff' : '#ff6b6b'}
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
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
              filter === tab
                ? 'bg-[#6c63ff] text-white'
                : 'bg-[#1a1a2e] text-[#8888aa] border border-[#2a2a4a]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Transactions list */}
      <div className="px-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-[#8888aa]">
            <div className="text-4xl mb-3">💳</div>
            <p className="text-sm">No transactions yet this month.</p>
            <p className="text-xs mt-1">Tap + to add one manually.</p>
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
        className="fixed bottom-8 right-6 w-14 h-14 bg-[#6c63ff] rounded-full shadow-lg flex items-center justify-center text-white text-2xl font-light active:scale-95 transition-transform z-40"
        aria-label="Add transaction"
        style={{ boxShadow: '0 4px 24px rgba(108,99,255,0.4)' }}
      >
        +
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
