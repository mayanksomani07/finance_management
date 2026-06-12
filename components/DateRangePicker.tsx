'use client';
import { useState, useRef, useEffect } from 'react';

/* ── tiny date type ─────────────────────────────────────────────────────────── */
type D = { y: number; m: number; d: number };

function parse(s: string): D | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}
function fmt(d: D) {
  return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
}
function same(a: D, b: D)   { return a.y===b.y && a.m===b.m && a.d===b.d; }
function before(a: D, b: D) {
  if (a.y !== b.y) return a.y < b.y;
  if (a.m !== b.m) return a.m < b.m;
  return a.d < b.d;
}
function daysIn(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function startDow(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }
function todayD(): D {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}
function addDays(days: number): D {
  const t = new Date(); t.setDate(t.getDate() + days);
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const MONTHS3 = MONTHS.map(m => m.slice(0, 3));
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function display(s: string) {
  const d = parse(s);
  if (!d) return null;
  return `${MONTHS3[d.m - 1]} ${d.d}, ${d.y}`;
}

/* ── single calendar popover ────────────────────────────────────────────────── */
interface CalProps {
  value: string;
  minDate?: string;    // inclusive lower bound
  maxDate?: string;    // inclusive upper bound
  align?: 'left' | 'right';
  onPick(v: string): void;
  onClose(): void;
}

function Calendar({ value, minDate, maxDate, align = 'left', onPick, onClose }: CalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = parse(value) ?? todayD();
  const [vy, setVy] = useState(initial.y);
  const [vm, setVm] = useState(initial.m);
  const [hover, setHover] = useState<D | null>(null);

  const selected = parse(value);
  const minD = parse(minDate ?? '');
  const maxD = parse(maxDate ?? '');
  const tod  = todayD();

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  function prevMonth() { if(vm===1){setVm(12);setVy(y=>y-1);}else setVm(m=>m-1); }
  function nextMonth() { if(vm===12){setVm(1);setVy(y=>y+1);}else setVm(m=>m+1); }

  function isDisabled(cell: D) {
    if (minD && before(cell, minD)) return true;
    if (maxD && before(maxD, cell)) return true;
    return false;
  }

  const totalDays = daysIn(vy, vm);
  const offset    = startDow(vy, vm);
  const cells: (D | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => ({ y: vy, m: vm, d: i + 1 })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={ref}
      className="absolute z-[100] mt-2 rounded-2xl shadow-2xl"
      style={{
        background: 'var(--card)',
        border: '1.5px solid var(--border)',
        width: 280,
        boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
        ...(align === 'right' ? { right: 0 } : { left: 0 }),
      }}
      onClick={e => e.stopPropagation()}>

      {/* month nav */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={prevMonth} type="button"
          className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-base transition active:scale-95"
          style={{ background:'var(--bg2)', color:'var(--text3)', border:'1px solid var(--border)' }}>
          ‹
        </button>
        <span className="text-sm font-extrabold" style={{ color:'var(--text)' }}>
          {MONTHS[vm - 1]} {vy}
        </span>
        <button onClick={nextMonth} type="button"
          className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-base transition active:scale-95"
          style={{ background:'var(--bg2)', color:'var(--text3)', border:'1px solid var(--border)' }}>
          ›
        </button>
      </div>

      {/* day headers */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] font-extrabold tracking-widest py-1"
            style={{ color:'var(--text4)' }}>{d}</div>
        ))}
      </div>

      {/* cells */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5"
        onMouseLeave={() => setHover(null)}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;
          const dis  = isDisabled(cell);
          const sel  = !!selected && same(cell, selected);
          const hov  = !!hover && same(cell, hover);
          const tod_c = same(cell, tod);

          return (
            <div key={`${cell.m}-${cell.d}`}
              className="flex items-center justify-center h-9"
              onMouseEnter={() => !dis && setHover(cell)}>
              <button type="button" disabled={dis}
                onClick={() => { onPick(fmt(cell)); onClose(); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all active:scale-90"
                style={{
                  fontWeight: sel || tod_c ? 800 : 500,
                  background: sel
                    ? 'var(--accent)'
                    : hov && !dis
                    ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                    : 'transparent',
                  color: sel
                    ? '#fff'
                    : dis
                    ? 'var(--text4)'
                    : tod_c
                    ? 'var(--accent)'
                    : 'var(--text)',
                  opacity: dis ? 0.35 : 1,
                  boxShadow: sel ? '0 2px 10px rgba(124,110,245,0.45)' : 'none',
                  cursor: dis ? 'not-allowed' : 'pointer',
                }}>
                {cell.d}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── quick ranges ───────────────────────────────────────────────────────────── */
const QUICK = [
  { label: 'Today',        range: (): [D,D] => { const t=todayD(); return [t,t]; } },
  { label: 'Yesterday',    range: (): [D,D] => { const t=addDays(-1); return [t,t]; } },
  { label: 'This week',    range: (): [D,D] => {
    const t=new Date(), dow=t.getDay();
    const mon=new Date(t); mon.setDate(t.getDate()-(dow===0?6:dow-1));
    const sun=new Date(mon); sun.setDate(mon.getDate()+6);
    return [
      {y:mon.getFullYear(),m:mon.getMonth()+1,d:mon.getDate()},
      {y:sun.getFullYear(),m:sun.getMonth()+1,d:sun.getDate()},
    ];
  }},
  { label: 'This month',   range: (): [D,D] => {
    const t=new Date(), y=t.getFullYear(), m=t.getMonth()+1;
    return [{y,m,d:1},{y,m,d:daysIn(y,m)}];
  }},
  { label: 'Last month',   range: (): [D,D] => {
    const t=new Date();
    const m=t.getMonth()===0?12:t.getMonth();
    const y=t.getMonth()===0?t.getFullYear()-1:t.getFullYear();
    return [{y,m,d:1},{y,m,d:daysIn(y,m)}];
  }},
  { label: 'Last 30 days', range: (): [D,D] => [addDays(-29), todayD()] },
  { label: 'This year',    range: (): [D,D] => {
    const y=new Date().getFullYear(); return [{y,m:1,d:1},{y,m:12,d:31}];
  }},
];

/* ── main component ─────────────────────────────────────────────────────────── */
interface Props {
  from: string; to: string;
  onFromChange(v: string): void;
  onToChange(v: string): void;
}

export default function DateRangePicker({ from, to, onFromChange, onToChange }: Props) {
  const [open, setOpen] = useState<'from'|'to'|null>(null);

  function pickFrom(v: string) {
    onFromChange(v);
    // if existing to is before new from, clear to
    const newFrom = parse(v);
    const curTo   = parse(to);
    if (newFrom && curTo && !before(newFrom, curTo) && !same(newFrom, curTo)) {
      onToChange('');
    }
  }

  function pickTo(v: string) {
    onToChange(v);
  }

  function applyQuick([f, t]: [D, D]) {
    onFromChange(fmt(f));
    onToChange(fmt(t));
    setOpen(null);
  }

  const fromDisp = display(from);
  const toDisp   = display(to);

  return (
    <div className="mt-3 space-y-3">

      {/* ── From / To row ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {(['from', 'to'] as const).map(field => {
          const isFrom  = field === 'from';
          const disp    = isFrom ? fromDisp : toDisp;
          const isOpen  = open === field;
          const label   = isFrom ? 'From' : 'To';
          const icon    = isFrom ? '↗' : '↙';

          return (
            <div key={field} className="relative">
              <button type="button"
                onClick={() => setOpen(isOpen ? null : field)}
                className="w-full flex flex-col items-start px-3.5 py-3 rounded-2xl transition-all active:scale-[0.97]"
                style={{
                  background: isOpen
                    ? 'var(--accent)'
                    : disp
                    ? 'color-mix(in srgb, var(--accent) 10%, var(--bg2))'
                    : 'var(--bg2)',
                  border: `1.5px solid ${isOpen ? 'var(--accent)' : disp ? 'color-mix(in srgb, var(--accent) 40%, var(--border))' : 'var(--border)'}`,
                  boxShadow: isOpen ? '0 4px 16px rgba(124,110,245,0.3)' : 'none',
                }}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] font-black tracking-[0.18em] uppercase"
                    style={{ color: isOpen ? 'rgba(255,255,255,0.65)' : 'var(--text4)' }}>
                    {label}
                  </span>
                  <span className="text-[9px]"
                    style={{ color: isOpen ? 'rgba(255,255,255,0.5)' : 'var(--text4)' }}>
                    {icon}
                  </span>
                </div>
                <span className="text-xs font-bold leading-tight"
                  style={{ color: isOpen ? '#fff' : disp ? 'var(--text)' : 'var(--text3)' }}>
                  {disp ?? 'Pick a date'}
                </span>
                {/* calendar icon */}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: isOpen ? 'rgba(255,255,255,0.6)' : 'var(--text4)' }}>
                  📅
                </span>
              </button>

              {/* popover calendar */}
              {isOpen && (
                <Calendar
                  value={isFrom ? from : to}
                  minDate={!isFrom ? from || undefined : undefined}
                  align={isFrom ? 'left' : 'right'}
                  onPick={isFrom ? pickFrom : pickTo}
                  onClose={() => setOpen(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── range summary pill ── */}
      {from && to && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
          style={{
            background: 'color-mix(in srgb, var(--accent) 12%, var(--bg2))',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))',
          }}>
          <span className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
            {fromDisp} → {toDisp}
          </span>
          <button type="button" onClick={() => { onFromChange(''); onToChange(''); }}
            className="text-[10px] font-black px-2 py-0.5 rounded-lg transition active:scale-95"
            style={{ color:'var(--clr-want)', background:'var(--clr-want-bg)' }}>
            Clear
          </button>
        </div>
      )}

      {/* ── quick shortcuts ── */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map(q => (
          <button key={q.label} type="button"
            onClick={() => applyQuick(q.range())}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
            style={{
              background: 'var(--bg2)',
              color: 'var(--text3)',
              border: '1px solid var(--border)',
            }}>
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}
