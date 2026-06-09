export interface LocalTransaction {
  id: string;
  date: string;       // ISO: 2026-06-05T00:00:00
  category: string;
  amount: number;
  comment: string;
  type: 'income' | 'expense';
  source: 'manual' | 'excel' | string;
}

export function txFingerprint(t: LocalTransaction): string {
  return `${t.date.slice(0, 10)}|${t.amount}|${t.category.trim().toLowerCase()}|${t.comment.trim().toLowerCase()}`;
}

// Namespace localStorage by user so multiple users on the same device don't bleed data
function key(userId: string, suffix: string) {
  return `${suffix}_${userId}`;
}

function currentUserId(): string {
  if (typeof window === 'undefined') return '__anon__';
  return localStorage.getItem('fintrack_user_id') ?? '__anon__';
}

/** Call this after auth resolves to scope localStorage to the signed-in user */
export function setLocalUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('fintrack_user_id', userId);
}

export function clearLocalUserId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('fintrack_user_id');
}

export function loadExcelTransactions(): LocalTransaction[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key(currentUserId(), 'excel_transactions')) ?? '[]'); } catch { return []; }
}

export function saveExcelTransactions(txs: LocalTransaction[]): void {
  localStorage.setItem(key(currentUserId(), 'excel_transactions'), JSON.stringify(txs));
}

export function loadManualTransactions(): LocalTransaction[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key(currentUserId(), 'manual_transactions')) ?? '[]'); } catch { return []; }
}

export function saveManualTransaction(tx: LocalTransaction): void {
  const existing = loadManualTransactions();
  existing.unshift(tx);
  localStorage.setItem(key(currentUserId(), 'manual_transactions'), JSON.stringify(existing));
}

export function clearAllTransactions(): void {
  const uid = currentUserId();
  localStorage.removeItem(key(uid, 'excel_transactions'));
  localStorage.removeItem(key(uid, 'manual_transactions'));
}

export function deleteTransaction(id: string): void {
  const uid = currentUserId();
  const manual = loadManualTransactions().filter(t => t.id !== id);
  localStorage.setItem(key(uid, 'manual_transactions'), JSON.stringify(manual));
  const excel = loadExcelTransactions().filter(t => t.id !== id);
  localStorage.setItem(key(uid, 'excel_transactions'), JSON.stringify(excel));
}

export function updateTransaction(updated: LocalTransaction): void {
  const uid = currentUserId();
  const manual = loadManualTransactions().map(t => t.id === updated.id ? updated : t);
  localStorage.setItem(key(uid, 'manual_transactions'), JSON.stringify(manual));
  const excel = loadExcelTransactions().map(t => t.id === updated.id ? updated : t);
  localStorage.setItem(key(uid, 'excel_transactions'), JSON.stringify(excel));
}
