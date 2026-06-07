/**
 * Unified data layer — Supabase primary, localStorage fallback.
 * All functions are async so callers don't care which backend wins.
 */

import type { LocalTransaction } from './localStore';
import {
  loadExcelTransactions, saveExcelTransactions,
  loadManualTransactions, saveManualTransaction,
  deleteTransaction as localDelete,
  updateTransaction as localUpdate,
  txFingerprint,
} from './localStore';

// ─── helpers ──────────────────────────────────────────────────────────────────

function toLocal(t: {
  id: string; transaction_at: string; amount: number;
  type: 'income' | 'expense'; category: string | null;
  description: string | null; source: string | null;
}): LocalTransaction {
  return {
    id: t.id,
    date: t.transaction_at,
    category: t.category ?? 'Other',
    amount: t.amount,
    comment: t.description ?? '',
    type: t.type,
    source: t.source ?? 'manual',
  };
}

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function fetchAllTransactions(): Promise<LocalTransaction[]> {
  // Always seed UI from localStorage immediately (done by callers);
  // this function fetches the remote copy and merges.
  try {
    const res = await fetch('/api/transactions?limit=2000');
    if (!res.ok) throw new Error('fetch failed');
    const { transactions } = await res.json() as {
      transactions: Array<{
        id: string; transaction_at: string; amount: number;
        type: 'income' | 'expense'; category: string | null;
        description: string | null; source: string | null;
      }>;
    };
    if (!Array.isArray(transactions)) throw new Error('bad shape');
    return transactions.map(toLocal);
  } catch {
    // Offline — return merged localStorage
    return [...loadManualTransactions(), ...loadExcelTransactions()];
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createTransaction(tx: LocalTransaction): Promise<void> {
  // 1. Write to localStorage instantly (optimistic)
  saveManualTransaction(tx);

  // 2. Try Supabase
  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.comment || null,
        transaction_at: tx.date,
        source: tx.source ?? 'manual',
      }),
    });
    if (res.ok) {
      const { transaction } = await res.json() as { transaction: { id: string } };
      // Update local id to match Supabase id so deletes/edits stay in sync
      if (transaction?.id && transaction.id !== tx.id) {
        const manuals = loadManualTransactions().map(t =>
          t.id === tx.id ? { ...t, id: transaction.id } : t
        );
        localStorage.setItem('manual_transactions', JSON.stringify(manuals));
      }
    }
  } catch { /* offline — local only */ }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function removeTransaction(id: string): Promise<void> {
  // 1. Local immediately
  localDelete(id);

  // 2. Supabase
  try {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
  } catch { /* offline — local already updated */ }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function editTransaction(tx: LocalTransaction): Promise<void> {
  // 1. Local immediately
  localUpdate(tx);

  // 2. Supabase
  try {
    await fetch(`/api/transactions/${tx.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.comment || null,
        transaction_at: tx.date,
      }),
    });
  } catch { /* offline */ }
}

// ─── IMPORT (bulk excel) ──────────────────────────────────────────────────────

export async function importTransactions(fresh: LocalTransaction[]): Promise<void> {
  if (fresh.length === 0) return;

  // Persist locally
  const existing = loadExcelTransactions();
  const existingFps = new Set(existing.map(txFingerprint));
  const deduped = fresh.filter(t => !existingFps.has(txFingerprint(t)));
  if (deduped.length === 0) return;
  const merged = [...deduped, ...existing].sort((a, b) => b.date.localeCompare(a.date));
  saveExcelTransactions(merged);

  // Sync each to Supabase in background — fire and forget
  for (const tx of deduped) {
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.comment || null,
        transaction_at: tx.date,
        source: 'excel',
      }),
    }).catch(() => {});
  }
}
