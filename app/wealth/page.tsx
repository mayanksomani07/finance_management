'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── helpers ───────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function pnlColor(i: number, c: number) { return c >= i ? '#00d9a6' : '#ff6b6b'; }

function pnlSign(i: number, c: number) {
  const diff = c - i;
  const pct = i > 0 ? (diff / i) * 100 : 0;
  return `${diff >= 0 ? '+' : ''}${fmtShort(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
}

// ─── types ─────────────────────────────────────────────────────────────────

interface ManualData { value: number; updated_at: string; note?: string; }
interface Bucket { invested: number; current: number; }
interface ZerodhaLiveData {
  success: boolean; invested?: number; current?: number; error?: string; fetched_at?: string;
  breakdown?: {
    equity?: Bucket; gold?: Bucket; silver?: Bucket; foreign?: Bucket; debt?: Bucket;
  };
}
interface CoinLiveData { success: boolean; current?: number; invested_breakdown?: { from_trades: number; trade_count: number; note?: string }; error?: string; fetched_at?: string; }
interface IndMoneyLiveData { success: boolean; invested?: number; current?: number; error?: string; fetched_at?: string; }

interface XlsxBreakdown { invested: number; current: number; }
interface XlsxResult {
  success: boolean;
  error?: string;
  equity?: {
    equity: XlsxBreakdown;
    gold_silver: XlsxBreakdown;
    foreign_etf: XlsxBreakdown;
    total: XlsxBreakdown;
  };
  mf?: {
    equity: XlsxBreakdown;
    gold_silver: XlsxBreakdown;
    debt: XlsxBreakdown;
    total: XlsxBreakdown;
  };
}

// ─── editable field ────────────────────────────────────────────────────────

function EditableField({
  label,
  fieldKey,
  value,
  note,
  onSaved,
  liveValue,
  liveLabel,
}: {
  label: string;
  fieldKey: string;
  value: number | undefined;
  note?: string;
  onSaved: () => void;
  liveValue?: number;
  liveLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [noteVal, setNoteVal] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setVal(value !== undefined ? String(value) : '');
    setNoteVal(note ?? '');
    setEditing(true);
  }

  async function save() {
    if (!val) return;
    setSaving(true);
    await fetch('/api/wealth/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: fieldKey, value: parseFloat(val), note: noteVal }),
    });
    setSaving(false);
    setEditing(false);
    onSaved();
  }

  // Show live value as a side note if available and different from stored
  const showLive = liveValue !== undefined && liveValue !== value;

  if (editing) {
    return (
      <div className="space-y-1.5 mt-1">
        <div className="flex items-center gap-2 bg-[#0f0f23] rounded-xl px-3 py-2">
          <span className="text-[#8888aa] text-sm">₹</span>
          <input
            type="number"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-white text-sm outline-none"
            inputMode="decimal"
          />
        </div>
        <input
          type="text"
          value={noteVal}
          onChange={(e) => setNoteVal(e.target.value)}
          placeholder="Note (optional)"
          className="w-full bg-[#0f0f23] rounded-xl px-3 py-2 text-white text-sm outline-none placeholder:text-[#8888aa]"
        />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !val} className="flex-1 py-2 rounded-xl bg-[#6c63ff] text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl bg-[#2a2a4a] text-[#8888aa] text-sm">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mt-1 group">
      <div>
        <span className="text-xs text-[#8888aa]">{label}</span>
        {note && <span className="text-[10px] text-[#555577] ml-1">· {note}</span>}
      </div>
      <div className="flex items-center gap-2">
        {showLive && (
          <span className="text-[10px] text-[#00d9a6]" title={liveLabel ?? 'Live value'}>
            {fmtShort(liveValue!)} live
          </span>
        )}
        <button onClick={startEdit} className="flex items-center gap-1">
          <span className="text-sm font-semibold text-white">{value !== undefined ? fmt(value) : <span className="text-[#555577]">tap to set</span>}</span>
          <EditIcon />
        </button>
      </div>
    </div>
  );
}

// ─── XLSX import (combined Kite + Coin) ────────────────────────────────────

function XlsxImport({ onImported }: { onImported: (result: XlsxResult) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<XlsxResult | null>(null);
  const [open, setOpen] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('loading');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/wealth/zerodha-xlsx', { method: 'POST', body: fd });
      const json: XlsxResult = await res.json();
      setResult(json);
      setStatus(json.success ? 'done' : 'error');
      if (json.success) onImported(json);
    } catch {
      setStatus('error');
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="mt-2 pt-2 border-t border-[#2a2a4a]">
      <button onClick={() => setOpen((v) => !v)} className="text-[10px] text-[#6c63ff] flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import from Zerodha XLSX {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[10px] text-[#555577]">
            Download: <span className="text-[#8888aa]">console.zerodha.com → Portfolio → Holdings → ⬇ Download</span> (XLSX)
          </p>
          <p className="text-[10px] text-[#555577]">
            The file contains Equity + Mutual Fund sheets — both are parsed automatically.
          </p>
          <label className="block">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <span className="inline-block px-3 py-1.5 rounded-lg bg-[#2a2a4a] text-[#8888aa] text-xs cursor-pointer active:opacity-70">
              {status === 'loading' ? 'Parsing…' : 'Choose Holdings XLSX'}
            </span>
          </label>
          {status === 'done' && result?.success && (
            <div className="space-y-0.5">
              {result.equity && result.equity.total.invested > 0 && (
                <p className="text-[10px] text-[#00d9a6]">
                  ✓ Equity total · Invested {fmtShort(result.equity.total.invested)} · Current {fmtShort(result.equity.total.current)}
                </p>
              )}
              {result.mf && result.mf.total.invested > 0 && (
                <p className="text-[10px] text-[#00d9a6]">
                  ✓ MF total · Invested {fmtShort(result.mf.total.invested)} · Current {fmtShort(result.mf.total.current)}
                </p>
              )}
            </div>
          )}
          {status === 'error' && (
            <p className="text-[10px] text-[#ff6b6b]">{result?.error ?? 'Parse failed — check file format'}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── section card ──────────────────────────────────────────────────────────

function Section({
  title, icon, badge, accentColor, children, invested, current, loading,
}: {
  title: string; icon: React.ReactNode; badge?: string; accentColor: string;
  children: React.ReactNode; invested?: number; current?: number; loading?: boolean;
}) {
  const hasPnl = invested !== undefined && current !== undefined && (invested > 0 || current > 0);
  return (
    <div className="rounded-2xl bg-[#1a1a2e] border border-[#2a2a4a] overflow-hidden" style={{ borderTop: `2px solid ${accentColor}` }}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span style={{ color: accentColor }}>{icon}</span>
            <span className="text-sm font-semibold text-white">{title}</span>
            {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2a2a4a] text-[#8888aa]">{badge}</span>}
          </div>
          {loading && <div className="w-3.5 h-3.5 border border-[#6c63ff] border-t-transparent rounded-full animate-spin" />}
        </div>
        {hasPnl && !loading && (
          <div className="flex items-end justify-between mt-2 mb-1">
            <div>
              <p className="text-[10px] text-[#8888aa] uppercase tracking-wide">Current</p>
              <p className="text-xl font-bold text-white">{fmtShort(current!)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#8888aa] uppercase tracking-wide">P&amp;L</p>
              <p className="text-xs font-semibold" style={{ color: pnlColor(invested!, current!) }}>{pnlSign(invested!, current!)}</p>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-[#2a2a4a] px-4 py-3 space-y-0.5">{children}</div>
    </div>
  );
}

function LiveRow({ label, value, fetchedAt, onRefresh }: { label: string; value: number; fetchedAt?: string; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between mt-1">
      <div>
        <p className="text-xs text-[#8888aa]">{label}</p>
        {fetchedAt && (
          <p className="text-[10px] text-[#00d9a6] flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d9a6] inline-block" />
            Live · {new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">{fmt(value)}</span>
        <button onClick={onRefresh} className="text-[10px] text-[#6c63ff]">↻</button>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-2 pt-2 border-t border-[#2a2a4a]">
      <p className="text-[10px] text-[#555577] mb-1">{label}</p>
    </div>
  );
}

// ─── main page ─────────────────────────────────────────────────────────────

export default function WealthPage() {
  const [manual, setManual] = useState<Record<string, ManualData>>({});
  const [equityLive, setEquityLive] = useState<ZerodhaLiveData | null>(null);
  const [mfLive, setMfLive] = useState<ZerodhaLiveData | null>(null);
  const [cryptoLive, setCryptoLive] = useState<CoinLiveData | null>(null);
  const [indmoneyLive, setIndmoneyLive] = useState<IndMoneyLiveData | null>(null);
  const [loadingManual, setLoadingManual] = useState(true);
  const [loadingEquity, setLoadingEquity] = useState(false);
  const [loadingMf, setLoadingMf] = useState(false);
  const [loadingCrypto, setLoadingCrypto] = useState(false);
  const [loadingIndmoney, setLoadingIndmoney] = useState(false);

  const loadManual = useCallback(async () => {
    setLoadingManual(true);
    try {
      const res = await fetch('/api/wealth/manual');
      const json = await res.json();
      if (json.success) setManual(json.data);
    } finally {
      setLoadingManual(false);
    }
  }, []);

  const loadEquity = useCallback(async () => {
    setLoadingEquity(true);
    try { setEquityLive(await (await fetch('/api/wealth/zerodha?type=equity')).json()); } finally { setLoadingEquity(false); }
  }, []);

  const loadMf = useCallback(async () => {
    setLoadingMf(true);
    try { setMfLive(await (await fetch('/api/wealth/zerodha?type=mf')).json()); } finally { setLoadingMf(false); }
  }, []);

  const loadCrypto = useCallback(async () => {
    setLoadingCrypto(true);
    try { setCryptoLive(await (await fetch('/api/wealth/coindcx')).json()); } finally { setLoadingCrypto(false); }
  }, []);

  const loadIndmoney = useCallback(async () => {
    setLoadingIndmoney(true);
    try { setIndmoneyLive(await (await fetch('/api/wealth/indmoney')).json()); } finally { setLoadingIndmoney(false); }
  }, []);

  useEffect(() => {
    loadManual();
    loadEquity();
    loadMf();
    loadCrypto();
    loadIndmoney();
  }, [loadManual, loadEquity, loadMf, loadCrypto, loadIndmoney]);

  // Pick up OAuth redirect params (?indmoney_connected=1, ?kite_connected=1, etc.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('indmoney_connected') === '1') {
      loadIndmoney();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('indmoney_error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('kite_connected') === '1') {
      loadEquity();
      loadMf();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('kite_error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadIndmoney, loadEquity, loadMf]);

  function mv(key: string) { return manual[key]?.value; }
  function mn(key: string) { return manual[key]?.note; }

  // Save XLSX import result to all manual keys
  async function saveXlsxResult(result: XlsxResult) {
    const saves: Promise<Response>[] = [];
    function put(key: string, value: number) {
      saves.push(fetch('/api/wealth/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, note: 'from Zerodha XLSX' }),
      }));
    }
    if (result.equity) {
      put('equity_invested', result.equity.equity.invested);
      put('equity_current', result.equity.equity.current);
      put('equity_gold_invested', result.equity.gold_silver.invested);
      put('equity_gold_current', result.equity.gold_silver.current);
      put('equity_foreign_invested', result.equity.foreign_etf.invested);
      put('equity_foreign_current', result.equity.foreign_etf.current);
      put('equity_total_invested', result.equity.total.invested);
      put('equity_total_current', result.equity.total.current);
    }
    if (result.mf) {
      put('mf_equity_invested', result.mf.equity.invested);
      put('mf_equity_current', result.mf.equity.current);
      put('mf_gold_invested', result.mf.gold_silver.invested);
      put('mf_gold_current', result.mf.gold_silver.current);
      put('mf_debt_invested', result.mf.debt.invested);
      put('mf_debt_current', result.mf.debt.current);
      put('mf_total_invested', result.mf.total.invested);
      put('mf_total_current', result.mf.total.current);
    }
    await Promise.all(saves);
    loadManual();
  }

  // ── resolve values — live API breakdown preferred, manual/XLSX fallback ──────
  const eb = equityLive?.breakdown;
  const mb = mfLive?.breakdown;

  // Equity plain stocks
  const equityInvested    = eb?.equity?.invested ?? mv('equity_invested')         ?? 0;
  const equityCurrent     = eb?.equity?.current  ?? mv('equity_current')          ?? 0;
  // Equity Gold ETF
  const eqGoldInvested    = eb?.gold?.invested   ?? mv('equity_gold_invested')    ?? 0;
  const eqGoldCurrent     = eb?.gold?.current    ?? mv('equity_gold_current')     ?? 0;
  // Equity Silver ETF (new — was merged with gold before)
  const eqSilverInvested  = eb?.silver?.invested ?? mv('equity_silver_invested')  ?? 0;
  const eqSilverCurrent   = eb?.silver?.current  ?? mv('equity_silver_current')   ?? 0;
  // Equity Foreign ETF
  const eqForeignInvested = eb?.foreign?.invested ?? mv('equity_foreign_invested') ?? 0;
  const eqForeignCurrent  = eb?.foreign?.current  ?? mv('equity_foreign_current')  ?? 0;
  // Equity total
  const eqTotalInvested   = equityLive?.success ? (equityLive.invested ?? 0) : (mv('equity_total_invested') ?? (equityInvested + eqGoldInvested + eqSilverInvested + eqForeignInvested));
  const eqTotalCurrent    = equityLive?.success ? (equityLive.current  ?? 0) : (mv('equity_total_current')  ?? (equityCurrent  + eqGoldCurrent  + eqSilverCurrent  + eqForeignCurrent));

  // MF Equity
  const mfEquityInvested  = mb?.equity?.invested ?? mv('mf_equity_invested')      ?? 0;
  const mfEquityCurrent   = mb?.equity?.current  ?? mv('mf_equity_current')       ?? 0;
  // MF Gold (SBI Gold Fund etc.)
  const mfGoldInvested    = mb?.gold?.invested   ?? mv('mf_gold_invested')        ?? 0;
  const mfGoldCurrent     = mb?.gold?.current    ?? mv('mf_gold_current')         ?? 0;
  // MF Silver (Kotak Silver ETF FoF etc.)
  const mfSilverInvested  = mb?.silver?.invested ?? mv('mf_silver_invested')      ?? 0;
  const mfSilverCurrent   = mb?.silver?.current  ?? mv('mf_silver_current')       ?? 0;
  // MF Debt
  const mfDebtInvested    = mb?.debt?.invested   ?? mv('mf_debt_invested')        ?? 0;
  const mfDebtCurrent     = mb?.debt?.current    ?? mv('mf_debt_current')         ?? 0;
  // MF total
  const mfTotalInvested   = mfLive?.success ? (mfLive.invested ?? 0) : (mv('mf_total_invested') ?? (mfEquityInvested + mfGoldInvested + mfSilverInvested + mfDebtInvested));
  const mfTotalCurrent    = mfLive?.success ? (mfLive.current  ?? 0) : (mv('mf_total_current')  ?? (mfEquityCurrent  + mfGoldCurrent  + mfSilverCurrent  + mfDebtCurrent));

  // IND Money – Foreign Equity (US stocks) — prefer live MCP data, fall back to manual
  const indmoneyInvested   = indmoneyLive?.success ? (indmoneyLive.invested ?? 0) : (mv('indmoney_foreign_invested') ?? 0);
  const indmoneyCurrent    = indmoneyLive?.success ? (indmoneyLive.current  ?? 0) : (mv('indmoney_foreign_current')  ?? 0);

  // Crypto — invested is manual (CoinDCX API only returns recent trades, not full history)
  const cryptoInvested     = mv('crypto_invested') ?? 0;
  const cryptoCurrent      = cryptoLive?.success ? (cryptoLive.current ?? 0) : (mv('crypto_current') ?? 0);

  // Bank & Cash — simplified
  const bankBalance        = mv('bank_balance') ?? 0;
  const cashInHand         = mv('cash_in_hand') ?? 0;
  const mobikwik           = mv('mobikwik') ?? 0;

  const creditCardDue      = mv('credit_card_due') ?? 0;
  const payToSomeone       = mv('pay_to_someone') ?? 0;
  const bondInvested       = mv('bond_invested') ?? 0;  const bondCurrent = mv('bond_current') ?? 0;
  const fdInvested         = mv('fd_invested')   ?? 0;  const fdCurrent   = mv('fd_current')   ?? 0;
  const pfInvested         = mv('pf_invested')   ?? 0;  const pfCurrent   = mv('pf_current')   ?? 0;

  const debtInvested       = bondInvested + fdInvested;
  const debtCurrent        = bondCurrent + fdCurrent;
  const bankTotal          = bankBalance + cashInHand + mobikwik;
  const totalAssets        = bankTotal + eqTotalCurrent + mfTotalCurrent + indmoneyCurrent + cryptoCurrent + debtCurrent + pfCurrent;
  const totalLiabilities   = creditCardDue + payToSomeone;
  const netWorth           = totalAssets - totalLiabilities;

  if (loadingManual) {
    return <div className="flex justify-center items-center min-h-screen"><div className="w-8 h-8 border-2 border-[#6c63ff] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-md mx-auto pb-28">
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">Wealth</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">Net worth snapshot · tap any value to edit</p>
      </header>

      {/* Net Worth Hero */}
      <div className="mx-4 mb-6 rounded-2xl bg-[#1a1a2e] border border-[#2a2a4a] p-5" style={{ borderTop: '2px solid #6c63ff' }}>
        <p className="text-xs text-[#8888aa] uppercase tracking-wider mb-1">Total Net Worth</p>
        <p className="text-4xl font-bold text-white mb-3">{fmtShort(netWorth)}</p>
        <div className="flex items-center gap-4 pt-3 border-t border-[#2a2a4a]">
          <div><p className="text-[10px] text-[#8888aa]">Assets</p><p className="text-sm font-semibold text-[#00d9a6]">{fmtShort(totalAssets)}</p></div>
          <div className="w-px h-8 bg-[#2a2a4a]" />
          <div><p className="text-[10px] text-[#8888aa]">Liabilities</p><p className="text-sm font-semibold text-[#ff6b6b]">{fmtShort(totalLiabilities)}</p></div>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── BANK & CASH ── */}
        <Section title="Bank & Cash" icon={<BankIcon />} badge="SBI YONO · Manual" accentColor="#3b82f6"
          current={bankTotal} invested={bankTotal}>
          <EditableField label="SBI Bank Balance" fieldKey="bank_balance" value={mv('bank_balance')} note={mn('bank_balance')} onSaved={loadManual} />
          <EditableField label="Cash in Hand" fieldKey="cash_in_hand" value={mv('cash_in_hand')} note={mn('cash_in_hand')} onSaved={loadManual} />
          <EditableField label="Mobikwik Wallet" fieldKey="mobikwik" value={mv('mobikwik')} note={mn('mobikwik')} onSaved={loadManual} />
          {bankTotal > 0 && (
            <div className="flex justify-between mt-2 pt-2 border-t border-[#2a2a4a]">
              <span className="text-xs text-white">Total</span>
              <span className="text-sm font-bold text-white">{fmt(bankTotal)}</span>
            </div>
          )}
        </Section>

        {/* ── LIABILITIES ── */}
        <Section title="Liabilities" icon={<CardIcon />} accentColor="#ff6b6b">
          <EditableField label="Credit Card Due" fieldKey="credit_card_due" value={mv('credit_card_due')} onSaved={loadManual} />
          <Divider label="Pay To Someone" />
          <EditableField label="Amount Owed" fieldKey="pay_to_someone" value={mv('pay_to_someone')} note={mn('pay_to_someone')} onSaved={loadManual} />
        </Section>

        {/* ── ZERODHA (Kite + Coin combined) ── */}
        <Section title="Zerodha (Kite + Coin)" icon={<ChartIcon />} badge="Holdings XLSX" accentColor="#00d9a6"
          invested={eqTotalInvested + mfTotalInvested} current={eqTotalCurrent + mfTotalCurrent}
          loading={loadingEquity || loadingMf}>

          {/* Connection status */}
          {(equityLive?.success || mfLive?.success) ? (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[#00d9a6] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d9a6] inline-block" />
                Connected via Kite Connect
              </span>
              <a href="/api/kite/disconnect" className="text-[10px] text-[#555577] hover:text-[#ff6b6b] transition-colors">Disconnect</a>
            </div>
          ) : (
            <div className="mb-3">
              {(equityLive?.error === 'not_connected' || equityLive?.error === 'token_expired' || !equityLive) && (
                <p className="text-[10px] text-[#555577] mb-2">
                  {equityLive?.error === 'token_expired'
                    ? 'Session expired (Kite tokens reset daily) — reconnect to refresh.'
                    : 'Connect your Zerodha account to fetch live holdings automatically.'}
                </p>
              )}
              {equityLive?.error && equityLive.error !== 'not_connected' && equityLive.error !== 'token_expired' && equityLive.error !== 'not_configured' && (
                <p className="text-[10px] text-[#ff6b6b] mb-1">Error: {equityLive.error}</p>
              )}
              <a
                href="/api/kite/connect"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00d9a6] text-black text-xs font-semibold mb-2"
              >
                <ChartIcon /> Connect Zerodha (Kite + Coin)
              </a>
              <p className="text-[10px] text-[#555577]">
                Requires a free Kite Connect Personal app — register at{' '}
                <span className="text-[#8888aa]">kite.trade/developers</span> then add{' '}
                <span className="text-[#8888aa]">ZERODHA_API_KEY</span> +{' '}
                <span className="text-[#8888aa]">ZERODHA_API_SECRET</span> to .env.local
              </p>
            </div>
          )}

          {/* ── Equity sub-section ── */}
          <Divider label="Equity – Stocks" />
          <LiveOrEditRow label="Invested"      live={eb?.equity?.invested} fieldKey="equity_invested"  value={mv('equity_invested')}  note={mn('equity_invested')}  kiteConnected={!!equityLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={eb?.equity?.current}  fieldKey="equity_current"   value={mv('equity_current')}   note={mn('equity_current')}   kiteConnected={!!equityLive?.success} onSaved={loadManual} />

          <Divider label="Equity – Gold ETF (GOLDBEES, GOLDETF, SETFGOLD…)" />
          <LiveOrEditRow label="Invested"      live={eb?.gold?.invested}   fieldKey="equity_gold_invested"  value={mv('equity_gold_invested')}  note={mn('equity_gold_invested')}  kiteConnected={!!equityLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={eb?.gold?.current}    fieldKey="equity_gold_current"   value={mv('equity_gold_current')}   note={mn('equity_gold_current')}   kiteConnected={!!equityLive?.success} onSaved={loadManual} />

          <Divider label="Equity – Silver ETF (SILVER…)" />
          <LiveOrEditRow label="Invested"      live={eb?.silver?.invested} fieldKey="equity_silver_invested" value={mv('equity_silver_invested')} note={mn('equity_silver_invested')} kiteConnected={!!equityLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={eb?.silver?.current}  fieldKey="equity_silver_current"  value={mv('equity_silver_current')}  note={mn('equity_silver_current')}  kiteConnected={!!equityLive?.success} onSaved={loadManual} />

          <Divider label="Equity – Foreign ETF (MON100, MAFANG…)" />
          <LiveOrEditRow label="Invested"      live={eb?.foreign?.invested} fieldKey="equity_foreign_invested" value={mv('equity_foreign_invested')} note={mn('equity_foreign_invested')} kiteConnected={!!equityLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={eb?.foreign?.current}  fieldKey="equity_foreign_current"  value={mv('equity_foreign_current')}  note={mn('equity_foreign_current')}  kiteConnected={!!equityLive?.success} onSaved={loadManual} />

          <TotalRow label="Equity Total" accentColor="#00d9a6" invested={eqTotalInvested} current={eqTotalCurrent} fetchedAt={equityLive?.success ? equityLive.fetched_at : undefined} onRefresh={loadEquity} />

          {/* ── MF sub-section ── */}
          <Divider label="MF – Equity Funds" />
          <LiveOrEditRow label="Invested"      live={mb?.equity?.invested} fieldKey="mf_equity_invested" value={mv('mf_equity_invested')} note={mn('mf_equity_invested')} kiteConnected={!!mfLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={mb?.equity?.current}  fieldKey="mf_equity_current"  value={mv('mf_equity_current')}  note={mn('mf_equity_current')}  kiteConnected={!!mfLive?.success} onSaved={loadManual} />

          <Divider label="MF – Gold (SBI Gold Fund…)" />
          <LiveOrEditRow label="Invested"      live={mb?.gold?.invested}   fieldKey="mf_gold_invested"   value={mv('mf_gold_invested')}   note={mn('mf_gold_invested')}   kiteConnected={!!mfLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={mb?.gold?.current}    fieldKey="mf_gold_current"    value={mv('mf_gold_current')}    note={mn('mf_gold_current')}    kiteConnected={!!mfLive?.success} onSaved={loadManual} />

          <Divider label="MF – Silver (Kotak Silver ETF FoF…)" />
          <LiveOrEditRow label="Invested"      live={mb?.silver?.invested} fieldKey="mf_silver_invested"  value={mv('mf_silver_invested')}  note={mn('mf_silver_invested')}  kiteConnected={!!mfLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={mb?.silver?.current}  fieldKey="mf_silver_current"   value={mv('mf_silver_current')}   note={mn('mf_silver_current')}   kiteConnected={!!mfLive?.success} onSaved={loadManual} />

          <Divider label="MF – Debt (Short/Medium Duration, Credit Risk…)" />
          <LiveOrEditRow label="Invested"      live={mb?.debt?.invested}   fieldKey="mf_debt_invested"   value={mv('mf_debt_invested')}   note={mn('mf_debt_invested')}   kiteConnected={!!mfLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={mb?.debt?.current}    fieldKey="mf_debt_current"    value={mv('mf_debt_current')}    note={mn('mf_debt_current')}    kiteConnected={!!mfLive?.success} onSaved={loadManual} />

          <TotalRow label="MF Total" accentColor="#f59e0b" invested={mfTotalInvested} current={mfTotalCurrent} fetchedAt={mfLive?.success ? mfLive.fetched_at : undefined} onRefresh={loadMf} />

          <div className="flex justify-between mt-1 pt-2 border-t border-[#2a2a4a]">
            <span className="text-sm font-bold text-white">Final Total</span>
            <div className="text-right">
              <p className="text-base font-bold text-white">{(eqTotalCurrent + mfTotalCurrent) > 0 ? fmt(eqTotalCurrent + mfTotalCurrent) : '—'}</p>
              {(eqTotalInvested + mfTotalInvested) > 0 && <p className="text-[10px] text-[#8888aa]">invested {fmt(eqTotalInvested + mfTotalInvested)}</p>}
            </div>
          </div>

          {/* XLSX import — single upload covers both Equity + MF sheets */}
          <XlsxImport onImported={saveXlsxResult} />

          {(equityLive?.error && !equityLive?.success) && (
            <button onClick={loadEquity} className="text-[10px] text-[#6c63ff] mt-1 mr-2">Retry Kite API</button>
          )}
          {(mfLive?.error && !mfLive?.success) && (
            <button onClick={loadMf} className="text-[10px] text-[#6c63ff] mt-1">Retry Coin API</button>
          )}
        </Section>

        {/* ── IND MONEY – FOREIGN EQUITY ── */}
        <Section
          title="Foreign Equity (IND Money)"
          icon={<GlobeIcon />}
          badge={indmoneyLive?.success ? 'US Stocks · Live' : 'US Stocks · Manual'}
          accentColor="#f59e0b"
          invested={indmoneyInvested}
          current={indmoneyCurrent}
          loading={loadingIndmoney}
        >
          {indmoneyLive?.success ? (
            <>
              <LiveRow
                label="Invested (live)"
                value={indmoneyLive.invested ?? 0}
                fetchedAt={indmoneyLive.fetched_at}
                onRefresh={loadIndmoney}
              />
              <LiveRow
                label="Current Value (live)"
                value={indmoneyLive.current ?? 0}
                fetchedAt={indmoneyLive.fetched_at}
                onRefresh={loadIndmoney}
              />
              <div className="mt-2 pt-2 border-t border-[#2a2a4a] flex items-center justify-between">
                <span className="text-[10px] text-[#00d9a6] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d9a6] inline-block" />
                  Connected via IND Money MCP
                </span>
                <button onClick={loadIndmoney} className="text-[10px] text-[#6c63ff]">↻ Refresh</button>
              </div>
            </>
          ) : (
            <>
              {indmoneyLive?.error && indmoneyLive.error !== 'not_connected' && (
                <p className="text-[10px] text-[#ff6b6b] mb-1">Error: {indmoneyLive.error}</p>
              )}
              <p className="text-[10px] text-[#555577] mb-2">
                {indmoneyLive?.error === 'not_connected' || !indmoneyLive
                  ? 'Connect your IND Money account to fetch US stock values automatically.'
                  : 'Could not fetch live data — manual values shown below.'}
              </p>
              <a
                href="/api/indmoney/connect"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f59e0b] text-black text-xs font-semibold mb-3"
              >
                <GlobeIcon /> Connect IND Money
              </a>
              <EditableField label="Invested (manual fallback)" fieldKey="indmoney_foreign_invested" value={mv('indmoney_foreign_invested')} note={mn('indmoney_foreign_invested')} onSaved={loadManual} />
              <EditableField label="Current Value (manual fallback)" fieldKey="indmoney_foreign_current" value={mv('indmoney_foreign_current')} note={mn('indmoney_foreign_current')} onSaved={loadManual} />
            </>
          )}
        </Section>

        {/* ── CRYPTO ── */}
        <Section title="Crypto" icon={<CryptoIcon />} badge="CoinDCX" accentColor="#f97316"
          invested={cryptoInvested} current={cryptoCurrent} loading={loadingCrypto}>

          {cryptoLive?.success ? (
            <>
              <EditableField label="Invested (cost basis)" fieldKey="crypto_invested" value={mv('crypto_invested')} note={mn('crypto_invested')} onSaved={loadManual} />
              {cryptoLive.invested_breakdown && (
                <p className="text-[10px] text-[#555577] mb-1">
                  API sees ₹{cryptoLive.invested_breakdown.from_trades.toLocaleString('en-IN')} from {cryptoLive.invested_breakdown.trade_count} recent trades — older trades not returned by CoinDCX API
                </p>
              )}
              <LiveRow label="Current Value (live)" value={cryptoLive.current ?? 0} fetchedAt={cryptoLive.fetched_at} onRefresh={loadCrypto} />
            </>
          ) : (
            <>
              {cryptoLive?.error && (
                <p className="text-[10px] text-[#555577] mb-1">
                  {cryptoLive.error === 'not_configured'
                    ? 'Add COINDCX_API_KEY + COINDCX_API_SECRET to .env.local for live value.'
                    : `API: ${cryptoLive.error}`}
                </p>
              )}
              <EditableField label="Invested (cost basis)" fieldKey="crypto_invested" value={mv('crypto_invested')} note={mn('crypto_invested')} onSaved={loadManual} />
              <EditableField label="Current Value (manual)" fieldKey="crypto_current" value={mv('crypto_current')} note={mn('crypto_current')} onSaved={loadManual} />
              <button onClick={loadCrypto} className="text-[10px] text-[#6c63ff] mt-1">Retry API</button>
            </>
          )}
        </Section>

        {/* ── DEBT (Stable Money) ── */}
        <Section title="Debt Instruments" icon={<BondIcon />} badge="Stable Money · Manual" accentColor="#8b5cf6"
          invested={debtInvested} current={debtCurrent}>
          <Divider label="Bonds [Nominee - Mom]" />
          <EditableField label="Invested" fieldKey="bond_invested" value={mv('bond_invested')} note={mn('bond_invested')} onSaved={loadManual} />
          <EditableField label="Current Value" fieldKey="bond_current" value={mv('bond_current')} note={mn('bond_current')} onSaved={loadManual} />
          <Divider label="Fixed Deposit [Nominee - Mom]" />
          <EditableField label="Invested" fieldKey="fd_invested" value={mv('fd_invested')} note={mn('fd_invested')} onSaved={loadManual} />
          <EditableField label="Current Value" fieldKey="fd_current" value={mv('fd_current')} note={mn('fd_current')} onSaved={loadManual} />
          <div className="flex justify-between mt-2 pt-2 border-t border-[#2a2a4a]">
            <span className="text-xs text-[#8888aa]">Invested Total</span>
            <span className="text-sm font-semibold text-white">{fmt(debtInvested)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-sm font-bold text-white">Final Total</span>
            <span className="text-base font-bold text-white">{fmt(debtCurrent)}</span>
          </div>
        </Section>

        {/* ── PF ── */}
        <Section title="Provident Fund (PF)" icon={<PfIcon />} badge="EPFO UAN · Manual" accentColor="#10b981"
          invested={pfInvested} current={pfCurrent}>
          <p className="text-[10px] text-[#555577] mb-1">Nominee - Mom · check at unifiedportal-mem.epfindia.gov.in</p>
          <EditableField label="Total Contributed (Employer + Employee)" fieldKey="pf_invested" value={mv('pf_invested')} note={mn('pf_invested')} onSaved={loadManual} />
          <EditableField label="Current Balance (with interest)" fieldKey="pf_current" value={mv('pf_current')} note={mn('pf_current')} onSaved={loadManual} />
        </Section>

        {/* ── API Status ── */}
        <div className="rounded-2xl bg-[#1a1a2e] border border-[#2a2a4a] p-4">
          <p className="text-xs font-semibold text-white mb-3">Live API Status</p>
          <div className="space-y-2.5">
            <ApiRow name="Zerodha Kite (equity)" active={equityLive?.success} loading={loadingEquity}
              hint={equityLive?.success
                ? 'Connected via Kite Connect OAuth'
                : equityLive?.error === 'token_expired'
                  ? 'Session expired — click "Connect Zerodha" above to re-auth (daily)'
                  : 'Click "Connect Zerodha" above · needs ZERODHA_API_KEY + ZERODHA_API_SECRET in .env.local'} />
            <ApiRow name="Zerodha Coin (MF)" active={mfLive?.success} loading={loadingMf}
              hint={mfLive?.success ? 'Connected — same Kite session covers MF holdings' : 'Included in the same Kite Connect session'} />
            <ApiRow name="CoinDCX (crypto current)" active={cryptoLive?.success} loading={loadingCrypto}
              hint={cryptoLive?.success ? 'Connected — cost basis is manual (enter what you actually invested)' : 'Add COINDCX_API_KEY + COINDCX_API_SECRET · free at coindcx.com'} />
            <ApiRow
              name="IND Money (US stocks)"
              active={indmoneyLive?.success}
              loading={loadingIndmoney}
              hint={indmoneyLive?.success ? 'Connected via mcp.indmoney.com' : 'Click "Connect IND Money" in the Foreign Equity section'}
            />
            <ApiRow name="SBI / Mobikwik" active={false} unavailable hint="No public API — manual entry only" />
            <ApiRow name="Stable Money (bonds/FD)" active={false} unavailable hint="No public API — manual entry only" />
            <ApiRow name="EPFO / UAN (PF)" active={false} unavailable hint="No official API — manual entry only" />
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── small components ──────────────────────────────────────────────────────

function ApiRow({ name, active, loading, hint, unavailable }: { name: string; active?: boolean; loading?: boolean; hint?: string; unavailable?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {loading
        ? <div className="w-2 h-2 mt-1 flex-shrink-0 border border-[#6c63ff] border-t-transparent rounded-full animate-spin" />
        : <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${unavailable ? 'bg-[#555577]' : active ? 'bg-[#00d9a6]' : 'bg-[#f59e0b]'}`} />
      }
      <div>
        <p className="text-xs text-white">{name}</p>
        {hint && <p className="text-[10px] text-[#555577] mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

// Shows live value when Kite is connected; falls back to editable manual field
function LiveOrEditRow({
  label, live, fieldKey, value, note, kiteConnected, onSaved,
}: {
  label: string; live?: number; fieldKey: string; value?: number; note?: string;
  kiteConnected: boolean; onSaved: () => void;
}) {
  if (kiteConnected && live !== undefined) {
    return (
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-[#8888aa]">{label}</span>
        <span className="text-sm font-semibold text-white">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(live)}</span>
      </div>
    );
  }
  return <EditableField label={label} fieldKey={fieldKey} value={value} note={note} onSaved={onSaved} />;
}

// Total row with optional live badge + refresh button
function TotalRow({ label, accentColor, invested, current, fetchedAt, onRefresh }: {
  label: string; accentColor: string; invested: number; current: number;
  fetchedAt?: string; onRefresh: () => void;
}) {
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  return (
    <div className="flex justify-between mt-2 pt-2 border-t border-[#2a2a4a]">
      <div>
        <span className="text-xs font-semibold" style={{ color: accentColor }}>{label}</span>
        {fetchedAt && (
          <p className="text-[10px] text-[#00d9a6] flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d9a6] inline-block" />
            Live · {new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            <button onClick={onRefresh} className="text-[#6c63ff] ml-1">↻</button>
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-white">{current > 0 ? fmt(current) : '—'}</p>
        {invested > 0 && <p className="text-[10px] text-[#8888aa]">invested {fmt(invested)}</p>}
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8888aa" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function BankIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
}
function CardIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>;
}
function ChartIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>;
}

function CryptoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
}
function BondIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
}
function GlobeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
}
function PfIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
