'use client';

import { useState } from 'react';
import type { LocalTransaction } from '@/lib/localStore';
import type { WealthSnapshot, ExportMode } from '@/lib/exportExcel';

interface Props {
  onClose: () => void;
  transactions: LocalTransaction[];
  wealth: WealthSnapshot;
  showWealthOptions?: boolean;
}

const OPTIONS: { mode: ExportMode; icon: string; title: string; desc: string; sheets: string[]; color: string; pale: string; border: string }[] = [
  {
    mode:   'transactions',
    icon:   '📋',
    title:  'Transactions Only',
    desc:   'Full ledger with category breakdown and monthly trend',
    sheets: ['📋 Transactions', '🥧 Category Breakdown', '📅 Monthly Trend'],
    color:  'var(--clr-want)',
    pale:   'var(--clr-want-bg)',
    border: 'var(--clr-want-border)',
  },
  {
    mode:   'wealth',
    icon:   '💎',
    title:  'Wealth Only',
    desc:   'Net worth, P&L per asset, and portfolio allocation',
    sheets: ['💎 Wealth Overview', '🎯 Asset Allocation'],
    color:  'var(--accent)',
    pale:   'var(--accent-bg)',
    border: 'var(--accent-border)',
  },
  {
    mode:   'both',
    icon:   '🏠',
    title:  'Full Report',
    desc:   'Complete dashboard — transactions + wealth in one file',
    sheets: ['🏠 Summary', '📋 Transactions', '🥧 Categories', '📅 Monthly', '💎 Wealth', '🎯 Allocation'],
    color:  'var(--clr-income-cat)',
    pale:   'var(--clr-income-cat-bg)',
    border: 'var(--clr-income-cat-border)',
  },
];

export default function ExportModal({ onClose, transactions, wealth, showWealthOptions = false }: Props) {
  const visibleOptions = showWealthOptions ? OPTIONS : OPTIONS.filter(o => o.mode === 'transactions');
  const [selected, setSelected] = useState<ExportMode>('transactions');
  const [status, setStatus]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg]     = useState('');

  async function handleExport() {
    setStatus('loading');
    setErrMsg('');
    try {
      const { exportToExcel } = await import('@/lib/exportExcel');
      await exportToExcel(selected, transactions, wealth);
      setStatus('done');
      setTimeout(() => { setStatus('idle'); onClose(); }, 1400);
    } catch (e) {
      setErrMsg('Export failed. Please try again.');
      setStatus('error');
    }
  }

  const opt = OPTIONS.find(o => o.mode === selected)!;

  // Derived stats for non-wealth users
  const expenses    = transactions.filter(t => t.type === 'expense');
  const incomes     = transactions.filter(t => t.type === 'income');
  const totalExp    = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc    = incomes.reduce((s, t) => s + t.amount, 0);
  const net         = totalInc - totalExp;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl"
        style={{
          backgroundColor: 'var(--bg)',
          border: '1.5px solid var(--border)',
          borderBottom: 'none',
          boxShadow: '0 -16px 64px rgba(0,0,0,0.45)',
          maxHeight: '90vh',
          overflowY: 'auto',
          paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.22), rgba(108,99,255,0.08))', border: '1.5px solid rgba(108,99,255,0.28)' }}>
              📤
            </div>
            <div>
              <h2 className="text-[22px] font-black tracking-tight leading-none" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>Export to Excel</h2>
              <p className="text-[12px] mt-1 font-medium" style={{ color: 'var(--text3)' }}>
                {showWealthOptions ? 'Beautiful Excel with charts & summaries' : 'Color-coded ledger, charts & monthly breakdown'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)', color: 'var(--text2)' }}
          >
            ✕
          </button>
        </div>

        {showWealthOptions ? (
          /* ── Multi-option picker (wealth users) ── */
          <div className="px-4 space-y-3">
            {visibleOptions.map((o) => {
              const active = selected === o.mode;
              return (
                <button
                  key={o.mode}
                  onClick={() => setSelected(o.mode)}
                  className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98]"
                  style={{
                    background: active ? o.pale  : 'var(--card)',
                    border:     active ? `2px solid ${o.border}` : '1.5px solid var(--border)',
                    boxShadow:  active ? `0 4px 24px ${o.color}22` : 'none',
                    transform:  active ? 'scale(1.01)' : 'scale(1)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{
                        background: active ? `${o.color}20` : 'var(--bg2)',
                        border: `1.5px solid ${active ? o.border : 'var(--border)'}`,
                      }}>
                      {o.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-extrabold" style={{ color: active ? o.color : 'var(--text)', letterSpacing: '-0.02em' }}>
                          {o.title}
                        </p>
                        {active && (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: o.pale, color: o.color, border: `1.5px solid ${o.border}` }}>
                            SELECTED
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--text3)' }}>{o.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {o.sheets.map((s) => (
                          <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                            style={{
                              background: active ? `${o.color}18` : 'var(--bg2)',
                              color: active ? o.color : 'var(--text3)',
                              border: `1px solid ${active ? o.border : 'var(--border)'}`,
                            }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Single-export preview card (non-wealth users) ── */
          <div className="px-4">
            {/* What's included */}
            <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text3)' }}>What&apos;s included</p>
              <div className="space-y-2.5">
                {[
                  { icon: '📋', label: 'Full Transaction Ledger', sub: 'Every entry, color-coded by category' },
                  { icon: '🥧', label: 'Spending by Category', sub: 'Pie charts + ranked breakdown table' },
                  { icon: '📅', label: 'Monthly Trend', sub: 'Income vs expense bar chart over time' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: 'rgba(108,99,255,0.10)', border: '1.5px solid rgba(108,99,255,0.18)' }}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>{item.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats strip */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Transactions', value: transactions.length.toString(), color: 'var(--accent)' },
                { label: 'Total Income', value: formatShort(totalInc), color: 'var(--clr-income-cat)' },
                { label: net >= 0 ? 'Net Saved' : 'Net Deficit', value: formatShort(Math.abs(net)), color: net >= 0 ? 'var(--clr-income-cat)' : 'var(--expense)' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider leading-tight" style={{ color: 'var(--text3)' }}>{stat.label}</p>
                  <p className="text-[15px] font-black mt-1.5 leading-none" style={{ color: stat.color, letterSpacing: '-0.02em' }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared stats strip for wealth users */}
        {showWealthOptions && (
          <div className="mx-4 mt-4 rounded-2xl p-4 grid grid-cols-3 gap-3"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Transactions</p>
              <p className="text-[18px] font-black mt-1" style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}>{transactions.length}</p>
            </div>
            <div className="text-center" style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Net Worth</p>
              <p className="text-[15px] font-black mt-1" style={{ color: wealth.netWorth >= 0 ? 'var(--clr-income-cat)' : 'var(--expense)', letterSpacing: '-0.02em' }}>
                {formatShort(wealth.netWorth)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Sheets</p>
              <p className="text-[18px] font-black mt-1" style={{ color: 'var(--accent)', letterSpacing: '-0.02em' }}>{opt.sheets.length}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="mx-4 mt-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--clr-want-bg)', color: 'var(--clr-want)', border: '1.5px solid var(--clr-want-border)' }}>
            ⚠️ {errMsg || 'Export failed — please try again'}
          </div>
        )}

        {/* CTA */}
        <div className="px-4 mt-5">
          <button
            onClick={handleExport}
            disabled={status === 'loading' || status === 'done'}
            className="w-full py-4 rounded-2xl font-extrabold text-[16px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.97] disabled:opacity-60"
            style={{
              background:    status === 'done' ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #6c63ff, #9c63ff)',
              color:         '#fff',
              boxShadow:     status === 'done' ? '0 4px 20px rgba(16,185,129,0.4)' : '0 4px 20px rgba(108,99,255,0.4)',
              letterSpacing: '-0.01em',
            }}
          >
            {status === 'loading' ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Excel…
              </>
            ) : status === 'done' ? (
              <>✅ Downloaded!</>
            ) : (
              <>📤 Download Excel Report</>
            )}
          </button>
          <p className="text-center text-[11px] mt-2.5" style={{ color: 'var(--text3)' }}>
            {showWealthOptions
              ? 'Includes color-coded cells, conditional formatting & visual bars'
              : '3 beautifully styled sheets · charts embedded in Excel'}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatShort(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000)     return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}
