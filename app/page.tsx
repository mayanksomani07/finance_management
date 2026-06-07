'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';
import ExportModal from '@/components/ExportModal';
import type { WealthSnapshot } from '@/lib/exportExcel';
import { categorizeExpense, normaliseIncomeCategory } from '@/lib/categorize';
import {
  loadExcelTransactions,
  loadManualTransactions,
  clearAllTransactions, txFingerprint,
  type LocalTransaction,
} from '@/lib/localStore';
import { createTransaction, removeTransaction, editTransaction, importTransactions, fetchAllTransactions } from '@/lib/db';
import EditTransactionModal from '@/components/EditTransactionModal';
import type { MainCategory } from '@/lib/categorize';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedTx extends LocalTransaction {
  mainCategory: string;
  subCategory: string;
}

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'custom' | 'all';
type FilterType = 'all' | 'expense' | 'income';
type FilterMain = 'all' | MainCategory;

// ─── Constants ────────────────────────────────────────────────────────────────

// CSS-var-based palette — adapts to light / dark automatically
const MAIN_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Need:       { text: 'var(--clr-need)',       bg: 'var(--clr-need-bg)',       border: 'var(--clr-need-border)' },
  Want:       { text: 'var(--clr-want)',       bg: 'var(--clr-want-bg)',       border: 'var(--clr-want-border)' },
  Investment: { text: 'var(--clr-invest)',     bg: 'var(--clr-invest-bg)',     border: 'var(--clr-invest-border)' },
  Income:     { text: 'var(--clr-income-cat)', bg: 'var(--clr-income-cat-bg)', border: 'var(--clr-income-cat-border)' },
};

const SUB_ICONS: Record<string, string> = {
  'PG Rent':'🏠','Food':'🍜','Groceries':'🛒','Transportation':'🚇','Leisure':'🎬',
  'Health':'💊','Recharge':'📱','Donation':'🤲','Interest':'📊','Washing':'🫧',
  'Xerox':'📋','Home':'🏡','Education':'🎓','Gifts':'🎁','Mess Bill':'🥘',
  'Other':'💬','Investment':'📈','Investment (Debt)':'🏛️','Payslip':'💼',
  'Money Back':'🔄','Gift':'🎀','Paycheck':'💼',
};

const EXPENSE_SUBCATS = [
  { value: 'PG Rent',           main: 'Need',       emoji: '🏠', label: 'PG Rent',    hint: 'Monthly rent' },
  { value: 'Mess Bill',         main: 'Need',       emoji: '🥘', label: 'Mess',        hint: 'Mess / tiffin' },
  { value: 'Health',            main: 'Need',       emoji: '💊', label: 'Health',      hint: 'Medical, pharmacy' },
  { value: 'Recharge',          main: 'Need',       emoji: '📱', label: 'Recharge',    hint: 'Mobile, DTH' },
  { value: 'Education',         main: 'Need',       emoji: '🎓', label: 'Education',   hint: 'Courses, books' },
  { value: 'Home',              main: 'Need',       emoji: '🏡', label: 'Home',        hint: 'Household items' },
  { value: 'Donation',          main: 'Need',       emoji: '🤲', label: 'Donation',    hint: 'Charity, giving' },
  { value: 'Washing',           main: 'Need',       emoji: '🫧', label: 'Washing',     hint: 'Laundry' },
  { value: 'Xerox',             main: 'Need',       emoji: '📋', label: 'Xerox',       hint: 'Prints, copies' },
  { value: 'Interest',          main: 'Need',       emoji: '📊', label: 'Interest',    hint: 'EMI interest' },
  { value: 'Food',              main: 'Want',       emoji: '🍜', label: 'Food',        hint: 'Restaurants, swiggy' },
  { value: 'Groceries',         main: 'Want',       emoji: '🛒', label: 'Groceries',   hint: 'Zepto, Blinkit' },
  { value: 'Transportation',    main: 'Want',       emoji: '🚇', label: 'Transport',   hint: 'Cab, auto, metro' },
  { value: 'Leisure',           main: 'Want',       emoji: '🎬', label: 'Leisure',     hint: 'Movies, travel' },
  { value: 'Gifts',             main: 'Want',       emoji: '🎁', label: 'Gifts',       hint: 'Presents' },
  { value: 'Other',             main: 'Want',       emoji: '💬', label: 'Other',       hint: 'Misc spending' },
  { value: 'Investment',        main: 'Investment', emoji: '📈', label: 'Investment',  hint: 'MF, stocks, SIP' },
  { value: 'Investment (Debt)', main: 'Investment', emoji: '🏛️', label: 'Debt Fund',   hint: 'Debt MF, FD' },
];

const INCOME_SUBCATS = [
  { value: 'Paycheck', emoji: '💼', label: 'Payslip',    hint: 'Monthly salary' },
  { value: 'Interest', emoji: '📊', label: 'Interest',   hint: 'FD, bond interest' },
  { value: 'Money Back', emoji: '🔄', label: 'Money Back', hint: 'Refunds, reimbursements' },
  { value: 'Gift',     emoji: '🎀', label: 'Gift',       hint: 'Received as gift' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function fmtDateHeader(iso: string) {
  const d = new Date(iso);
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function enrich(raw: LocalTransaction[]): EnrichedTx[] {
  return raw.map(r => {
    if (r.type === 'expense') {
      const { main, sub } = categorizeExpense(r.category, r.comment);
      return { ...r, mainCategory: main, subCategory: sub };
    }
    const norm = normaliseIncomeCategory(r.category);
    return { ...r, mainCategory: 'Income', subCategory: norm };
  });
}

function dateRangeFor(filter: DateFilter, custom: { from: string; to: string }): { from: string; to: string } | null {
  if (filter === 'all') return null;
  if (filter === 'custom') return custom;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (filter === 'today') return { from: today, to: today };
  if (filter === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  if (filter === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  if (filter === 'year') return { from: `${now.getFullYear()}-01-01`, to: today };
  return null;
}

async function parseExcel(file: File): Promise<LocalTransaction[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  // cellDates: false → dates come as Excel serial numbers; we parse them ourselves to avoid timezone shifts
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const result: LocalTransaction[] = [];
  for (const shName of wb.SheetNames) {
    const txType: 'expense' | 'income' | null =
      shName === 'Expenses' ? 'expense' : shName === 'Income' ? 'income' : null;
    if (!txType) continue;
    const ws = wb.Sheets[shName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const rawDate = row[0];
      if (!rawDate) continue;
      let dateStr = '';
      if (typeof rawDate === 'number') {
        // Parse Excel serial number directly — no timezone involved
        const parsed = XLSX.SSF.parse_date_code(rawDate);
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        dateStr = `${parsed.y}-${m}-${d}T00:00:00`;
      } else if (typeof rawDate === 'string' && rawDate.trim()) {
        dateStr = rawDate.trim().slice(0, 10) + 'T00:00:00';
      } else continue;
      const cat = String(row[1] ?? '').trim();
      const amount = parseFloat(String(row[3] ?? '0'));
      const comment = String(row[8] ?? '').trim();
      if (!amount || amount <= 0) continue;
      result.push({ id: crypto.randomUUID(), date: dateStr, category: cat, amount, comment, type: txType, source: 'excel' });
    }
  }
  return result;
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────

function AddModal({ onClose, onAdded }: { onClose: () => void; onAdded: (tx: LocalTransaction) => void }) {
  const [amount, setAmount]   = useState('');
  const [type, setType]       = useState<'income' | 'expense'>('expense');
  const [subCat, setSubCat]   = useState('Food');
  const [comment, setComment] = useState('');
  const [date, setDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError]     = useState('');
  const amtRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => amtRef.current?.focus(), 80); }, []);
  useEffect(() => { setSubCat(type === 'expense' ? 'Food' : 'Paycheck'); }, [type]);

  const isIncome = type === 'income';
  const typeColorVar = isIncome ? 'var(--clr-income-cat)' : 'var(--clr-want)';
  const typeBgVar    = isIncome ? 'var(--clr-income-cat-bg)' : 'var(--clr-want-bg)';
  const typeBorderVar = isIncome ? 'var(--clr-income-cat-border)' : 'var(--clr-want-border)';

  const grouped = type === 'expense'
    ? [
        { main: 'Need',       label: 'Needs',       color: MAIN_COLORS.Need,       items: EXPENSE_SUBCATS.filter(s => s.main === 'Need') },
        { main: 'Want',       label: 'Wants',       color: MAIN_COLORS.Want,       items: EXPENSE_SUBCATS.filter(s => s.main === 'Want') },
        { main: 'Investment', label: 'Investments', color: MAIN_COLORS.Investment, items: EXPENSE_SUBCATS.filter(s => s.main === 'Investment') },
      ]
    : [{ main: 'Income', label: 'Income Type', color: MAIN_COLORS.Income, items: INCOME_SUBCATS.map(s => ({ ...s, main: 'Income' as const })) }];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { setError('Enter a valid amount.'); return; }
    const tx: LocalTransaction = {
      id: crypto.randomUUID(),
      date: date + 'T00:00:00',
      category: subCat,
      amount: parsed,
      comment: comment.trim(),
      type,
      source: 'manual',
    };
    const fp = txFingerprint(tx);
    const allStored = [...loadManualTransactions(), ...loadExcelTransactions()];
    if (allStored.some(t => txFingerprint(t) === fp)) {
      setError('This transaction already exists (same date, amount & category).');
      return;
    }
    onAdded(tx);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="flex-1 sm:hidden" onClick={onClose} />
      <div className="w-full max-w-md mx-auto rounded-t-3xl sm:rounded-3xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 -16px 64px rgba(0,0,0,0.35)', maxHeight: 'calc(100dvh - 80px)', display: 'flex', flexDirection: 'column', marginBottom: '64px' }}
        onClick={e => e.stopPropagation()}>

        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 flex-shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-extrabold" style={{ color: 'var(--text)' }}>New Transaction</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-5 pt-4 pb-6 space-y-5 overflow-y-auto flex-1">

            {/* Type toggle */}
            <div className="flex p-1 rounded-2xl gap-1" style={{ background: 'var(--bg2)' }}>
              {(['expense', 'income'] as const).map(t => {
                const active = type === t;
                const col = t === 'income'
                  ? { text: 'var(--clr-income-cat)', bg: 'var(--clr-income-cat-bg)', border: 'var(--clr-income-cat-border)' }
                  : { text: 'var(--clr-want)', bg: 'var(--clr-want-bg)', border: 'var(--clr-want-border)' };
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    style={active
                      ? { background: col.bg, color: col.text, border: `1.5px solid ${col.border}` }
                      : { color: 'var(--text4)', border: '1.5px solid transparent' }}>
                    <span className="text-base leading-none">{t === 'expense' ? '↑' : '↓'}</span>
                    {t === 'expense' ? 'Expense' : 'Income'}
                  </button>
                );
              })}
            </div>

            {/* Amount */}
            <div className="rounded-2xl pt-5 pb-5 flex flex-col items-center"
              style={{ background: typeBgVar, border: `1.5px solid ${typeBorderVar}` }}>
              <p className="text-[9px] font-extrabold tracking-[0.2em] uppercase mb-3"
                style={{ color: typeColorVar }}>Amount (₹)</p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black" style={{ color: typeColorVar }}>₹</span>
                <input ref={amtRef} type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                  className="bg-transparent font-black focus:outline-none text-4xl text-center"
                  style={{ color: 'var(--text)', caretColor: typeColorVar, width: `${Math.max(3, (amount || '0').length + 1)}ch`, minWidth: '3ch' }} />
              </div>
              {amount && (
                <p className="text-xs mt-1.5 font-semibold" style={{ color: typeColorVar }}>
                  {INR(parseFloat(amount) || 0)}
                </p>
              )}
            </div>

            {/* Categories */}
            <div className="space-y-4">
              {grouped.map(({ main, label, color, items }) => (
                <div key={main}>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color.text }} />
                    <p className="text-[9px] font-extrabold tracking-[0.15em] uppercase" style={{ color: color.text }}>{label}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(c => (
                      <CatPill key={c.value} emoji={c.emoji} label={c.label}
                        active={subCat === c.value} color={color}
                        onClick={() => setSubCat(c.value)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Note */}
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--text4)' }}>Note (optional)</p>
              <input type="text" value={comment} onChange={e => setComment(e.target.value)}
                placeholder="What was this for?"
                className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
                style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1.5px solid var(--border)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }} />
            </div>

            {/* Date */}
            <div>
              <p className="text-[9px] font-extrabold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--text4)' }}>Date</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
                style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1.5px solid var(--border)' }} />
            </div>

            {error && (
              <p className="text-sm px-3 py-2.5 rounded-xl font-semibold"
                style={{ color: 'var(--clr-want)', background: 'var(--clr-want-bg)', border: '1px solid var(--clr-want-border)' }}>
                {error}
              </p>
            )}

            <button type="submit"
              className="w-full py-4 rounded-2xl font-extrabold text-sm active:scale-[0.98] transition-all"
              style={{ background: `linear-gradient(135deg, ${typeColorVar}, ${isIncome ? 'var(--clr-income-cat)' : 'var(--clr-want)'})`, color: '#fff', boxShadow: `0 4px 20px ${typeBgVar}` }}>
              Save {isIncome ? 'Income' : 'Expense'}{amount ? ` · ${INR(parseFloat(amount) || 0)}` : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shared sub-component: Section label ─────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-extrabold tracking-[0.18em] uppercase mb-3"
      style={{ color: 'var(--text4)' }}>
      {children}
    </p>
  );
}

// ─── Shared sub-component: Category pill (icon + label, same shape everywhere) ─

function CatPill({
  emoji, label, active, color, onClick,
}: {
  emoji: string; label: string; active: boolean;
  color: { text: string; bg: string; border: string };
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all active:scale-95"
      style={active
        ? { background: color.bg, color: color.text, border: `1.5px solid ${color.border}` }
        : { background: 'var(--bg2)', color: 'var(--text3)', border: '1.5px solid var(--border)' }}>
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{emoji}</span>
      <span className="leading-none">{label}</span>
    </button>
  );
}

// ─── Spend Charts ─────────────────────────────────────────────────────────────

// Hardcoded hex so recharts can render gradients & fills correctly (CSS vars don't work in SVG fill)
const PALETTE = {
  dark: {
    Need:       '#f59e0b',
    Want:       '#f87171',
    Investment: '#a78bfa',
    Income:     '#34d399',
    accent:     '#7c6ef5',
    border:     '#252548',
    text4:      '#6a6a90',
    card:       '#171730',
  },
  light: {
    Need:       '#d97706',
    Want:       '#dc2626',
    Investment: '#7c3aed',
    Income:     '#059669',
    accent:     '#4f46e5',
    border:     '#dde0f0',
    text4:      '#8890b0',
    card:       '#ffffff',
  },
};

// Per-theme sub-category palettes — dark uses vibrant/pastel, light uses rich/saturated
const SUB_PALETTES = {
  dark: [
    '#f59e0b','#f87171','#a78bfa','#34d399','#38bdf8','#fb923c','#e879f9','#4ade80',
    '#facc15','#f472b6','#60a5fa','#2dd4bf','#c084fc','#fbbf24','#86efac','#7dd3fc',
  ],
  light: [
    '#b45309','#dc2626','#7c3aed','#059669','#0284c7','#c2410c','#a21caf','#15803d',
    '#ca8a04','#be185d','#1d4ed8','#0f766e','#6d28d9','#d97706','#166534','#075985',
  ],
};

type ChartTab = 'cat-pie' | 'sub-pie' | 'top-bar' | 'income' | 'daily' | 'monthly';

const EMPTY_WEALTH: WealthSnapshot = {
  netWorth: 0, totalAssets: 0, totalLiabilities: 0,
  eqTotalInvested: 0, mfTotalInvested: 0, indmoneyInvested: 0,
  cryptoInvested: 0, debtInvested: 0, pfInvested: 0,
  eqTotalCurrent: 0, mfTotalCurrent: 0, indmoneyCurrent: 0,
  cryptoCurrent: 0, debtCurrent: 0, pfCurrent: 0,
  bankBalance: 0, cashInHand: 0, mobikwik: 0, bankTotal: 0,
  creditCardDue: 0, payToSomeone: 0,
};

const INR_SHORT = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 100000) return `₹${(v / 100000 % 1 === 0 ? (v / 100000).toFixed(0) : (v / 100000).toFixed(1))}L`;
  if (abs >= 1000)   return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
};
const INR_FMT = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

function ChartTooltip({ label, rows }: { label?: string; rows: { name: string; value: number; color?: string }[] }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      minWidth: 160,
    }}>
      {label && (
        <p style={{ color: 'var(--text3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {label}
        </p>
      )}
      {rows.map(r => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {r.color && <div style={{ width: 8, height: 8, borderRadius: 3, background: r.color, flexShrink: 0 }} />}
            <span style={{ color: 'var(--text3)', fontSize: 11, fontWeight: 600 }}>{r.name}</span>
          </div>
          <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 800 }}>{INR_FMT(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieLegend({ items }: { items: { name: string; value: number; color: string; pct: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 16, paddingBottom: 4 }}>
      {items.map(item => (
        <div key={item.name} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 11px', borderRadius: 12,
          background: item.color + '15',
          border: `1.5px solid ${item.color}38`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0, boxShadow: `0 0 5px ${item.color}80` }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: item.color, letterSpacing: '0.02em', lineHeight: 1.2 }}>
              {item.name}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: item.color, opacity: 0.8, letterSpacing: '0.03em' }}>
              {item.pct}% · {INR_SHORT(item.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SpendCharts({ txs }: { txs: EnrichedTx[] }) {
  const { theme } = useTheme();
  const pal = theme === 'light' ? PALETTE.light : PALETTE.dark;
  const subPal = theme === 'light' ? SUB_PALETTES.light : SUB_PALETTES.dark;

  const [tab, setTab] = useState<ChartTab>('cat-pie');

  const expenses = useMemo(() => txs.filter(t => t.type === 'expense'), [txs]);
  const incomes  = useMemo(() => txs.filter(t => t.type === 'income'),  [txs]);

  // ── Cat Pie ──
  const catPieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenses) map.set(t.mainCategory, (map.get(t.mainCategory) ?? 0) + t.amount);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // ── Sub Pie ──
  const subPieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenses) map.set(t.subCategory, (map.get(t.subCategory) ?? 0) + t.amount);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 10);
  }, [expenses]);

  // ── Top Bar ──
  const topBarData = useMemo(() => {
    const map = new Map<string, { amount: number; main: string }>();
    for (const t of expenses) {
      const prev = map.get(t.subCategory);
      if (prev) prev.amount += t.amount;
      else map.set(t.subCategory, { amount: t.amount, main: t.mainCategory });
    }
    return Array.from(map.entries())
      .map(([name, { amount, main }]) => ({ name, amount, main }))
      .sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [expenses]);

  // ── Income ──
  const incomeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of incomes) map.set(t.subCategory, (map.get(t.subCategory) ?? 0) + t.amount);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [incomes]);

  // ── Daily trend — last 30 calendar days from today ──
  const dailyData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 29);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const map = new Map<string, { expense: number; income: number }>();
    for (const t of txs) {
      const d = t.date.slice(0, 10);
      if (d < cutoffStr) continue;
      if (!map.has(d)) map.set(d, { expense: 0, income: 0 });
      const slot = map.get(d)!;
      if (t.type === 'expense') slot.expense += t.amount;
      else slot.income += t.amount;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        ...v,
      }));
  }, [txs]);

  // ── Monthly trend — last 30 calendar months from today ──
  const monthlyData = useMemo(() => {
    const today = new Date();
    const cutoffYear  = today.getFullYear();
    const cutoffMonth = today.getMonth() - 29;
    const cutoff = new Date(cutoffYear, cutoffMonth, 1).toISOString().slice(0, 7);

    const map = new Map<string, { expense: number; income: number }>();
    for (const t of txs) {
      const m = t.date.slice(0, 7);
      if (m < cutoff) continue;
      if (!map.has(m)) map.set(m, { expense: 0, income: 0 });
      const slot = map.get(m)!;
      if (t.type === 'expense') slot.expense += t.amount;
      else slot.income += t.amount;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        ...v,
      }));
  }, [txs]);

  const hasExpenses = expenses.length > 0;
  const hasIncomes  = incomes.length > 0;
  const hasTrend    = txs.length > 0;

  if (!hasTrend) return null;

  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);

  const TABS: { key: ChartTab; label: string; emoji: string; disabled?: boolean }[] = [
    { key: 'cat-pie',  label: 'Groups',   emoji: '🍩', disabled: !hasExpenses },
    { key: 'sub-pie',  label: 'Sub-cats', emoji: '🥧', disabled: !hasExpenses },
    { key: 'top-bar',  label: 'Top',      emoji: '📊', disabled: !hasExpenses },
    { key: 'income',   label: 'Income',   emoji: '💰', disabled: !hasIncomes  },
    { key: 'daily',    label: 'Daily',    emoji: '📅', disabled: !hasTrend    },
    { key: 'monthly',  label: 'Monthly',  emoji: '🗓',  disabled: !hasTrend    },
  ];

  // Auto-select first non-disabled tab when current becomes disabled
  const activeTab = TABS.find(t => t.key === tab && !t.disabled)
    ? tab
    : (TABS.find(t => !t.disabled)?.key ?? 'daily');

  const TrendLegend = () => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {([{ label: 'Income', color: pal.Income }, { label: 'Expense', color: pal.Want }]).map(l => (
        <div key={l.label} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 9px', borderRadius: 9,
          background: l.color + '18', border: `1.5px solid ${l.color}35`,
        }}>
          <div style={{ width: 9, height: 9, borderRadius: 3, background: l.color, flexShrink: 0, boxShadow: `0 0 4px ${l.color}70` }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: l.color, letterSpacing: '0.03em' }}>{l.label}</span>
        </div>
      ))}
    </div>
  );

  const ChartHeader = ({ title, sub }: { title: string; sub: string }) => {
    const isTotal = sub.startsWith('Total:');
    const totalVal = isTotal ? sub.replace('Total: ', '').replace('Total:', '').trim() : null;
    return (
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</p>
        {isTotal && totalVal ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{totalVal}</span>
          </div>
        ) : (
          <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginTop: 3 }}>{sub}</p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-4 mb-5 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--card)',
        border: '1.5px solid var(--border)',
        borderLeft: `3px solid ${pal.accent}`,
        boxShadow: 'var(--shadow-card)',
      }}>

      {/* Card header */}
      <div className="px-5 pt-4 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: pal.accent + '1a', border: `1px solid ${pal.accent}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Analytics</p>
            <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginTop: 1 }}>{txs.length} transaction{txs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Tab row */}
      <div className="flex gap-1.5 px-4 pt-3 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.filter(t => !t.disabled).map(({ key, label, emoji }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex-shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
            style={{
              padding: '7px 14px', borderRadius: 12, fontSize: 11, fontWeight: 800, letterSpacing: '0.01em',
              ...(activeTab === key
                ? { background: pal.accent, color: '#fff', boxShadow: `0 3px 14px ${pal.accent}55` }
                : { background: 'var(--bg2)', color: 'var(--text3)', border: '1.5px solid var(--border)' }),
            }}>
            <span style={{ fontSize: 13, lineHeight: 1, marginRight: 2 }}>{emoji}</span>{label}
          </button>
        ))}
      </div>

      <div style={{ height: '1px', background: 'var(--border)' }} />

      <div className="px-4 pt-5 pb-5">

        {/* ── Category Donut ── */}
        {activeTab === 'cat-pie' && (
          <>
            <ChartHeader title="Expense by Group" sub={`Total: ${INR_FMT(totalExp)}`} />
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catPieData} cx="50%" cy="50%" innerRadius={54} outerRadius={86}
                  paddingAngle={4} dataKey="value" strokeWidth={2} stroke="var(--card)">
                  {catPieData.map(entry => (
                    <Cell key={entry.name} fill={(pal as Record<string, string>)[entry.name] ?? pal.accent} />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const name = payload[0].name as string;
                  const value = payload[0].value as number;
                  const pct = totalExp > 0 ? ((value / totalExp) * 100).toFixed(1) : '0';
                  return <ChartTooltip rows={[{ name: `${name} · ${pct}%`, value, color: (pal as Record<string, string>)[name] ?? pal.accent }]} />;
                }} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend items={catPieData.map(e => ({
              name: e.name, value: e.value,
              color: (pal as Record<string, string>)[e.name] ?? pal.accent,
              pct: totalExp > 0 ? ((e.value / totalExp) * 100).toFixed(1) : '0',
            }))} />
          </>
        )}

        {/* ── Sub-category Donut ── */}
        {activeTab === 'sub-pie' && (
          <>
            <ChartHeader title="Expense by Sub-category" sub={`Total: ${INR_FMT(totalExp)}`} />
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={subPieData} cx="50%" cy="50%" innerRadius={54} outerRadius={86}
                  paddingAngle={3} dataKey="value" strokeWidth={2} stroke="var(--card)">
                  {subPieData.map((entry, i) => (
                    <Cell key={entry.name} fill={subPal[i % subPal.length]} />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const name = payload[0].name as string;
                  const value = payload[0].value as number;
                  const pct = totalExp > 0 ? ((value / totalExp) * 100).toFixed(1) : '0';
                  const i = subPieData.findIndex(d => d.name === name);
                  return <ChartTooltip rows={[{ name: `${name} · ${pct}%`, value, color: subPal[i % subPal.length] }]} />;
                }} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend items={subPieData.map((e, i) => ({
              name: e.name, value: e.value,
              color: subPal[i % subPal.length],
              pct: totalExp > 0 ? ((e.value / totalExp) * 100).toFixed(1) : '0',
            }))} />
          </>
        )}

        {/* ── Top Spends Bar ── */}
        {activeTab === 'top-bar' && (
          <>
            <ChartHeader title="Top Spending Categories" sub={`Top ${topBarData.length} sub-categories by amount`} />
            {/* X-axis labels at top */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 100, paddingRight: 8, marginBottom: 4 }}>
              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                const maxVal = topBarData[0]?.amount ?? 0;
                return (
                  <span key={pct} style={{ fontSize: 9, fontWeight: 700, color: pal.text4, fontVariantNumeric: 'tabular-nums' }}>
                    {INR_SHORT(maxVal * pct)}
                  </span>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(topBarData.length * 38 + 12, 200)}>
              <BarChart data={topBarData} layout="vertical"
                margin={{ top: 0, right: 8, left: 4, bottom: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="2 6" stroke={pal.border} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={96}
                  tick={({ x, y, payload }) => (
                    <text x={x} y={y} dy={4} textAnchor="end" fill="var(--text)" fontSize={11} fontWeight={700} fontFamily="inherit">
                      {payload.value}
                    </text>
                  )}
                  tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const entry = topBarData.find(d => d.name === label);
                  return <ChartTooltip label={label} rows={[{
                    name: 'Spend', value: payload[0].value as number,
                    color: (pal as Record<string, string>)[entry?.main ?? ''] ?? pal.accent,
                  }]} />;
                }} />
                <Bar dataKey="amount" radius={[0, 7, 7, 0]}>
                  {topBarData.map((entry, i) => (
                    <Cell key={entry.name}
                      fill={(pal as Record<string, string>)[entry.main] ?? pal.accent}
                      fillOpacity={1 - i * 0.04}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {/* ── Income Breakdown ── */}
        {activeTab === 'income' && (
          <>
            <ChartHeader title="Income Sources" sub={`Total: ${INR_FMT(totalInc)}`} />
            {incomeData.length === 1 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: pal.Income + '22' }}>💰</div>
                <p className="text-2xl font-black mt-1" style={{ color: pal.Income }}>{INR_FMT(incomeData[0].value)}</p>
                <p className="text-xs font-bold" style={{ color: 'var(--text3)' }}>{incomeData[0].name}</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={incomeData} cx="50%" cy="50%" innerRadius={54} outerRadius={86}
                      paddingAngle={4} dataKey="value" strokeWidth={2} stroke="var(--card)">
                      {incomeData.map((entry, i) => (
                        <Cell key={entry.name} fill={subPal[i % subPal.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const name = payload[0].name as string;
                      const value = payload[0].value as number;
                      const pct = totalInc > 0 ? ((value / totalInc) * 100).toFixed(1) : '0';
                      const i = incomeData.findIndex(d => d.name === name);
                      return <ChartTooltip rows={[{ name: `${name} · ${pct}%`, value, color: subPal[i % subPal.length] }]} />;
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <PieLegend items={incomeData.map((e, i) => ({
                  name: e.name, value: e.value,
                  color: subPal[i % subPal.length],
                  pct: totalInc > 0 ? ((e.value / totalInc) * 100).toFixed(1) : '0',
                }))} />
              </>
            )}
          </>
        )}

        {/* ── Daily Trend ── */}
        {activeTab === 'daily' && (
          <>
            <div className="flex items-start justify-between mb-3">
              <ChartHeader title="Daily Trend" sub={`Last ${dailyData.length} days`} />
              <TrendLegend />
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                barSize={6} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="2 4" stroke={pal.border} vertical={false} />
                <XAxis dataKey="date"
                  tick={{ fontSize: 10, fill: pal.text4, fontWeight: 700, fontFamily: 'inherit' }}
                  tickLine={false} axisLine={false}
                  interval={Math.ceil(dailyData.length / 6)} height={24} />
                <YAxis tick={{ fontSize: 10, fill: pal.text4, fontWeight: 700, fontFamily: 'inherit' }}
                  tickLine={false} axisLine={false} width={52} tickFormatter={INR_SHORT} />
                <Tooltip cursor={{ fill: pal.border, opacity: 0.3 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return <ChartTooltip label={label} rows={
                      payload.filter(p => (p.value as number) > 0)
                        .map(p => ({ name: p.name as string, value: p.value as number,
                          color: p.name === 'income' ? pal.Income : pal.Want }))
                    } />;
                  }} />
                <Bar dataKey="income"  name="Income"  radius={[3,3,0,0]} fill={pal.Income} fillOpacity={0.9} />
                <Bar dataKey="expense" name="Expense" radius={[3,3,0,0]} fill={pal.Want}   fillOpacity={0.9} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {/* ── Monthly Trend ── */}
        {activeTab === 'monthly' && (
          <>
            <div className="flex items-start justify-between mb-3">
              <ChartHeader title="Monthly Trend" sub={`Last ${monthlyData.length} months`} />
              <TrendLegend />
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                barSize={16} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="2 4" stroke={pal.border} vertical={false} />
                <XAxis dataKey="month"
                  tick={{ fontSize: 10, fill: pal.text4, fontWeight: 700, fontFamily: 'inherit' }}
                  tickLine={false} axisLine={false}
                  interval={monthlyData.length > 12 ? Math.ceil(monthlyData.length / 8) : 0} height={24} />
                <YAxis tick={{ fontSize: 10, fill: pal.text4, fontWeight: 700, fontFamily: 'inherit' }}
                  tickLine={false} axisLine={false} width={52} tickFormatter={INR_SHORT} />
                <Tooltip cursor={{ fill: pal.border, opacity: 0.3 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const inc = (payload.find(p => p.name === 'Income')?.value  as number) ?? 0;
                    const exp = (payload.find(p => p.name === 'Expense')?.value as number) ?? 0;
                    const net = inc - exp;
                    return <ChartTooltip label={label} rows={[
                      { name: 'Income',  value: inc, color: pal.Income },
                      { name: 'Expense', value: exp, color: pal.Want   },
                      { name: net >= 0 ? 'Saved' : 'Deficit', value: Math.abs(net),
                        color: net >= 0 ? pal.Income : pal.Want },
                    ]} />;
                  }} />
                <Bar dataKey="income"  name="Income"  radius={[5,5,0,0]} fill={pal.Income} fillOpacity={0.88} />
                <Bar dataKey="expense" name="Expense" radius={[5,5,0,0]} fill={pal.Want}   fillOpacity={0.88} />
              </BarChart>
            </ResponsiveContainer>
            {/* Net savings pills */}
            <p style={{ fontSize: 10, fontWeight: 700, color: pal.text4, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 }}>Net saved per month</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {monthlyData.map(m => {
                const net = m.income - m.expense;
                const pos = net >= 0;
                const clr = pos ? pal.Income : pal.Want;
                return (
                  <div key={m.month} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 9px', borderRadius: 8,
                    background: clr + '18', border: `1px solid ${clr}30`,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text4)' }}>{m.month}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: clr }}>
                      {pos ? '+' : ''}{INR_SHORT(net)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

const FILTER_EXPENSE_GROUPS = [
  { main: 'Need' as FilterMain,       label: 'Needs',       color: MAIN_COLORS.Need,       emoji: '🧾', items: EXPENSE_SUBCATS.filter(s => s.main === 'Need') },
  { main: 'Want' as FilterMain,       label: 'Wants',       color: MAIN_COLORS.Want,       emoji: '✨', items: EXPENSE_SUBCATS.filter(s => s.main === 'Want') },
  { main: 'Investment' as FilterMain, label: 'Investments', color: MAIN_COLORS.Investment, emoji: '📈', items: EXPENSE_SUBCATS.filter(s => s.main === 'Investment') },
];

const INCOME_FILTER_ITEMS = [
  { value: 'Payslip',    emoji: '💼', label: 'Payslip' },
  { value: 'Interest',   emoji: '📊', label: 'Interest' },
  { value: 'Money Back', emoji: '🔄', label: 'Money Back' },
  { value: 'Gift',       emoji: '🎀', label: 'Gift' },
];

const ACCENT_COLOR = { text: 'var(--accent)', bg: 'var(--accent-bg)', border: 'var(--accent-border)' };
const EXPENSE_COLOR = { text: 'var(--clr-want)', bg: 'var(--clr-want-bg)', border: 'var(--clr-want-border)' };
const INCOME_COLOR  = { text: 'var(--clr-income-cat)', bg: 'var(--clr-income-cat-bg)', border: 'var(--clr-income-cat-border)' };

function FilterSheet({
  filterType, setFilterType,
  filterMain, setFilterMain,
  filterSub,  setFilterSub,
  dateFilter, setDateFilter,
  customFrom, setCustomFrom,
  customTo,   setCustomTo,
  onClose,
}: {
  filterType: FilterType; setFilterType: (v: FilterType) => void;
  filterMain: FilterMain; setFilterMain: (v: FilterMain) => void;
  filterSub: string;      setFilterSub:  (v: string) => void;
  dateFilter: DateFilter; setDateFilter: (v: DateFilter) => void;
  customFrom: string;     setCustomFrom: (v: string) => void;
  customTo: string;       setCustomTo:   (v: string) => void;
  onClose: () => void;
}) {
  const activeCount = [
    dateFilter !== 'all', filterType !== 'all', filterMain !== 'all', filterSub !== 'all',
  ].filter(Boolean).length;

  function reset() {
    setFilterType('all'); setFilterMain('all'); setFilterSub('all');
    setDateFilter('all'); setCustomFrom(''); setCustomTo('');
  }

  const DATE_OPTS: { val: DateFilter; label: string; emoji: string }[] = [
    { val: 'today',  label: 'Today',      emoji: '☀️' },
    { val: 'week',   label: 'This Week',  emoji: '7️⃣' },
    { val: 'month',  label: 'This Month', emoji: '🗓' },
    { val: 'year',   label: 'This Year',  emoji: '📆' },
    { val: 'custom', label: 'Custom',     emoji: '✏️' },
    { val: 'all',    label: 'All Time',   emoji: '∞' },
  ];

  const expenseGroupsToShow = filterMain === 'all'
    ? FILTER_EXPENSE_GROUPS
    : FILTER_EXPENSE_GROUPS.filter(g => g.main === filterMain);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="flex-1 sm:hidden" onClick={onClose} />
      <div className="w-full max-w-md mx-auto rounded-t-3xl sm:rounded-3xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 -16px 64px rgba(0,0,0,0.35)', maxHeight: 'calc(100dvh - 80px)', display: 'flex', flexDirection: 'column', marginBottom: '64px' }}
        onClick={e => e.stopPropagation()}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 flex-shrink-0 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-extrabold" style={{ color: 'var(--text)' }}>Filters</h2>
            {activeCount > 0 && (
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--accent)' }}>
                {activeCount} active
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button onClick={reset}
                className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all active:scale-95"
                style={{ color: 'var(--clr-want)', background: 'var(--clr-want-bg)', border: '1px solid var(--clr-want-border)' }}>
                Reset
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pt-5 pb-6 space-y-6">

          {/* ── Time Period ── */}
          <section>
            <SectionLabel>Time Period</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {DATE_OPTS.map(o => {
                const active = dateFilter === o.val;
                return (
                  <button key={o.val} type="button" onClick={() => setDateFilter(o.val)}
                    className="py-3 rounded-2xl text-xs font-bold transition-all active:scale-95 flex flex-col items-center gap-1.5"
                    style={active
                      ? { background: 'var(--accent)', color: '#fff', border: '1.5px solid transparent', boxShadow: '0 4px 14px rgba(124,110,245,0.35)' }
                      : { background: 'var(--bg2)', color: 'var(--text3)', border: '1.5px solid var(--border)' }}>
                    <span className="text-base leading-none">{o.emoji}</span>
                    <span>{o.label}</span>
                  </button>
                );
              })}
            </div>
            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                {[{ label: 'From', val: customFrom, set: setCustomFrom }, { label: 'To', val: customTo, set: setCustomTo }].map(f => (
                  <div key={f.label}>
                    <p className="text-[9px] mb-1.5 font-extrabold tracking-[0.15em] uppercase" style={{ color: 'var(--text4)' }}>{f.label}</p>
                    <input type="date" value={f.val} onChange={e => f.set(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                      style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1.5px solid var(--border)' }} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="h-px" style={{ background: 'var(--border)' }} />

          {/* ── Transaction Type ── */}
          <section>
            <SectionLabel>Transaction Type</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'all' as FilterType,     label: 'All',     emoji: '◎', color: ACCENT_COLOR },
                { v: 'expense' as FilterType, label: 'Expense', emoji: '↑', color: EXPENSE_COLOR },
                { v: 'income' as FilterType,  label: 'Income',  emoji: '↓', color: INCOME_COLOR },
              ]).map(({ v, label, emoji, color }) => (
                <CatPill key={v} emoji={emoji} label={label} active={filterType === v} color={color}
                  onClick={() => { setFilterType(v); setFilterMain('all'); setFilterSub('all'); }} />
              ))}
            </div>
          </section>

          <div className="h-px" style={{ background: 'var(--border)' }} />

          {/* ── Expense Categories ── */}
          {filterType !== 'income' && (
            <section className="space-y-5">
              {/* Main group picker */}
              <div>
                <SectionLabel>Category Group</SectionLabel>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { v: 'all' as FilterMain, label: 'All',    emoji: '✦', color: ACCENT_COLOR },
                    ...FILTER_EXPENSE_GROUPS.map(g => ({ v: g.main, label: g.label, emoji: g.emoji, color: g.color })),
                  ]).map(({ v, label, emoji, color }) => (
                    <button key={v} type="button"
                      onClick={() => { setFilterMain(v); setFilterSub('all'); }}
                      className="py-3 rounded-2xl text-[10px] font-extrabold transition-all flex flex-col items-center gap-1.5 active:scale-95"
                      style={filterMain === v
                        ? { background: color.bg, color: color.text, border: `1.5px solid ${color.border}` }
                        : { background: 'var(--bg2)', color: 'var(--text3)', border: '1.5px solid var(--border)' }}>
                      <span className="text-base leading-none">{emoji}</span>
                      <span className="leading-tight text-center">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-category pills — grouped, same CatPill shape */}
              {expenseGroupsToShow.map(({ main, label, color, items }) => (
                <div key={main}>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color.text }} />
                    <p className="text-[9px] font-extrabold tracking-[0.15em] uppercase" style={{ color: color.text }}>{label}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map(item => (
                      <CatPill key={item.value} emoji={item.emoji} label={item.label}
                        active={filterSub === item.value} color={color}
                        onClick={() => setFilterSub(filterSub === item.value ? 'all' : item.value)} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ── Income Categories ── */}
          {filterType === 'income' && (
            <section>
              <SectionLabel>Income Category</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[{ value: 'all', emoji: '💰', label: 'All Income' }, ...INCOME_FILTER_ITEMS].map(item => (
                  <CatPill key={item.value} emoji={item.emoji} label={item.label}
                    active={item.value === 'all' ? filterSub === 'all' : filterSub === item.value}
                    color={INCOME_COLOR}
                    onClick={() => setFilterSub(item.value === 'all' ? 'all' : item.value)} />
                ))}
              </div>
            </section>
          )}

          {/* ── Apply ── */}
          <button onClick={onClose}
            className="w-full py-4 rounded-2xl font-extrabold text-sm active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, var(--accent), #8b5cf6)', color: '#fff', boxShadow: '0 4px 20px rgba(124,110,245,0.35)' }}>
            Apply{activeCount > 0 ? ` · ${activeCount} filter${activeCount > 1 ? 's' : ''}` : ' Filters'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Banner ─────────────────────────────────────────────────────────────

function ImportBanner({ onImport, onClear }: {
  onImport: (txs: LocalTransaction[], dupeCount: number) => void;
  onClear: () => void;
}) {
  const [status, setStatus]       = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [resultMsg, setResultMsg] = useState('');
  const [dupeMsg, setDupeMsg]     = useState('');
  const [showClear, setShowClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setStatus('loading');
    setResultMsg(''); setDupeMsg('');
    try {
      const all: LocalTransaction[] = [];
      for (const f of Array.from(files)) all.push(...await parseExcel(f));

      const existing = loadExcelTransactions();
      const existingFps = new Set(existing.map(txFingerprint));
      const fresh = all.filter(t => !existingFps.has(txFingerprint(t)));
      const dupeCount = all.length - fresh.length;

      if (fresh.length > 0) {
        await importTransactions(fresh);
      }

      const msg = fresh.length === 0
        ? 'No new transactions found'
        : `${fresh.length} transaction${fresh.length > 1 ? 's' : ''} imported`;
      setResultMsg(msg);
      if (dupeCount > 0) setDupeMsg(`${dupeCount} duplicate${dupeCount > 1 ? 's' : ''} skipped`);

      setStatus('done');
      onImport(fresh, dupeCount);

      // Auto-reset to idle after 4s so button looks fresh for next import
      setTimeout(() => { setStatus('idle'); setResultMsg(''); setDupeMsg(''); }, 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }

  if (showClear) {
    return (
      <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: 'rgba(244,91,91,0.08)', border: '1px solid rgba(244,91,91,0.25)' }}>
        <p className="text-sm font-bold mb-1" style={{ color: '#f45b5b' }}>Clear all transactions?</p>
        <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>Removes all imported and manually added data. Cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={() => { clearAllTransactions(); onClear(); setShowClear(false); setStatus('idle'); setResultMsg(''); setDupeMsg(''); }}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: '#f45b5b', color: '#fff' }}>
            Yes, Clear All
          </button>
          <button onClick={() => setShowClear(false)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 space-y-2">
      <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple className="hidden"
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

      <div className="flex items-stretch gap-2">
        {/* Import button */}
        <button onClick={() => inputRef.current?.click()}
          className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.99]"
          style={{ background: 'var(--card)', border: `1.5px ${status === 'done' ? 'solid rgba(16,217,160,0.4)' : 'dashed var(--border)'}` }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: status === 'done' ? 'rgba(16,217,160,0.12)' : 'rgba(124,110,245,0.12)' }}>
            {status === 'loading'
              ? <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              : status === 'done'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10d9a0" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            }
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-bold" style={{ color: status === 'done' ? '#10d9a0' : 'var(--text)' }}>
              {status === 'loading' ? 'Importing…'
                : status === 'done' ? resultMsg
                : status === 'error' ? 'Import failed — try again'
                : 'Import Excel (.xlsx)'}
            </p>
            <p className="text-[9px]" style={{ color: 'var(--text4)' }}>
              {status === 'done' && dupeMsg ? dupeMsg + ' · tap to import more'
                : status === 'idle' ? 'Supports multiple files · duplicates auto-skipped'
                : ''}
            </p>
          </div>
        </button>

        {/* Clear / trash button — same height as import btn */}
        <button onClick={() => setShowClear(true)}
          className="w-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          title="Clear all transactions">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text4)" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Transaction Card ──────────────────────────────────────────────────────────

function TxCard({ tx, onEdit, onDelete }: { tx: EnrichedTx; onEdit: (tx: EnrichedTx) => void; onDelete: (tx: EnrichedTx) => void }) {
  const [exp, setExp]               = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [revealed, setRevealed]     = useState(false); // touch: swiped; mouse: hovered actions
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isTouch = useRef(false);
  const isIncome = tx.type === 'income';
  const style = MAIN_COLORS[tx.mainCategory] ?? MAIN_COLORS.Want;

  // Close when clicking outside on desktop
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirmDel) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setConfirmDel(false); setRevealed(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [confirmDel]);

  function onTouchStart(e: React.TouchEvent) {
    isTouch.current = true;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (dx > 48 && dy < 30) { setRevealed(true); setConfirmDel(false); }
    if (dx < -48 && dy < 30) { setRevealed(false); setConfirmDel(false); }
  }

  return (
    <div ref={cardRef} className="relative rounded-2xl" style={{ boxShadow: 'var(--shadow-card)' }}>

      {/* ── Mobile swipe action buttons (behind card) ── */}
      <div className="sm:hidden absolute inset-y-0 right-0 flex items-stretch rounded-r-2xl overflow-hidden"
        style={{ opacity: revealed ? 1 : 0, transition: 'opacity 0.18s', pointerEvents: revealed ? 'auto' : 'none' }}>
        {confirmDel ? (
          <>
            <button onClick={() => { onDelete(tx); setRevealed(false); setConfirmDel(false); }}
              className="flex flex-col items-center justify-center gap-0.5 px-5 font-bold text-xs"
              style={{ background: 'var(--expense)', color: '#fff' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              Confirm
            </button>
            <button onClick={() => setConfirmDel(false)}
              className="flex flex-col items-center justify-center gap-0.5 px-4 font-bold text-xs"
              style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => { setRevealed(false); onEdit(tx); }}
              className="flex flex-col items-center justify-center gap-0.5 px-5 font-bold text-xs"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="flex flex-col items-center justify-center gap-0.5 px-5 font-bold text-xs"
              style={{ background: 'rgba(244,91,91,0.15)', color: 'var(--expense)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              Delete
            </button>
          </>
        )}
      </div>

      {/* ── Card body ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (revealed) { setRevealed(false); return; } setExp(v => !v); }}
        className="flex overflow-hidden cursor-pointer rounded-2xl"
        style={{
          background: 'var(--card)',
          border: '1.5px solid var(--border)',
          transform: revealed ? 'translateX(-148px)' : 'translateX(0)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}>
        <div className="w-[3px] self-stretch flex-shrink-0" style={{ background: style.text }} />

        <div className="flex items-center gap-3 flex-1 px-3.5 py-3.5 sm:px-4 sm:py-4">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: style.bg, border: `1.5px solid ${style.border}` }}>
            {SUB_ICONS[tx.subCategory] ?? '💳'}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug truncate" style={{ color: 'var(--text)', fontSize: 14, letterSpacing: '-0.01em' }}>
              {tx.comment || tx.subCategory}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 700, background: style.bg, color: style.text, border: `1.5px solid ${style.border}` }}>
                {isIncome ? tx.subCategory : tx.mainCategory === tx.subCategory ? tx.mainCategory : `${tx.mainCategory} · ${tx.subCategory}`}
              </span>
            </div>
            {exp && tx.comment && tx.comment !== tx.subCategory && (
              <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text3)' }}>{tx.comment}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Desktop: always-visible action buttons */}
            {confirmDel ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <button onClick={(e) => { e.stopPropagation(); onDelete(tx); setConfirmDel(false); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                  style={{ background: 'var(--expense)', color: '#fff' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  Sure?
                </button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDel(false); }}
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all active:scale-95"
                  style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>✕</button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); onEdit(tx); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95 hover:scale-105"
                  style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                  title="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95 hover:scale-105"
                  style={{ background: 'rgba(244,91,91,0.1)', color: 'var(--expense)', border: '1px solid rgba(244,91,91,0.2)' }}
                  title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            )}

            <div className="flex flex-col items-end gap-1">
              <span style={{ fontSize: 14, fontWeight: 800, color: isIncome ? 'var(--income)' : 'var(--expense)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                {isIncome ? '+' : '-'}{INR(tx.amount)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{fmtDateShort(tx.date)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Active filter chips ───────────────────────────────────────────────────────

function ActiveFilters({
  filterType, filterMain, filterSub, dateFilter,
  onOpenFilter, activeCount,
}: {
  filterType: FilterType; filterMain: FilterMain; filterSub: string;
  dateFilter: DateFilter; onOpenFilter: () => void; activeCount: number;
}) {
  const chips: string[] = [];
  if (dateFilter !== 'all') chips.push({ today:'Today', week:'This Week', month:'This Month', year:'This Year', custom:'Custom', all:'' }[dateFilter]);
  if (filterType !== 'all') chips.push(filterType.charAt(0).toUpperCase() + filterType.slice(1));
  if (filterMain !== 'all') chips.push(filterMain);
  if (filterSub !== 'all') chips.push(filterSub);

  return (
    <div className="px-4 mb-3 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <button onClick={onOpenFilter}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0 transition-all"
        style={activeCount > 0
          ? { background: 'var(--accent)', color: '#fff' }
          : { background: 'var(--card)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        <span className="text-xs font-bold">Filter{activeCount > 0 ? ` · ${activeCount}` : ''}</span>
      </button>
      {chips.map(chip => (
        <span key={chip} className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{ background: 'rgba(124,110,245,0.12)', color: 'var(--accent)' }}>
          {chip}
        </span>
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [excelTxs, setExcelTxs]   = useState<LocalTransaction[]>([]);
  const [manualTxs, setManualTxs] = useState<LocalTransaction[]>([]);
  const [hydrated, setHydrated]   = useState(false);

  const [showAdd, setShowAdd]         = useState(false);
  const [showFilter, setShowFilter]   = useState(false);
  const [showExport, setShowExport]   = useState(false);
  const [editTx, setEditTx]           = useState<EnrichedTx | null>(null);
  const [search, setSearch]           = useState('');

  const [filterType, setFilterType]   = useState<FilterType>('all');
  const [filterMain, setFilterMain]   = useState<FilterMain>('all');
  const [filterSub, setFilterSub]     = useState('all');
  const [dateFilter, setDateFilter]   = useState<DateFilter>('all');
  const [customFrom, setCustomFrom]   = useState('');
  const [customTo, setCustomTo]       = useState('');
  const [page, setPage]               = useState(1);
  const PAGE_SIZE = 20;

  // Load: localStorage first (instant), then merge Supabase (fresh)
  useEffect(() => {
    const local = [...loadManualTransactions(), ...loadExcelTransactions()];
    local.sort((a, b) => b.date.localeCompare(a.date));
    setExcelTxs(loadExcelTransactions());
    setManualTxs(loadManualTransactions());
    setHydrated(true);

    fetchAllTransactions().then(remote => {
      const localIds = new Set(local.map(l => l.id));
      const remoteIds = new Set(remote.map(r => r.id));
      const merged = [...remote, ...local.filter(l => !remoteIds.has(l.id))];
      merged.sort((a, b) => b.date.localeCompare(a.date));
      const manualKeys = new Set(loadManualTransactions().map(t => t.id));
      setManualTxs(merged.filter(t => manualKeys.has(t.id) || !localIds.has(t.id)));
      setExcelTxs(merged.filter(t => !manualKeys.has(t.id) && localIds.has(t.id)));
    }).catch(() => {});
  }, []);

  const allRaw = useMemo(() => {
    const combined = [...manualTxs, ...excelTxs];
    combined.sort((a, b) => b.date.localeCompare(a.date));
    return combined;
  }, [manualTxs, excelTxs]);

  const allTxs = useMemo(() => enrich(allRaw), [allRaw]);

  const activeFilterCount = [
    dateFilter !== 'all', filterType !== 'all', filterMain !== 'all', filterSub !== 'all',
  ].filter(Boolean).length;

  useEffect(() => { setPage(1); }, [search, filterType, filterMain, filterSub, dateFilter, customFrom, customTo]);

  const filtered = useMemo(() => {
    const range = dateRangeFor(dateFilter, { from: customFrom, to: customTo });
    return allTxs.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterMain !== 'all' && t.mainCategory !== filterMain) return false;
      if (filterSub !== 'all' && t.subCategory !== filterSub) return false;
      if (range) {
        const d = t.date.slice(0, 10);
        if (d < range.from || d > range.to) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!t.comment.toLowerCase().includes(q) && !t.subCategory.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allTxs, filterType, filterMain, filterSub, dateFilter, customFrom, customTo, search]);

  const visible  = filtered.slice(0, page * PAGE_SIZE);
  const hasMore  = visible.length < filtered.length;

  const income  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net     = income - expense;

  const grouped = useMemo(() => {
    const map = new Map<string, EnrichedTx[]>();
    for (const t of visible) {
      const d = t.date.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    }
    return Array.from(map.entries());
  }, [visible]);

  const handleAdded = useCallback((tx: LocalTransaction) => {
    setManualTxs(prev => [tx, ...prev]);
    setShowAdd(false);
    createTransaction(tx).catch(() => {});
  }, []);

  const handleDelete = useCallback((tx: EnrichedTx) => {
    setManualTxs(prev => prev.filter(t => t.id !== tx.id));
    setExcelTxs(prev => prev.filter(t => t.id !== tx.id));
    removeTransaction(tx.id).catch(() => {});
  }, []);

  const handleSaved = useCallback((updated: LocalTransaction) => {
    setManualTxs(prev => prev.map(t => t.id === updated.id ? updated : t));
    setExcelTxs(prev => prev.map(t => t.id === updated.id ? updated : t));
    setEditTx(null);
    editTransaction(updated).catch(() => {});
  }, []);

  const handleImport = useCallback((_fresh: LocalTransaction[]) => {
    setExcelTxs(loadExcelTransactions());
  }, []);

  const handleClear = useCallback(() => {
    setExcelTxs([]); setManualTxs([]);
  }, []);

  // Date label for header
  const periodLabel = useMemo(() => {
    if (dateFilter === 'today') return 'Today';
    if (dateFilter === 'week') return 'This Week';
    if (dateFilter === 'month') return 'This Month';
    if (dateFilter === 'year') return 'This Year';
    if (dateFilter === 'custom' && customFrom && customTo) return `${customFrom} → ${customTo}`;
    return 'All Time';
  }, [dateFilter, customFrom, customTo]);

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto pb-28 min-h-screen px-0 md:px-4 lg:px-6" style={{ backgroundColor: 'var(--bg)' }}>

      {/* Header */}
      <header className="px-5 md:px-6 pt-10 md:pt-14 pb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-[28px] font-black tracking-tight leading-none" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>Transactions</h1>
            <p className="text-[12px] mt-1.5 font-medium" style={{ color: 'var(--text2)', letterSpacing: '0.01em' }}>{periodLabel} · {filtered.length} entries</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
              style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1.5px solid var(--accent-border)' }}
            >
              <span>📤</span><span>Export</span>
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Summary strip */}
        {hydrated && allTxs.length > 0 && (
          <div className="flex gap-2.5">
            {[
              { label: 'Income',  val: income,  color: 'var(--income)',  bg: 'rgba(16,217,160,0.10)', border: 'rgba(16,217,160,0.25)', sign: '+' },
              { label: 'Expense', val: expense, color: 'var(--expense)', bg: 'rgba(244,91,91,0.10)',  border: 'rgba(244,91,91,0.25)',  sign: '-' },
              { label: 'Net',     val: Math.abs(net), color: net >= 0 ? 'var(--income)' : 'var(--expense)',
                bg: net >= 0 ? 'rgba(16,217,160,0.10)' : 'rgba(244,91,91,0.10)',
                border: net >= 0 ? 'rgba(16,217,160,0.25)' : 'rgba(244,91,91,0.25)',
                sign: net >= 0 ? '+' : '-' },
            ].map(c => (
              <div key={c.label} className="flex-1 rounded-2xl px-3 py-3.5"
                style={{ background: c.bg, border: `1.5px solid ${c.border}` }}>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5, color: 'var(--text3)' }}>{c.label}</p>
                <p style={{ fontSize: 13, fontWeight: 900, color: c.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{c.sign}{INR(c.val)}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Search notes, categories…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: 'var(--text)', caretColor: 'var(--accent)', fontSize: 14, fontWeight: 500 }}
            onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'var(--accent)'; }}
            onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'var(--border)'; }} />
          {search && (
            <button onClick={() => setSearch('')}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>✕</button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <ActiveFilters
        filterType={filterType} filterMain={filterMain} filterSub={filterSub}
        dateFilter={dateFilter} onOpenFilter={() => setShowFilter(true)}
        activeCount={activeFilterCount}
      />

      {/* Import Excel */}
      <ImportBanner onImport={handleImport} onClear={handleClear} />

      {/* Charts */}
      {hydrated && <SpendCharts txs={filtered} />}

      {/* Transactions */}
      <div className="px-4 space-y-5">
        {!hydrated ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">{allTxs.length === 0 ? '📂' : '🔍'}</div>
            <p className="text-sm font-bold" style={{ color: 'var(--text2)' }}>
              {allTxs.length === 0 ? 'No transactions yet' : 'No results found'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text4)' }}>
              {allTxs.length === 0 ? 'Import an Excel file or tap + to add manually' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          grouped.map(([date, txs]) => {
            const dayNet = txs.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
            return (
              <div key={date}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)', letterSpacing: '0.01em', flexShrink: 0 }}>{fmtDateHeader(date)}</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: dayNet >= 0 ? 'var(--income)' : 'var(--expense)', flexShrink: 0 }}>
                    {dayNet >= 0 ? '+' : ''}{INR(dayNet)}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {txs.map(tx => <TxCard key={tx.id} tx={tx} onEdit={setEditTx} onDelete={handleDelete} />)}
                </div>
              </div>
            );
          })
        )}

        {hasMore && (
          <button onClick={() => setPage(p => p + 1)}
            className="w-full rounded-2xl transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 800, letterSpacing: '0.01em' }}>
                Load {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
              </span>
            </div>
            <span style={{ color: 'var(--text4)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em' }}>
              {filtered.length - visible.length} of {filtered.length} transactions remaining
            </span>
          </button>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAdd(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all z-40"
        style={{ background: 'linear-gradient(135deg, var(--accent), #8b5cf6)', boxShadow: '0 4px 20px rgba(79,70,229,0.5)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
      {editTx  && <EditTransactionModal transaction={editTx} onClose={() => setEditTx(null)} onSaved={handleSaved} />}
      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          transactions={allRaw}
          wealth={EMPTY_WEALTH}
        />
      )}
      {showFilter && (
        <FilterSheet
          filterType={filterType} setFilterType={setFilterType}
          filterMain={filterMain} setFilterMain={setFilterMain}
          filterSub={filterSub}   setFilterSub={setFilterSub}
          dateFilter={dateFilter} setDateFilter={setDateFilter}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo}     setCustomTo={setCustomTo}
          onClose={() => setShowFilter(false)}
        />
      )}
    </div>
  );
}
