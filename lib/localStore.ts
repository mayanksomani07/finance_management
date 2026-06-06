export interface LocalTransaction {
  id: string;
  date: string;       // ISO: 2026-06-05T00:00:00
  category: string;   // raw sub-category from source
  amount: number;
  comment: string;
  type: 'income' | 'expense';
  source: 'manual' | 'excel' | string;
}

// Dedup fingerprint — same date+amount+category+comment = same transaction
export function txFingerprint(t: LocalTransaction): string {
  return `${t.date.slice(0, 10)}|${t.amount}|${t.category.trim().toLowerCase()}|${t.comment.trim().toLowerCase()}`;
}

const EXCEL_KEY  = 'excel_transactions';
const MANUAL_KEY = 'manual_transactions';

export function loadExcelTransactions(): LocalTransaction[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(EXCEL_KEY) ?? '[]'); } catch { return []; }
}

export function saveExcelTransactions(txs: LocalTransaction[]): void {
  localStorage.setItem(EXCEL_KEY, JSON.stringify(txs));
}

export function loadManualTransactions(): LocalTransaction[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(MANUAL_KEY) ?? '[]'); } catch { return []; }
}

export function saveManualTransaction(tx: LocalTransaction): void {
  const existing = loadManualTransactions();
  existing.unshift(tx);
  localStorage.setItem(MANUAL_KEY, JSON.stringify(existing));
}

export function clearAllTransactions(): void {
  localStorage.removeItem(EXCEL_KEY);
  localStorage.removeItem(MANUAL_KEY);
}
