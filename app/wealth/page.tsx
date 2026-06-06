'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

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

function pnlColor(i: number, c: number) { return c >= i ? 'var(--income)' : 'var(--expense)'; }

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
  label, fieldKey, value, note, onSaved, liveValue, liveLabel,
}: {
  label: string; fieldKey: string; value: number | undefined; note?: string;
  onSaved: () => void; liveValue?: number; liveLabel?: string;
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

  const showLive = liveValue !== undefined && liveValue !== value;

  if (editing) {
    return (
      <div className="space-y-2 mt-1">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>₹</span>
          <input
            type="number"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text)' }}
            inputMode="decimal"
          />
        </div>
        <input
          type="text"
          value={noteVal}
          onChange={(e) => setNoteVal(e.target.value)}
          placeholder="Note (optional)"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ backgroundColor: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || !val}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#9c63ff] text-white text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)}
            className="px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-transform" style={{ background: 'var(--card2)', color: 'var(--text2)' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mt-1 group">
      <div>
        <span className="text-xs" style={{ color: 'var(--text2)' }}>{label}</span>
        {note && <span className="text-[10px] ml-1" style={{ color: 'var(--text3)' }}>· {note}</span>}
      </div>
      <div className="flex items-center gap-2">
        {showLive && (
          <span className="text-[10px] text-[color:var(--clr-live)]" title={liveLabel ?? 'Live value'}>
            {fmtShort(liveValue!)} live
          </span>
        )}
        <button onClick={startEdit} className="flex items-center gap-1.5 active:scale-95 transition-transform">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {value !== undefined ? fmt(value) : <span className="text-xs" style={{ color: 'var(--text3)', fontStyle: 'italic' }}>tap to set</span>}
          </span>
          <EditIcon />
        </button>
      </div>
    </div>
  );
}

// ─── XLSX import ────────────────────────────────────────────────────────────

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
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border2)' }}>
      <button onClick={() => setOpen((v) => !v)} className="text-[11px] flex items-center gap-1.5 font-medium" style={{ color: 'var(--accent)' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Import from Zerodha XLSX {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p style={{ fontSize: 10, color: 'var(--text2)' }}>
            Download: <span style={{ color: 'var(--text2)' }}>console.zerodha.com → Portfolio → Holdings → ⬇ Download</span>
          </p>
          <label className="block">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <span className="inline-block px-3 py-2 rounded-xl text-xs cursor-pointer active:scale-95 transition-transform" style={{ background: 'rgba(108,99,255,0.15)', color: '#c8c0ff', border: '1px solid rgba(108,99,255,0.4)' }}>
              {status === 'loading' ? 'Parsing…' : 'Choose Holdings XLSX'}
            </span>
          </label>
          {status === 'done' && result?.success && (
            <div className="space-y-1">
              {result.equity && result.equity.total.invested > 0 && (
                <p className="text-[10px] text-[color:var(--clr-live)]">✓ Equity · Invested {fmtShort(result.equity.total.invested)} · Current {fmtShort(result.equity.total.current)}</p>
              )}
              {result.mf && result.mf.total.invested > 0 && (
                <p className="text-[10px] text-[color:var(--clr-live)]">✓ MF · Invested {fmtShort(result.mf.total.invested)} · Current {fmtShort(result.mf.total.current)}</p>
              )}
            </div>
          )}
          {status === 'error' && <p className="text-[10px] text-[color:var(--expense)]">{result?.error ?? 'Parse failed — check file format'}</p>}
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
  const gain = hasPnl ? current! - invested! : 0;
  const gainPct = hasPnl && invested! > 0 ? (gain / invested!) * 100 : 0;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${accentColor}`, boxShadow: 'var(--shadow-card)' }}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}18` }}>
              <span style={{ color: accentColor }}>{icon}</span>
            </div>
            <div>
              <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{title}</span>
              {badge && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                  {badge}
                </span>
              )}
            </div>
          </div>
          {loading && <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${accentColor}80`, borderTopColor: 'transparent' }} />}
        </div>
        {hasPnl && !loading && (
          <div className="flex items-end justify-between mt-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div>
              <p className="uppercase tracking-widest mb-1 font-bold" style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '0.1em' }}>Current Value</p>
              <p className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>{fmtShort(current!)}</p>
              {invested! > 0 && <p className="mt-0.5 font-medium" style={{ fontSize: 10, color: 'var(--text3)' }}>of {fmtShort(invested!)} invested</p>}
            </div>
            <div className="text-right">
              <p className="uppercase tracking-widest mb-1 font-bold" style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '0.1em' }}>P&amp;L</p>
              <p className="text-base font-extrabold" style={{ color: pnlColor(invested!, current!) }}>
                {gain >= 0 ? '+' : ''}{fmtShort(gain)}
              </p>
              <p className="text-xs font-bold mt-0.5" style={{ color: pnlColor(invested!, current!) }}>
                {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-3 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>{children}</div>
    </div>
  );
}

function LiveRow({ label, value, fetchedAt, onRefresh }: { label: string; value: number; fetchedAt?: string; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between mt-1">
      <div>
        <p className="text-xs" style={{ color: 'var(--text2)' }}>{label}</p>
        {fetchedAt && (
          <p className="text-[10px] text-[color:var(--clr-live)] flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--clr-live)] inline-block animate-pulse" />
            Live · {new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{fmt(value)}</span>
        <button onClick={onRefresh} className="text-[11px] w-6 h-6 rounded-full flex items-center justify-center hover:opacity-80 active:scale-90 transition-all" style={{ color: 'var(--accent)', background: 'rgba(108,99,255,0.12)' }}>↻</button>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border2)' }}>
      <p className="text-[10px] mb-1 uppercase tracking-wider font-semibold" style={{ color: 'var(--text2)' }}>{label}</p>
    </div>
  );
}

// ─── Donut Chart for asset allocation ─────────────────────────────────────

const ASSET_COLORS = ['#6c63ff', '#00d9a6', '#f59e0b', '#f97316', '#8b5cf6', '#10b981', '#3b82f6', '#ff6b6b'];
// Darker versions for light theme text/labels
const ASSET_COLORS_DARK = ['#4338ca', '#0a7a58', '#92400e', '#c2410c', '#6d28d9', '#065f46', '#1d4ed8', '#b91c1c'];

interface AssetSlice { name: string; value: number; color: string; darkColor: string; }

const CHART_COLORS = {
  dark:  { card: '#13132a', border: '#252548', text: '#b8b4e0', textSub: '#8a87c0', grid: '#1e1e40', axis: '#8a87c0' },
  light: { card: '#f7f8fd', border: '#dde0f0', text: '#353570', textSub: '#5c5c90', grid: '#dde0f0', axis: '#5c5c90' },
};

function AllocationDonut({ slices, theme }: { slices: AssetSlice[]; theme: 'dark' | 'light' }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: AssetSlice }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12 }}>{d.name}</p>
        </div>
        <p style={{ color: d.color, fontSize: 13, fontWeight: 700 }}>{fmtShort(d.value)}</p>
        <p style={{ color: 'var(--text3)', fontSize: 10, marginTop: 1 }}>{((d.value / total) * 100).toFixed(1)}% of portfolio</p>
      </div>
    );
  };

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent)',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text)', letterSpacing: '0.1em' }}>Asset Allocation</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>Tap a slice to see details</p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-2 px-4 pb-4">
        <div className="w-full sm:w-48 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full grid grid-cols-2 gap-x-2.5 gap-y-2.5">
          {slices.map((s, i) => {
            const labelColor = theme === 'light' ? s.darkColor : s.color;
            return (
            <div key={i} className="flex items-center gap-2 min-w-0 rounded-xl p-2.5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <div className="min-w-0">
                <p className="truncate font-semibold" style={{ color: 'var(--text2)', fontSize: 10 }}>{s.name}</p>
                <p className="font-bold" style={{ color: 'var(--text)', fontSize: 12 }}>{fmtShort(s.value)}</p>
                <p style={{ color: labelColor, fontSize: 10, fontWeight: 700 }}>{((s.value / total) * 100).toFixed(1)}%</p>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── P&L Bar Chart ─────────────────────────────────────────────────────────

interface PnlBar { name: string; invested: number; current: number; color: string; }

const BarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill || (p.name === 'Invested' ? '#5a5aff' : '#00d9a6'), flexShrink: 0 }} />
          <span style={{ color: 'var(--text2)', fontSize: 11 }}>{p.name}:&nbsp;</span>
          <span style={{ color: 'var(--text)', fontSize: 11, fontWeight: 600 }}>{fmtShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function PnlBarChart({ bars }: { bars: PnlBar[] }) {
  const { theme } = useTheme();
  const cc = CHART_COLORS[theme];
  const visible = bars.filter(b => b.invested > 0 || b.current > 0);
  if (visible.length === 0) return null;

  const data = visible.map(b => ({
    name: b.name,
    Invested: b.invested,
    Current: b.current,
    color: b.color,
  }));

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--income)',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text)', letterSpacing: '0.1em' }}>Invested vs Current</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>Per category comparison</p>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: '#5a5aff' }} />
            <span style={{ color: 'var(--text2)', fontSize: 11 }}>Invested</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: '#00d9a6' }} />
            <span style={{ color: 'var(--text2)', fontSize: 11 }}>Current (gain)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: '#ff6b6b' }} />
            <span style={{ color: 'var(--text2)', fontSize: 11 }}>Current (loss)</span>
          </div>
        </div>
      </div>
      <div className="pb-4 pr-3" style={{ height: 210 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={3} barSize={13} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={cc.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: cc.text, fontSize: 10, fontWeight: 500 }}
              axisLine={{ stroke: cc.border }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: cc.axis, fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtShort(v)}
              width={44}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(108,99,255,0.08)', radius: 6 }} />
            <Bar dataKey="Invested" fill="#5a5aff" radius={[4, 4, 0, 0]} opacity={0.85} />
            <Bar dataKey="Current" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.Current >= d.Invested ? '#00d9a6' : '#ff6b6b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── main page ─────────────────────────────────────────────────────────────

export default function WealthPage() {
  const { theme } = useTheme();
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
    } catch { /* ignore network errors */ } finally {
      setLoadingManual(false);
    }
  }, []);

  const loadEquity = useCallback(async () => {
    setLoadingEquity(true);
    try { setEquityLive(await (await fetch('/api/wealth/zerodha?type=equity')).json()); } catch { setEquityLive({ success: false, error: 'Failed to fetch' }); } finally { setLoadingEquity(false); }
  }, []);

  const loadMf = useCallback(async () => {
    setLoadingMf(true);
    try { setMfLive(await (await fetch('/api/wealth/zerodha?type=mf')).json()); } catch { setMfLive({ success: false, error: 'Failed to fetch' }); } finally { setLoadingMf(false); }
  }, []);

  const loadCrypto = useCallback(async () => {
    setLoadingCrypto(true);
    try { setCryptoLive(await (await fetch('/api/wealth/coindcx')).json()); } catch { setCryptoLive({ success: false, error: 'Failed to fetch' }); } finally { setLoadingCrypto(false); }
  }, []);

  const loadIndmoney = useCallback(async () => {
    setLoadingIndmoney(true);
    try { setIndmoneyLive(await (await fetch('/api/wealth/indmoney')).json()); } catch { setIndmoneyLive({ success: false, error: 'Failed to fetch' }); } finally { setLoadingIndmoney(false); }
  }, []);

  useEffect(() => {
    loadManual();
    loadEquity();
    loadMf();
    loadCrypto();
    loadIndmoney();
  }, [loadManual, loadEquity, loadMf, loadCrypto, loadIndmoney]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('indmoney_connected') === '1') { loadIndmoney(); window.history.replaceState({}, '', window.location.pathname); }
    if (params.get('indmoney_error')) { window.history.replaceState({}, '', window.location.pathname); }
    if (params.get('kite_connected') === '1') { loadEquity(); loadMf(); window.history.replaceState({}, '', window.location.pathname); }
    if (params.get('kite_error')) { window.history.replaceState({}, '', window.location.pathname); }
  }, [loadIndmoney, loadEquity, loadMf]);

  function mv(key: string) { return manual[key]?.value; }
  function mn(key: string) { return manual[key]?.note; }

  async function saveXlsxResult(result: XlsxResult) {
    const saves: Promise<Response>[] = [];
    function put(key: string, value: number) {
      saves.push(fetch('/api/wealth/manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  // ── resolve values ──────────────────────────────────────────────────────
  const eb = equityLive?.breakdown;
  const mb = mfLive?.breakdown;

  const equityInvested    = eb?.equity?.invested  ?? mv('equity_invested')          ?? 0;
  const equityCurrent     = eb?.equity?.current   ?? mv('equity_current')           ?? 0;
  const eqGoldInvested    = eb?.gold?.invested    ?? mv('equity_gold_invested')     ?? 0;
  const eqGoldCurrent     = eb?.gold?.current     ?? mv('equity_gold_current')      ?? 0;
  const eqSilverInvested  = eb?.silver?.invested  ?? mv('equity_silver_invested')   ?? 0;
  const eqSilverCurrent   = eb?.silver?.current   ?? mv('equity_silver_current')    ?? 0;
  const eqForeignInvested = eb?.foreign?.invested ?? mv('equity_foreign_invested')  ?? 0;
  const eqForeignCurrent  = eb?.foreign?.current  ?? mv('equity_foreign_current')   ?? 0;
  const eqTotalInvested   = equityLive?.success ? (equityLive.invested ?? 0) : (mv('equity_total_invested') ?? (equityInvested + eqGoldInvested + eqSilverInvested + eqForeignInvested));
  const eqTotalCurrent    = equityLive?.success ? (equityLive.current  ?? 0) : (mv('equity_total_current')  ?? (equityCurrent  + eqGoldCurrent  + eqSilverCurrent  + eqForeignCurrent));

  const mfEquityInvested  = mb?.equity?.invested  ?? mv('mf_equity_invested')       ?? 0;
  const mfEquityCurrent   = mb?.equity?.current   ?? mv('mf_equity_current')        ?? 0;
  const mfGoldInvested    = mb?.gold?.invested    ?? mv('mf_gold_invested')         ?? 0;
  const mfGoldCurrent     = mb?.gold?.current     ?? mv('mf_gold_current')          ?? 0;
  const mfSilverInvested  = mb?.silver?.invested  ?? mv('mf_silver_invested')       ?? 0;
  const mfSilverCurrent   = mb?.silver?.current   ?? mv('mf_silver_current')        ?? 0;
  const mfDebtInvested    = mb?.debt?.invested    ?? mv('mf_debt_invested')         ?? 0;
  const mfDebtCurrent     = mb?.debt?.current     ?? mv('mf_debt_current')          ?? 0;
  const mfTotalInvested   = mfLive?.success ? (mfLive.invested ?? 0) : (mv('mf_total_invested') ?? (mfEquityInvested + mfGoldInvested + mfSilverInvested + mfDebtInvested));
  const mfTotalCurrent    = mfLive?.success ? (mfLive.current  ?? 0) : (mv('mf_total_current')  ?? (mfEquityCurrent  + mfGoldCurrent  + mfSilverCurrent  + mfDebtCurrent));

  const indmoneyInvested  = indmoneyLive?.success ? (indmoneyLive.invested ?? 0) : (mv('indmoney_foreign_invested') ?? 0);
  const indmoneyCurrent   = indmoneyLive?.success ? (indmoneyLive.current  ?? 0) : (mv('indmoney_foreign_current')  ?? 0);

  const cryptoInvested    = mv('crypto_invested') ?? 0;
  const cryptoCurrent     = cryptoLive?.success ? (cryptoLive.current ?? 0) : (mv('crypto_current') ?? 0);

  const bankBalance       = mv('bank_balance')   ?? 0;
  const cashInHand        = mv('cash_in_hand')   ?? 0;
  const mobikwik          = mv('mobikwik')       ?? 0;

  const creditCardDue     = mv('credit_card_due')   ?? 0;
  const payToSomeone      = mv('pay_to_someone')    ?? 0;
  const bondInvested      = mv('bond_invested')     ?? 0;
  const bondCurrent       = mv('bond_current')      ?? 0;
  const fdInvested        = mv('fd_invested')       ?? 0;
  const fdCurrent         = mv('fd_current')        ?? 0;
  const pfInvested        = mv('pf_invested')       ?? 0;
  const pfCurrent         = mv('pf_current')        ?? 0;

  const debtInvested      = bondInvested + fdInvested;
  const debtCurrent       = bondCurrent + fdCurrent;
  const bankTotal         = bankBalance + cashInHand + mobikwik;
  const totalAssets       = bankTotal + eqTotalCurrent + mfTotalCurrent + indmoneyCurrent + cryptoCurrent + debtCurrent + pfCurrent;
  const totalLiabilities  = creditCardDue + payToSomeone;
  const netWorth          = totalAssets - totalLiabilities;

  // ── charts data ─────────────────────────────────────────────────────────
  const allocationSlices: AssetSlice[] = [
    { name: 'Stocks (Kite)', value: eqTotalCurrent,   color: ASSET_COLORS[0], darkColor: ASSET_COLORS_DARK[0] },
    { name: 'Mutual Funds',  value: mfTotalCurrent,   color: ASSET_COLORS[1], darkColor: ASSET_COLORS_DARK[1] },
    { name: 'US Stocks',     value: indmoneyCurrent,  color: ASSET_COLORS[2], darkColor: ASSET_COLORS_DARK[2] },
    { name: 'Crypto',        value: cryptoCurrent,    color: ASSET_COLORS[3], darkColor: ASSET_COLORS_DARK[3] },
    { name: 'Debt',          value: debtCurrent,      color: ASSET_COLORS[4], darkColor: ASSET_COLORS_DARK[4] },
    { name: 'PF',            value: pfCurrent,        color: ASSET_COLORS[5], darkColor: ASSET_COLORS_DARK[5] },
    { name: 'Bank & Cash',   value: bankTotal,        color: ASSET_COLORS[6], darkColor: ASSET_COLORS_DARK[6] },
  ].filter(s => s.value > 0);

  const pnlBars: PnlBar[] = [
    { name: 'Stocks',  invested: eqTotalInvested,  current: eqTotalCurrent,   color: ASSET_COLORS[0] },
    { name: 'MF',      invested: mfTotalInvested,  current: mfTotalCurrent,   color: ASSET_COLORS[1] },
    { name: 'US',      invested: indmoneyInvested, current: indmoneyCurrent,  color: ASSET_COLORS[2] },
    { name: 'Crypto',  invested: cryptoInvested,   current: cryptoCurrent,    color: ASSET_COLORS[3] },
    { name: 'Debt',    invested: debtInvested,     current: debtCurrent,      color: ASSET_COLORS[4] },
    { name: 'PF',      invested: pfInvested,       current: pfCurrent,        color: ASSET_COLORS[5] },
  ].filter(b => b.invested > 0 || b.current > 0);

  if (loadingManual) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-3">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <p className="text-xs" style={{ color: 'var(--text3)' }}>Loading wealth data…</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-28 min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header className="px-4 pt-12 pb-5 flex items-start justify-between">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-[#6c63ff20]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>Wealth</h1>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>Net worth snapshot · tap any value to edit</p>
          </div>
        </div>
        <div className="mt-1"><ThemeToggle /></div>
      </header>

      {/* ── Net Worth Hero ── */}
      <div className="mx-4 mb-5 rounded-2xl p-5 relative overflow-hidden" style={{
        background: 'var(--hero-bg)',
        border: '1px solid var(--hero-border)',
        borderLeft: '4px solid var(--accent)',
        boxShadow: 'var(--hero-shadow)',
      }}>
        {/* glow blob */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none" style={{
          background: `radial-gradient(circle, var(--hero-glow) 0%, transparent 70%)`,
        }} />
        <div className="relative">
          <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--hero-label)', marginBottom: 4, fontWeight: 600 }}>TOTAL NET WORTH</p>
          <p className="font-black tracking-tight" style={{ fontSize: 'clamp(2rem,8vw,3rem)', lineHeight: 1.1, color: 'var(--hero-value)' }}>{fmtShort(netWorth)}</p>
          <p style={{ fontSize: 13, color: 'var(--hero-sub)', marginTop: 3, marginBottom: 16, fontVariantNumeric: 'tabular-nums' }}>{fmt(netWorth)}</p>

          <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '1px solid var(--hero-divider)' }}>
            <div className="rounded-xl p-2.5" style={{ background: 'var(--hero-stat-assets-bg)', border: '1px solid var(--hero-stat-assets-border)' }}>
              <p style={{ fontSize: 9, color: 'var(--hero-stat-label)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Assets</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--hero-stat-assets-val)' }}>{fmtShort(totalAssets)}</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ background: 'var(--hero-stat-liab-bg)', border: '1px solid var(--hero-stat-liab-border)' }}>
              <p style={{ fontSize: 9, color: 'var(--hero-stat-label)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Liabilities</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--hero-stat-liab-val)' }}>{fmtShort(totalLiabilities)}</p>
            </div>
            {totalAssets > 0 && (
              <div className="rounded-xl p-2.5" style={{ background: 'var(--hero-stat-inv-bg)', border: '1px solid var(--hero-stat-inv-border)' }}>
                <p style={{ fontSize: 9, color: 'var(--hero-stat-label)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Invested</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--hero-stat-inv-val)' }}>{fmtShort(eqTotalInvested + mfTotalInvested + indmoneyInvested + cryptoInvested + debtInvested + pfInvested)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      {allocationSlices.length > 0 && <AllocationDonut slices={allocationSlices} theme={theme} />}
      {pnlBars.length > 0 && <PnlBarChart bars={pnlBars} />}

      <div className="px-4 space-y-4">

        {/* ── BANK & CASH ── */}
        <Section title="Bank & Cash" icon={<BankIcon />} badge="Manual" accentColor="var(--clr-bank)"
          current={bankTotal} invested={bankTotal}>
          <EditableField label="SBI Bank Balance" fieldKey="bank_balance" value={mv('bank_balance')} note={mn('bank_balance')} onSaved={loadManual} />
          <EditableField label="Cash in Hand" fieldKey="cash_in_hand" value={mv('cash_in_hand')} note={mn('cash_in_hand')} onSaved={loadManual} />
          <EditableField label="Mobikwik Wallet" fieldKey="mobikwik" value={mv('mobikwik')} note={mn('mobikwik')} onSaved={loadManual} />
          {bankTotal > 0 && (
            <div className="flex justify-between mt-3 pt-2" style={{ borderTop: '1px solid var(--border2)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Total</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{fmt(bankTotal)}</span>
            </div>
          )}
        </Section>

        {/* ── LIABILITIES ── */}
        <Section title="Liabilities" icon={<CardIcon />} accentColor="var(--clr-liab)">
          <EditableField label="Credit Card Due" fieldKey="credit_card_due" value={mv('credit_card_due')} onSaved={loadManual} />
          <Divider label="Pay To Someone" />
          <EditableField label="Amount Owed" fieldKey="pay_to_someone" value={mv('pay_to_someone')} note={mn('pay_to_someone')} onSaved={loadManual} />
        </Section>

        {/* ── ZERODHA ── */}
        <Section title="Zerodha (Kite + Coin)" icon={<ChartIcon />} badge="Holdings XLSX" accentColor="var(--clr-zerodha)"
          invested={eqTotalInvested + mfTotalInvested} current={eqTotalCurrent + mfTotalCurrent}
          loading={loadingEquity || loadingMf}>

          {(equityLive?.success || mfLive?.success) ? (
            <div className="flex items-center justify-between mb-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)' }}>
              <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--clr-live)' }}>
                <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: 'var(--clr-live)' }} />
                Connected via Kite Connect
              </span>
              <a href="/api/kite/disconnect" className="text-[10px] transition-colors" style={{ color: 'var(--text3)' }}>Disconnect</a>
            </div>
          ) : (
            <div className="mb-3 p-3 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              {(equityLive?.error === 'not_connected' || equityLive?.error === 'token_expired' || !equityLive) && (
                <p className="text-[10px] mb-2" style={{ color: 'var(--text2)' }}>
                  {equityLive?.error === 'token_expired'
                    ? 'Session expired (Kite tokens reset daily) — reconnect to refresh.'
                    : 'Connect Zerodha to fetch live holdings automatically.'}
                </p>
              )}
              <a href="/api/kite/connect"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-black text-xs font-bold mb-2 active:scale-95 transition-transform"
                style={{ background: 'var(--clr-zerodha)', color: '#fff' }}>
                <ChartIcon /> Connect Zerodha
              </a>
            </div>
          )}

          <Divider label="Equity – Stocks" />
          <LiveOrEditRow label="Invested"      live={eb?.equity?.invested} fieldKey="equity_invested"  value={mv('equity_invested')}  note={mn('equity_invested')}  kiteConnected={!!equityLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={eb?.equity?.current}  fieldKey="equity_current"   value={mv('equity_current')}   note={mn('equity_current')}   kiteConnected={!!equityLive?.success} onSaved={loadManual} />

          <Divider label="Equity – Gold ETF" />
          <LiveOrEditRow label="Invested"      live={eb?.gold?.invested}   fieldKey="equity_gold_invested"  value={mv('equity_gold_invested')}  note={mn('equity_gold_invested')}  kiteConnected={!!equityLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={eb?.gold?.current}    fieldKey="equity_gold_current"   value={mv('equity_gold_current')}   note={mn('equity_gold_current')}   kiteConnected={!!equityLive?.success} onSaved={loadManual} />

          <Divider label="Equity – Silver ETF" />
          <LiveOrEditRow label="Invested"      live={eb?.silver?.invested} fieldKey="equity_silver_invested" value={mv('equity_silver_invested')} note={mn('equity_silver_invested')} kiteConnected={!!equityLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={eb?.silver?.current}  fieldKey="equity_silver_current"  value={mv('equity_silver_current')}  note={mn('equity_silver_current')}  kiteConnected={!!equityLive?.success} onSaved={loadManual} />

          <Divider label="Equity – Foreign ETF" />
          <LiveOrEditRow label="Invested"      live={eb?.foreign?.invested} fieldKey="equity_foreign_invested" value={mv('equity_foreign_invested')} note={mn('equity_foreign_invested')} kiteConnected={!!equityLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={eb?.foreign?.current}  fieldKey="equity_foreign_current"  value={mv('equity_foreign_current')}  note={mn('equity_foreign_current')}  kiteConnected={!!equityLive?.success} onSaved={loadManual} />

          <TotalRow label="Equity Total" accentColor="var(--clr-zerodha)" invested={eqTotalInvested} current={eqTotalCurrent} fetchedAt={equityLive?.success ? equityLive.fetched_at : undefined} onRefresh={loadEquity} />

          <Divider label="MF – Equity Funds" />
          <LiveOrEditRow label="Invested"      live={mb?.equity?.invested} fieldKey="mf_equity_invested" value={mv('mf_equity_invested')} note={mn('mf_equity_invested')} kiteConnected={!!mfLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={mb?.equity?.current}  fieldKey="mf_equity_current"  value={mv('mf_equity_current')}  note={mn('mf_equity_current')}  kiteConnected={!!mfLive?.success} onSaved={loadManual} />

          <Divider label="MF – Gold" />
          <LiveOrEditRow label="Invested"      live={mb?.gold?.invested}   fieldKey="mf_gold_invested"   value={mv('mf_gold_invested')}   note={mn('mf_gold_invested')}   kiteConnected={!!mfLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={mb?.gold?.current}    fieldKey="mf_gold_current"    value={mv('mf_gold_current')}    note={mn('mf_gold_current')}    kiteConnected={!!mfLive?.success} onSaved={loadManual} />

          <Divider label="MF – Silver" />
          <LiveOrEditRow label="Invested"      live={mb?.silver?.invested} fieldKey="mf_silver_invested"  value={mv('mf_silver_invested')}  note={mn('mf_silver_invested')}  kiteConnected={!!mfLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={mb?.silver?.current}  fieldKey="mf_silver_current"   value={mv('mf_silver_current')}   note={mn('mf_silver_current')}   kiteConnected={!!mfLive?.success} onSaved={loadManual} />

          <Divider label="MF – Debt" />
          <LiveOrEditRow label="Invested"      live={mb?.debt?.invested}   fieldKey="mf_debt_invested"   value={mv('mf_debt_invested')}   note={mn('mf_debt_invested')}   kiteConnected={!!mfLive?.success} onSaved={loadManual} />
          <LiveOrEditRow label="Current Value" live={mb?.debt?.current}    fieldKey="mf_debt_current"    value={mv('mf_debt_current')}    note={mn('mf_debt_current')}    kiteConnected={!!mfLive?.success} onSaved={loadManual} />

          <TotalRow label="MF Total" accentColor="var(--clr-indmoney)" invested={mfTotalInvested} current={mfTotalCurrent} fetchedAt={mfLive?.success ? mfLive.fetched_at : undefined} onRefresh={loadMf} />

          <div className="flex justify-between mt-2 pt-3" style={{ borderTop: '1px solid var(--border2)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Grand Total</span>
            <div className="text-right">
              <p className="text-base font-bold" style={{ color: 'var(--text)' }}>{(eqTotalCurrent + mfTotalCurrent) > 0 ? fmt(eqTotalCurrent + mfTotalCurrent) : '—'}</p>
              {(eqTotalInvested + mfTotalInvested) > 0 && (
                <p className="text-[10px]" style={{ color: 'var(--text3)' }}>invested {fmt(eqTotalInvested + mfTotalInvested)}</p>
              )}
              {(eqTotalInvested + mfTotalInvested) > 0 && (eqTotalCurrent + mfTotalCurrent) > 0 && (
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: pnlColor(eqTotalInvested + mfTotalInvested, eqTotalCurrent + mfTotalCurrent) }}>
                  {pnlSign(eqTotalInvested + mfTotalInvested, eqTotalCurrent + mfTotalCurrent)}
                </p>
              )}
            </div>
          </div>

          <XlsxImport onImported={saveXlsxResult} />

          {(equityLive?.error && !equityLive?.success) && (
            <button onClick={loadEquity} className="text-[10px] mt-1 mr-2" style={{ color: 'var(--accent)' }}>Retry Kite API</button>
          )}
          {(mfLive?.error && !mfLive?.success) && (
            <button onClick={loadMf} className="text-[10px] mt-1" style={{ color: 'var(--accent)' }}>Retry Coin API</button>
          )}
        </Section>

        {/* ── IND MONEY ── */}
        <Section
          title="Foreign Equity (IND Money)"
          icon={<GlobeIcon />}
          badge={indmoneyLive?.success ? 'US Stocks · Live' : 'US Stocks · Manual'}
          accentColor="var(--clr-indmoney)"
          invested={indmoneyInvested}
          current={indmoneyCurrent}
          loading={loadingIndmoney}
        >
          {indmoneyLive?.success ? (
            <>
              <LiveRow label="Invested (live)"      value={indmoneyLive.invested ?? 0} fetchedAt={indmoneyLive.fetched_at} onRefresh={loadIndmoney} />
              <LiveRow label="Current Value (live)" value={indmoneyLive.current  ?? 0} fetchedAt={indmoneyLive.fetched_at} onRefresh={loadIndmoney} />
              <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border2)' }}>
                <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--clr-live)' }}>
                  <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: 'var(--clr-live)' }} />
                  Connected via IND Money MCP
                </span>
                <button onClick={loadIndmoney} className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center" style={{ color: 'var(--accent)', background: 'rgba(108,99,255,0.12)' }}>↻</button>
              </div>
            </>
          ) : (
            <>
              {indmoneyLive?.error && indmoneyLive.error !== 'not_connected' && (
                <p className="text-[10px] text-[color:var(--expense)] mb-1">Error: {indmoneyLive.error}</p>
              )}
              <p className="text-[10px] mb-3" style={{ color: 'var(--text2)' }}>
                {indmoneyLive?.error === 'not_connected' || !indmoneyLive
                  ? 'Connect your IND Money account to fetch US stock values automatically.'
                  : 'Could not fetch live data — manual values shown below.'}
              </p>
              <a href="/api/indmoney/connect"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-black text-xs font-bold mb-3 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <GlobeIcon /> Connect IND Money
              </a>
              <EditableField label="Invested (manual)" fieldKey="indmoney_foreign_invested" value={mv('indmoney_foreign_invested')} note={mn('indmoney_foreign_invested')} onSaved={loadManual} />
              <EditableField label="Current Value (manual)" fieldKey="indmoney_foreign_current" value={mv('indmoney_foreign_current')} note={mn('indmoney_foreign_current')} onSaved={loadManual} />
            </>
          )}
        </Section>

        {/* ── CRYPTO ── */}
        <Section title="Crypto" icon={<CryptoIcon />} badge="CoinDCX" accentColor="var(--clr-crypto)"
          invested={cryptoInvested} current={cryptoCurrent} loading={loadingCrypto}>
          {cryptoLive?.success ? (
            <>
              <EditableField label="Invested (cost basis)" fieldKey="crypto_invested" value={mv('crypto_invested')} note={mn('crypto_invested')} onSaved={loadManual} />
              {cryptoLive.invested_breakdown && (
                <p className="text-[10px] mb-1" style={{ color: 'var(--text3)' }}>
                  API sees ₹{cryptoLive.invested_breakdown.from_trades.toLocaleString('en-IN')} from {cryptoLive.invested_breakdown.trade_count} recent trades
                </p>
              )}
              <LiveRow label="Current Value (live)" value={cryptoLive.current ?? 0} fetchedAt={cryptoLive.fetched_at} onRefresh={loadCrypto} />
            </>
          ) : (
            <>
              {cryptoLive?.error && (
                <p className="text-[10px] mb-1" style={{ color: 'var(--text2)' }}>
                  {cryptoLive.error === 'not_configured'
                    ? 'Add COINDCX_API_KEY + COINDCX_API_SECRET to .env.local for live value.'
                    : `API: ${cryptoLive.error}`}
                </p>
              )}
              <EditableField label="Invested (cost basis)" fieldKey="crypto_invested" value={mv('crypto_invested')} note={mn('crypto_invested')} onSaved={loadManual} />
              <EditableField label="Current Value (manual)" fieldKey="crypto_current" value={mv('crypto_current')} note={mn('crypto_current')} onSaved={loadManual} />
              <button onClick={loadCrypto} className="text-[10px] mt-1" style={{ color: 'var(--accent)' }}>Retry API</button>
            </>
          )}
        </Section>

        {/* ── DEBT ── */}
        <Section title="Debt Instruments" icon={<BondIcon />} badge="Stable Money · Manual" accentColor="var(--clr-debt)"
          invested={debtInvested} current={debtCurrent}>
          <Divider label="Bonds [Nominee — Mom]" />
          <EditableField label="Invested"      fieldKey="bond_invested" value={mv('bond_invested')} note={mn('bond_invested')} onSaved={loadManual} />
          <EditableField label="Current Value" fieldKey="bond_current"  value={mv('bond_current')}  note={mn('bond_current')}  onSaved={loadManual} />
          <Divider label="Fixed Deposit [Nominee — Mom]" />
          <EditableField label="Invested"      fieldKey="fd_invested"   value={mv('fd_invested')}   note={mn('fd_invested')}   onSaved={loadManual} />
          <EditableField label="Current Value" fieldKey="fd_current"    value={mv('fd_current')}    note={mn('fd_current')}    onSaved={loadManual} />
          <div className="flex justify-between mt-2 pt-3" style={{ borderTop: '1px solid var(--border2)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Debt Total</span>
            <div className="text-right">
              <p className="text-base font-bold" style={{ color: 'var(--text)' }}>{debtCurrent > 0 ? fmt(debtCurrent) : '—'}</p>
              {debtInvested > 0 && (
                <p className="text-[10px]" style={{ color: 'var(--text3)' }}>invested {fmt(debtInvested)}</p>
              )}
              {debtInvested > 0 && debtCurrent > 0 && (
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: pnlColor(debtInvested, debtCurrent) }}>
                  {pnlSign(debtInvested, debtCurrent)}
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* ── PF ── */}
        <Section title="Provident Fund (PF)" icon={<PfIcon />} badge="EPFO UAN · Manual" accentColor="var(--clr-pf)"
          invested={pfInvested} current={pfCurrent}>
          <p className="text-[10px] mb-2" style={{ color: 'var(--text3)' }}>Nominee — Mom · check at unifiedportal-mem.epfindia.gov.in</p>
          <EditableField label="Total Contributed" fieldKey="pf_invested" value={mv('pf_invested')} note={mn('pf_invested')} onSaved={loadManual} />
          <EditableField label="Current Balance (with interest)" fieldKey="pf_current" value={mv('pf_current')} note={mn('pf_current')} onSaved={loadManual} />
        </Section>

        {/* ── API Status ── */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', boxShadow: 'var(--shadow-card)' }}>
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text)', letterSpacing: '0.1em' }}>Live API Status</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>Connection status for all data sources</p>
          </div>
          <div className="px-4 py-1">
            <ApiRow name="Zerodha Kite (equity)"     active={equityLive?.success}  loading={loadingEquity}
              hint={equityLive?.success ? 'Connected via Kite Connect OAuth' : equityLive?.error === 'token_expired' ? 'Session expired — reconnect above (daily)' : 'Click "Connect Zerodha" above'} />
            <ApiRow name="Zerodha Coin (MF)"         active={mfLive?.success}      loading={loadingMf}
              hint={mfLive?.success ? 'Connected — same Kite session covers MF' : 'Included in the Kite Connect session'} />
            <ApiRow name="CoinDCX (crypto)"          active={cryptoLive?.success}  loading={loadingCrypto}
              hint={cryptoLive?.success ? 'Connected — cost basis entered manually' : 'Add COINDCX_API_KEY + COINDCX_API_SECRET'} />
            <ApiRow name="IND Money (US stocks)"     active={indmoneyLive?.success} loading={loadingIndmoney}
              hint={indmoneyLive?.success ? 'Connected via mcp.indmoney.com' : 'Click "Connect IND Money" above'} />
            <ApiRow name="SBI / Mobikwik"            active={false} unavailable hint="No public API — manual entry only" />
            <ApiRow name="Stable Money (bonds/FD)"   active={false} unavailable hint="No public API — manual entry only" />
            <ApiRow name="EPFO / UAN (PF)"           active={false} unavailable hint="No official API — manual entry only" />
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── small components ──────────────────────────────────────────────────────

function ApiRow({ name, active, loading, hint, unavailable }: {
  name: string; active?: boolean; loading?: boolean; hint?: string; unavailable?: boolean;
}) {
  const dotColor = unavailable ? 'var(--muted)' : active ? 'var(--clr-live)' : 'var(--clr-indmoney)';
  const statusLabel = unavailable ? 'N/A' : active ? 'Live' : 'Offline';
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex-shrink-0">
        {loading
          ? <div className="w-2 h-2 border border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          : <div className="w-2 h-2 rounded-full" style={{ background: dotColor, boxShadow: active ? `0 0 5px ${dotColor}` : 'none' }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{name}</p>
        {hint && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text3)' }}>{hint}</p>}
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{
        background: unavailable ? 'var(--bg2)' : active ? 'rgba(13,146,104,0.1)' : 'rgba(180,83,9,0.1)',
        color: dotColor,
        border: `1px solid ${unavailable ? 'var(--border)' : active ? 'rgba(13,146,104,0.2)' : 'rgba(180,83,9,0.2)'}`,
      }}>{statusLabel}</span>
    </div>
  );
}

function LiveOrEditRow({ label, live, fieldKey, value, note, kiteConnected, onSaved }: {
  label: string; live?: number; fieldKey: string; value?: number; note?: string;
  kiteConnected: boolean; onSaved: () => void;
}) {
  if (kiteConnected && live !== undefined) {
    return (
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text2)' }}>{label}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(live)}</span>
      </div>
    );
  }
  return <EditableField label={label} fieldKey={fieldKey} value={value} note={note} onSaved={onSaved} />;
}

function TotalRow({ label, accentColor, invested, current, fetchedAt, onRefresh }: {
  label: string; accentColor: string; invested: number; current: number;
  fetchedAt?: string; onRefresh: () => void;
}) {
  const fmtLocal = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  return (
    <div className="flex justify-between mt-3 pt-2.5" style={{ borderTop: '1px solid var(--border2)' }}>
      <div>
        <span className="text-xs font-bold" style={{ color: accentColor }}>{label}</span>
        {fetchedAt && (
          <p className="text-[10px] text-[color:var(--clr-live)] flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--clr-live)] inline-block animate-pulse" />
            Live · {new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            <button onClick={onRefresh} className="ml-1" style={{ color: 'var(--accent)' }}>↻</button>
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{current > 0 ? fmtLocal(current) : '—'}</p>
        {invested > 0 && <p className="text-[10px]" style={{ color: 'var(--text3)' }}>invested {fmtLocal(invested)}</p>}
        {invested > 0 && current > 0 && (
          <p className="text-[10px] font-semibold mt-0.5" style={{ color: pnlColor(invested, current) }}>
            {pnlSign(invested, current)}
          </p>
        )}
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function BankIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
}
function CardIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
}
function ChartIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
}
function CryptoIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function BondIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
}
function GlobeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
}
function PfIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
