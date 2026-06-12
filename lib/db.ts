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
  let res: Response;
  try {
    res = await fetch('/api/transactions', {
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
  } catch {
    // Network error (offline) — save locally so the UI isn't empty; syncs on next load
    saveManualTransaction(tx);
    return;
  }

  if (res.ok) {
    const { transaction } = await res.json() as { transaction: { id: string } };
    // Save with the real Supabase ID so subsequent edits/deletes stay in sync.
    // Also remove the optimistic entry (which used the client-generated UUID) by
    // explicitly deleting it before saving the canonical version.
    const canonical = transaction?.id ? { ...tx, id: transaction.id } : tx;
    if (transaction?.id && transaction.id !== tx.id) {
      localDelete(tx.id);
    }
    saveManualTransaction(canonical);
    return;
  }

  // HTTP error (auth failure, validation, etc.) — do NOT save locally with a bad ephemeral ID
  throw new Error(`Create failed: ${res.status}`);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function removeTransaction(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
  } catch (err) {
    // Network error (offline) — delete locally; server will be stale until next sync
    localDelete(id);
    throw err;
  }
  // 404 means already gone — treat as success
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete failed: ${res.status}`);
  }
  localDelete(id);
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function editTransaction(tx: LocalTransaction): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/transactions/${tx.id}`, {
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
  } catch (err) {
    // Network error (offline) — persist edit locally anyway; server syncs on next successful call
    localUpdate(tx);
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Edit failed: ${res.status}`);
  }
  localUpdate(tx);
}

// ─── IMPORT (bulk excel) ──────────────────────────────────────────────────────

export async function importTransactions(fresh: LocalTransaction[]): Promise<void> {
  if (fresh.length === 0) return;

  const existing = loadExcelTransactions();
  const existingFps = new Set(existing.map(txFingerprint));
  const deduped = fresh.filter(t => !existingFps.has(txFingerprint(t)));
  if (deduped.length === 0) return;

  // Sync to Supabase first — check existing remote rows to avoid duplicates
  try {
    const r = await fetch('/api/transactions?limit=10000');
    if (!r.ok) throw new Error('fetch failed');
    const { transactions: remote } = await r.json() as {
      transactions: Array<{ transaction_at: string; amount: number; category: string | null; description: string | null }>;
    };
    if (!Array.isArray(remote)) throw new Error('bad shape');

    const remoteFps = new Set(remote.map(t =>
      `${String(t.transaction_at).slice(0, 10)}|${t.amount}|${(t.category ?? '').trim().toLowerCase()}|${(t.description ?? '').trim().toLowerCase()}`
    ));
    const notInRemote = deduped.filter(t => !remoteFps.has(txFingerprint(t)));

    const CHUNK = 50;
    for (let i = 0; i < notInRemote.length; i += CHUNK) {
      await Promise.all(notInRemote.slice(i, i + CHUNK).map(async tx => {
        const res = await fetch('/api/transactions', {
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
        });
        if (!res.ok) console.error(`Import failed for tx ${tx.id}: ${res.status}`);
      }));
    }
  } catch {
    // Offline or Supabase unreachable — fall through to local-only save
  }

  // Write to localStorage after Supabase attempt (source of truth is DB when online)
  const merged = [...deduped, ...existing].sort((a, b) => b.date.localeCompare(a.date));
  saveExcelTransactions(merged);
}

// ─── CLEAR ALL ────────────────────────────────────────────────────────────────

export async function clearAllTransactionsRemote(): Promise<void> {
  const res = await fetch('/api/transactions', { method: 'DELETE' });
  if (!res.ok) throw new Error(`Clear failed: ${res.status}`);
  clearAllTransactions();
}
