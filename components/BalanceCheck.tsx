'use client';

import { useState, useEffect, useCallback } from 'react';

interface BalanceData {
  snapshot: { actual_balance: number; snapshot_at: string; note?: string } | null;
  computed: number | null;
  delta: number | null;
  tx_count: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

interface BalanceCheckProps {
  lastUpdated?: number;
}

export default function BalanceCheck({ lastUpdated }: BalanceCheckProps) {
  const [data, setData] = useState<BalanceData | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/balance');
    const json = await res.json();
    if (json.success) setData(json);
  }, []);

  useEffect(() => { load(); }, [load, lastUpdated]);

  async function saveSnapshot() {
    if (!inputVal) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_balance: parseFloat(inputVal), note }),
      });
      if (!res.ok) {
        setSaveError('Failed to save. Please try again.');
        return;
      }
      setShowInput(false);
      setInputVal('');
      setNote('');
      load();
    } catch {
      setSaveError('Failed to save. Please check your connection.');
    } finally {
      setSaving(false);
    }
  }

  const hasDrift = data?.computed != null && data?.snapshot != null;

  return (
    <div className="mx-4 mb-5 rounded-2xl p-4"
      style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Balance Reconciliation</h2>
        <button
          onClick={() => setShowInput((v) => !v)}
          className="text-xs font-medium"
          style={{ color: 'var(--accent)' }}
        >
          {data?.snapshot ? 'Update snapshot' : 'Set balance'}
        </button>
      </div>

      {showInput && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>₹</span>
            <input
              type="number"
              placeholder="Current bank balance"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text)' }}
              inputMode="decimal"
            />
          </div>
          <input
            type="text"
            placeholder="Note (optional, e.g. 'Bank balance as of today')"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
          {saveError && <p className="text-xs" style={{ color: 'var(--expense)' }}>{saveError}</p>}
          <button
            onClick={saveSnapshot}
            disabled={saving || !inputVal}
            className="w-full py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? 'Saving…' : 'Save snapshot'}
          </button>
        </div>
      )}

      {!data?.snapshot ? (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Enter your real bank balance once. After that, every transaction is tracked against it — you can instantly see if the numbers match.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Snapshot balance</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                {new Date(data.snapshot.snapshot_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                {data.snapshot.note ? ` · ${data.snapshot.note}` : ''}
              </p>
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{fmt(data.snapshot.actual_balance)}</span>
          </div>

          {data.delta != null && (
            <div className="flex justify-between items-center">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Transactions since ({data.tx_count})</p>
              <span className="font-semibold text-sm" style={{ color: data.delta >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                {data.delta >= 0 ? '+' : ''}{fmt(data.delta)}
              </span>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)' }} />

          {hasDrift && (
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Computed balance</p>
              <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>{fmt(data.computed!)}</span>
            </div>
          )}

          <p className="text-xs pt-1" style={{ color: 'var(--muted)' }}>
            Compare this with your actual bank app balance. If they match ✅ — all transactions are captured. A gap means some transactions were missed.
          </p>
        </div>
      )}
    </div>
  );
}
