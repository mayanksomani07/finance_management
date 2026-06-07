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
  clearAllTransactions,
  txFingerprint,
} from './localStore';

function deduplicateByFingerprint(txs: LocalTransaction[]): LocalTransaction[] {
  const seen = new Set<string>();
  return txs.filter(t => {
    const fp = txFingerprint(t);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });
}

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
  try {
    const all: LocalTransaction[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const res = await fetch(`/api/transactions?limit=${PAGE}&offset=${offset}`);
      if (!res.ok) throw new Error('fetch failed');
      const { transactions } = await res.json() as {
        transactions: Array<{
          id: string; transaction_at: string; amount: number;
          type: 'income' | 'expense'; category: string | null;
          description: string | null; source: string | null;
        }>;
      };
      if (!Array.isArray(transactions)) throw new Error('bad shape');
      all.push(...transactions.map(toLocal));
      if (transactions.length < PAGE) break;
      offset += PAGE;
    }
    return deduplicateByFingerprint(all);
  } catch {
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

  // Sync to Supabase — check existing remote rows first to avoid duplicates
  fetch('/api/transactions?limit=10000')
    .then(r => r.json())
    .then(({ transactions: remote }) => {
      if (!Array.isArray(remote)) return;
      const remoteFps = new Set(remote.map((t: { transaction_at: string; amount: number; category: string | null; description: string | null }) =>
        `${String(t.transaction_at).slice(0, 10)}|${t.amount}|${(t.category ?? '').trim().toLowerCase()}|${(t.description ?? '').trim().toLowerCase()}`
      ));
      const notInRemote = deduped.filter(t => !remoteFps.has(txFingerprint(t)));
      for (const tx of notInRemote) {
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
    })
    .catch(() => {
      // Offline — skip remote sync for now
    });
}

// ─── CLEAR ALL ────────────────────────────────────────────────────────────────

export async function clearAllTransactionsRemote(): Promise<void> {
  clearAllTransactions();
  try {
    await fetch('/api/transactions', { method: 'DELETE' });
  } catch { /* offline — local already cleared */ }
}
