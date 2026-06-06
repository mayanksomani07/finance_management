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
  lastUpdated?: number; // pass Date.now() whenever transactions change
}

export default function BalanceCheck({ lastUpdated }: BalanceCheckProps) {
  const [data, setData] = useState<BalanceData | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/balance');
    const json = await res.json();
    if (json.success) setData(json);
  }, []);

  useEffect(() => { load(); }, [load, lastUpdated]);

  async function saveSnapshot() {
    if (!inputVal) return;
    setSaving(true);
    await fetch('/api/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_balance: parseFloat(inputVal), note }),
    });
    setSaving(false);
    setShowInput(false);
    setInputVal('');
    setNote('');
    load();
  }

  const hasDrift = data?.computed != null && data?.snapshot != null;

  return (
    <div className="mx-4 mb-6 rounded-2xl bg-[#1a1a2e] border border-[#2a2a4a] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Balance Reconciliation</h2>
        <button
          onClick={() => setShowInput((v) => !v)}
          className="text-xs text-[#6c63ff] font-medium"
        >
          {data?.snapshot ? 'Update snapshot' : 'Set balance'}
        </button>
      </div>

      {showInput && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 bg-[#0f0f23] rounded-xl px-3 py-2">
            <span className="text-[#8888aa] text-sm">₹</span>
            <input
              type="number"
              placeholder="Current bank balance"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm outline-none"
              inputMode="decimal"
            />
          </div>
          <input
            type="text"
            placeholder="Note (optional, e.g. 'SBI as of today')"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-[#0f0f23] rounded-xl px-3 py-2 text-white text-sm outline-none placeholder:text-[#8888aa]"
          />
          <button
            onClick={saveSnapshot}
            disabled={saving || !inputVal}
            className="w-full py-2 rounded-xl bg-[#6c63ff] text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save snapshot'}
          </button>
        </div>
      )}

      {!data?.snapshot ? (
        <p className="text-xs text-[#8888aa]">
          Enter your real bank balance once. After that, every transaction is tracked against it — you can instantly see if the numbers match.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Snapshot row */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-[#8888aa]">Snapshot balance</p>
              <p className="text-xs text-[#555577] mt-0.5">
                {new Date(data.snapshot.snapshot_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                {data.snapshot.note ? ` · ${data.snapshot.note}` : ''}
              </p>
            </div>
            <span className="text-white font-semibold text-sm">{fmt(data.snapshot.actual_balance)}</span>
          </div>

          {/* Delta row */}
          {data.delta != null && (
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-[#8888aa]">Transactions since ({data.tx_count})</p>
              </div>
              <span className={`font-semibold text-sm ${data.delta >= 0 ? 'text-[#00d9a6]' : 'text-[#ff6b6b]'}`}>
                {data.delta >= 0 ? '+' : ''}{fmt(data.delta)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-[#2a2a4a]" />

          {/* Computed balance */}
          {hasDrift && (
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-white">Computed balance</p>
              <span className="text-lg font-bold text-white">{fmt(data.computed!)}</span>
            </div>
          )}

          <p className="text-xs text-[#8888aa] pt-1">
            Compare this with your actual bank app balance. If they match ✅ — all transactions are captured. A gap means some transactions were missed.
          </p>
        </div>
      )}
    </div>
  );
}
