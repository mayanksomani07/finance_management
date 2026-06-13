// Beautiful Excel export with embedded chart images
// ExcelJS for styling + Chart.js canvas→PNG for charts

import type { LocalTransaction } from './localStore';
import { categorizeExpense, normaliseIncomeCategory } from './categorize';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WealthSnapshot {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  eqTotalInvested: number; mfTotalInvested: number; indmoneyInvested: number;
  cryptoInvested: number;  debtInvested: number;    pfInvested: number;
  eqTotalCurrent: number;  mfTotalCurrent: number;  indmoneyCurrent: number;
  cryptoCurrent: number;   debtCurrent: number;     pfCurrent: number;
  bankBalance: number;     cashInHand: number;      mobikwik: number;
  bankTotal: number;
  creditCardDue: number;   payToSomeone: number;
  // granular breakdowns
  eqEquityInvested?: number;   eqEquityCurrent?: number;
  eqGoldInvested?: number;     eqGoldCurrent?: number;
  eqSilverInvested?: number;   eqSilverCurrent?: number;
  eqForeignInvested?: number;  eqForeignCurrent?: number;
  mfEquityInvested?: number;   mfEquityCurrent?: number;
  mfGoldInvested?: number;     mfGoldCurrent?: number;
  mfSilverInvested?: number;   mfSilverCurrent?: number;
  mfDebtInvested?: number;     mfDebtCurrent?: number;
  bondInvested?: number;       bondCurrent?: number;
  fdInvested?: number;         fdCurrent?: number;
}

export type ExportMode = 'transactions' | 'wealth' | 'both';

// ── Colour Palette ─────────────────────────────────────────────────────────

const P = {
  purple:     'FF6C63FF', purpleDk:   'FF4338CA', purplePale: 'FFEEF0FF', purpleMid:  'FFD5D3FF',
  teal:       'FF00C9A7', tealDk:     'FF0A7A58', tealPale:   'FFD0FFF5', tealMid:    'FF99F6E4',
  amber:      'FFCA8A04', amberDk:    'FF92400E', amberPale:  'FFFEF3C7', amberMid:   'FFFDE68A',
  red:        'FFE53935', redDk:      'FFC62828', redPale:    'FFFFF5F5', redMid:     'FFFECACA',
  green:      'FF15803D', greenDk:    'FF065F46', greenPale:  'FFF0FDF4', greenMid:   'FFBBF7D0',
  orange:     'FFD97706', orangeDk:   'FFC2410C', orangePale: 'FFFEF8EC', orangeMid:  'FFFED7AA',
  violet:     'FF7C3AED', violetPale: 'FFF5F3FF', violetMid:  'FFEDE9FE',
  silver:     'FF64748B', silverPale: 'FFF1F5F9', silverMid:  'FFE2E8F0',
  slate:      'FF334155', slateLight: 'FF64748B', slatePale:  'FFF8FAFC', slateMid:   'FFE2E8F0',
  white:      'FFFFFFFF', gray50:     'FFF9FAFB', gray100:    'FFF3F4F6', gray200:    'FFE5E7EB',
  gray400:    'FF9CA3AF', gray600:    'FF4B5563', gray800:    'FF1F2937',
  need:       'FF1D4ED8', needPale:   'FFEFF6FF', needMid:    'FFBFDBFE',
  want:       'FFC2410C', wantPale:   'FFFFF7ED', wantMid:    'FFFED7AA',
  invest:     'FF6D28D9', investPale: 'FFF5F3FF', investMid:  'FFEDE9FE',
  income:     'FF065F46', incomePale: 'FFF0FDF4', incomeMid:  'FFBBF7D0',
  // gold-specific
  gold:       'FFB7860B', goldPale:   'FFFEF9E7', goldMid:    'FFFDE68A',
};

// Vivid palette for charts — each asset class has a dedicated slot
const C = {
  equity:  '#6C63FF',
  mfEq:    '#00C9A7',
  gold:    '#F59E0B',
  silver:  '#94A3B8',
  foreign: '#3B82F6',
  crypto:  '#F97316',
  debt:    '#8B5CF6',
  pf:      '#10B981',
  bank:    '#64748B',
  income:  '#10B981',
  expense: '#F45B5B',
  net:     '#6C63FF',
};
const CHART_COLORS = [C.equity, C.mfEq, C.gold, C.silver, C.foreign, C.crypto, C.debt, C.pf, C.bank];
const CHART_PALE   = ['#EEF0FF','#D0FFF5','#FEF3C7','#F1F5F9','#EFF6FF','#FEF8EC','#F5F3FF','#F0FDF4','#F8FAFC'];

const CATEGORY_COLORS: Record<string, { text: string; pale: string; mid: string }> = {
  Need:       { text: P.need,   pale: P.needPale,   mid: P.needMid   },
  Want:       { text: P.want,   pale: P.wantPale,   mid: P.wantMid   },
  Investment: { text: P.invest, pale: P.investPale, mid: P.investMid },
  Income:     { text: P.income, pale: P.incomePale, mid: P.incomeMid },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
function fmtShort(n: number) {
  const abs = Math.abs(n), s = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${s}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `${s}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000)     return `${s}₹${(abs / 1000).toFixed(1)}K`;
  return `${s}₹${abs.toFixed(0)}`;
}
function pnlPct(inv: number, cur: number) {
  return inv > 0 ? ((cur - inv) / inv) * 100 : 0;
}
function enrichTx(t: LocalTransaction) {
  if (t.type === 'expense') {
    const { main, sub } = categorizeExpense(t.category, t.comment);
    return { ...t, mainCategory: main, subCategory: sub };
  }
  return { ...t, mainCategory: 'Income', subCategory: normaliseIncomeCategory(t.category) };
}

// ── ExcelJS style helpers ──────────────────────────────────────────────────

type EjFont = { bold?: boolean; size?: number; color?: { argb: string }; italic?: boolean; name?: string };
type EjFill = { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } };
type EjBorder = { top?: object; left?: object; bottom?: object; right?: object };
type EjAlignH = 'left' | 'center' | 'right' | 'fill' | 'justify' | 'centerContinuous' | 'distributed';
type EjAlignV = 'top' | 'middle' | 'bottom' | 'distributed' | 'justify';
type EjAlign = { horizontal?: EjAlignH; vertical?: EjAlignV; wrapText?: boolean };

function font(bold = false, size = 11, color = P.gray800, italic = false): EjFont {
  return { bold, size, color: { argb: color }, italic, name: 'Calibri' };
}
function fill(argb: string): EjFill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function border(argb = P.gray200): EjBorder {
  const s = { style: 'thin', color: { argb } };
  return { top: s, left: s, bottom: s, right: s };
}
function borderBottom(argb = P.gray200): EjBorder {
  return { bottom: { style: 'thin', color: { argb } } };
}
function align(h: EjAlignH = 'left', v: EjAlignV = 'middle', wrap = false): EjAlign {
  return { horizontal: h, vertical: v, wrapText: wrap };
}

// ── Chart image generation ─────────────────────────────────────────────────

async function renderChartPng(config: object, width = 780, height = 420): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);
  const ctx = canvas.getContext('2d')!;

  // White background with subtle gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(1, '#F8F9FF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Rounded border
  ctx.strokeStyle = '#E0E3F5';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // eslint-disable-next-line
  const chart = new Chart(ctx, config as never);
  await new Promise(r => setTimeout(r, 120));
  const png = canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
  chart.destroy();
  return png;
}

// ── Donut / Pie chart — large, label-rich ──────────────────────────────────

async function makePieChart(labels: string[], values: number[], title: string, subtitle = ''): Promise<string> {
  const total = values.reduce((a, b) => a + b, 0);
  const filtered = labels.map((l, i) => ({ l, v: values[i] })).filter(x => x.v > 0);
  const fLabels = filtered.map(x => x.l);
  const fValues = filtered.map(x => x.v);
  const colors  = fLabels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  return renderChartPng({
    type: 'doughnut',
    data: {
      labels: fLabels,
      datasets: [{
        data: fValues,
        backgroundColor: colors,
        borderColor: '#FFFFFF',
        borderWidth: 4,
        hoverOffset: 20,
        hoverBorderWidth: 3,
        hoverBorderColor: '#FFFFFF',
      }],
    },
    options: {
      responsive: false,
      animation: false,
      cutout: '52%',
      layout: { padding: { top: 10, bottom: 10, left: 10, right: 10 } },
      plugins: {
        legend: {
          position: 'right',
          align: 'center',
          labels: {
            font: { size: 12, family: 'Calibri', weight: '700' },
            padding: 16,
            color: '#1F2937',
            usePointStyle: true,
            pointStyleWidth: 12,
            generateLabels: (chart: { data: { labels: string[]; datasets: Array<{ data: number[]; backgroundColor: string[] }> } }) => {
              return chart.data.labels.map((label: string, i: number) => {
                const val = chart.data.datasets[0].data[i];
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return {
                  text: `${label}   ${pct}%   ${fmtShort(val)}`,
                  fillStyle: chart.data.datasets[0].backgroundColor[i],
                  strokeStyle: '#fff',
                  lineWidth: 2,
                  index: i,
                  pointStyle: 'circle',
                  hidden: false,
                };
              });
            },
          },
        },
        title: {
          display: true,
          text: subtitle ? [title, subtitle] : title,
          font: { size: 17, family: 'Calibri', weight: 'bold' },
          color: '#3730A3',
          padding: { top: 14, bottom: 20 },
        },
        tooltip: {
          enabled: false,
        },
      },
    },
  }, 820, 420);
}

// ── Grouped bar chart ──────────────────────────────────────────────────────

async function makeBarChart(
  labels: string[],
  datasets: { label: string; data: number[]; color: string }[],
  title: string,
  subtitle = '',
): Promise<string> {
  return renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.data.map(v => {
          if (d.label === 'Net') return v >= 0 ? C.net + 'DD' : C.expense + 'DD';
          return d.color + 'D0';
        }),
        borderColor: d.data.map(v => {
          if (d.label === 'Net') return v >= 0 ? C.net : C.expense;
          return d.color;
        }),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      })),
    },
    options: {
      responsive: false,
      animation: false,
      layout: { padding: { top: 10, left: 10, right: 10, bottom: 10 } },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            font: { size: 12, family: 'Calibri', weight: '700' },
            color: '#1F2937',
            padding: 18,
            usePointStyle: true,
            pointStyleWidth: 12,
            boxHeight: 10,
          },
        },
        title: {
          display: true,
          text: subtitle ? [title, subtitle] : title,
          font: { size: 17, family: 'Calibri', weight: 'bold' },
          color: '#3730A3',
          padding: { top: 14, bottom: 16 },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { font: { size: 12, family: 'Calibri', weight: '700' }, color: '#374151', maxRotation: 25 },
          grid: { color: '#EEF0FF', lineWidth: 1.5 },
          border: { color: '#D0D5F5', width: 2 },
        },
        y: {
          ticks: {
            font: { size: 11, family: 'Calibri', weight: '600' }, color: '#6B7280',
            callback: (v: number) => fmtShort(v),
            maxTicksLimit: 8,
          },
          grid: { color: '#EEF0FF', lineWidth: 1.5 },
          border: { color: '#D0D5F5', width: 2 },
        },
      },
    },
  }, 820, 440);
}

// ── Horizontal bar chart ───────────────────────────────────────────────────

async function makeHorizontalBarChart(
  labels: string[],
  values: number[],
  colors: string[],
  title: string,
  subtitle = '',
): Promise<string> {
  const h = Math.max(360, labels.length * 44 + 120);
  return renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Amount',
        data: values,
        backgroundColor: colors.map(c => c + 'CC'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 7,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      animation: false,
      layout: { padding: { top: 8, left: 10, right: 20, bottom: 10 } },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: subtitle ? [title, subtitle] : title,
          font: { size: 17, family: 'Calibri', weight: 'bold' },
          color: '#3730A3',
          padding: { top: 14, bottom: 16 },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { font: { size: 11, family: 'Calibri', weight: '600' }, color: '#6B7280', callback: (v: number) => fmtShort(v), maxTicksLimit: 7 },
          grid: { color: '#EEF0FF', lineWidth: 1.5 },
          border: { color: '#D0D5F5', width: 2 },
        },
        y: {
          ticks: { font: { size: 12, family: 'Calibri', weight: '700' }, color: '#1F2937' },
          grid: { display: false },
          border: { color: '#D0D5F5', width: 2 },
        },
      },
    },
  }, 820, h);
}

// ── Stacked bar chart for asset breakdown ──────────────────────────────────

async function makeStackedBarChart(
  labels: string[],
  datasets: { label: string; data: number[]; color: string }[],
  title: string,
): Promise<string> {
  return renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map(d => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.color + 'CC',
        borderColor: d.color,
        borderWidth: 1.5,
        borderRadius: 0,
        borderSkipped: false,
      })),
    },
    options: {
      responsive: false,
      animation: false,
      layout: { padding: { top: 10, left: 10, right: 10, bottom: 10 } },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            font: { size: 11, family: 'Calibri', weight: '700' },
            color: '#1F2937',
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        title: {
          display: true,
          text: title,
          font: { size: 17, family: 'Calibri', weight: 'bold' },
          color: '#3730A3',
          padding: { top: 14, bottom: 16 },
        },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { font: { size: 11, family: 'Calibri', weight: '700' }, color: '#374151' },
          grid: { color: '#EEF0FF' },
          border: { color: '#D0D5F5', width: 2 },
        },
        y: {
          stacked: true,
          ticks: { font: { size: 10, family: 'Calibri' }, color: '#6B7280', callback: (v: number) => fmtShort(v) },
          grid: { color: '#EEF0FF', lineWidth: 1.5 },
          border: { color: '#D0D5F5', width: 2 },
        },
      },
    },
  }, 820, 440);
}

// ── Section header helper ──────────────────────────────────────────────────

function sectionHeader(ws: import('exceljs').Worksheet, rowN: number, cols: number, label: string, color = P.purpleDk, pale = P.purpleMid) {
  ws.mergeCells(`A${rowN}:${colLetter(cols)}${rowN}`);
  const c = ws.getCell(`A${rowN}`);
  c.value     = `  ${label}`;
  c.font      = font(true, 12, color);
  c.fill      = fill(pale);
  c.alignment = align('left', 'middle');
  c.border    = border(color + '60');
  ws.getRow(rowN).height = 24;
}

function colLetter(n: number) {
  return String.fromCharCode(64 + n);
}

// ── Granular wealth derivation ─────────────────────────────────────────────

interface GranularWealth {
  pureEquityInvested: number;  pureEquityCurrent: number;
  mfEquityInvested: number;    mfEquityCurrent: number;
  goldInvested: number;        goldCurrent: number;       // combined Zerodha ETF + MF
  eqGoldInvested: number;      eqGoldCurrent: number;     // Zerodha Equity Gold only
  mfGoldInvested: number;      mfGoldCurrent: number;     // Zerodha MF Gold only
  silverInvested: number;      silverCurrent: number;     // combined
  eqSilverInvested: number;    eqSilverCurrent: number;
  mfSilverInvested: number;    mfSilverCurrent: number;
  foreignInvested: number;     foreignCurrent: number;    // Zerodha Foreign + IND Money
  eqForeignInvested: number;   eqForeignCurrent: number;  // Zerodha Foreign ETF only
  mfDebtInvested: number;      mfDebtCurrent: number;
}

function deriveGranular(w: WealthSnapshot): GranularWealth {
  const eqEq  = w.eqEquityInvested  ?? 0;  const eqEqC = w.eqEquityCurrent   ?? 0;
  const eqG   = w.eqGoldInvested    ?? 0;  const eqGC  = w.eqGoldCurrent     ?? 0;
  const eqS   = w.eqSilverInvested  ?? 0;  const eqSC  = w.eqSilverCurrent   ?? 0;
  const eqF   = w.eqForeignInvested ?? 0;  const eqFC  = w.eqForeignCurrent  ?? 0;
  const mfEq  = w.mfEquityInvested  ?? 0;  const mfEqC = w.mfEquityCurrent   ?? 0;
  const mfG   = w.mfGoldInvested    ?? 0;  const mfGC  = w.mfGoldCurrent     ?? 0;
  const mfS   = w.mfSilverInvested  ?? 0;  const mfSC  = w.mfSilverCurrent   ?? 0;
  const mfD   = w.mfDebtInvested    ?? 0;  const mfDC  = w.mfDebtCurrent     ?? 0;

  return {
    pureEquityInvested: eqEq,         pureEquityCurrent:  eqEqC,
    mfEquityInvested:   mfEq,         mfEquityCurrent:    mfEqC,
    goldInvested:       eqG + mfG,    goldCurrent:        eqGC + mfGC,
    eqGoldInvested:     eqG,          eqGoldCurrent:      eqGC,
    mfGoldInvested:     mfG,          mfGoldCurrent:      mfGC,
    silverInvested:     eqS + mfS,    silverCurrent:      eqSC + mfSC,
    eqSilverInvested:   eqS,          eqSilverCurrent:    eqSC,
    mfSilverInvested:   mfS,          mfSilverCurrent:    mfSC,
    foreignInvested:    eqF + w.indmoneyInvested,  foreignCurrent:   eqFC + w.indmoneyCurrent,
    eqForeignInvested:  eqF,          eqForeignCurrent:   eqFC,
    mfDebtInvested:     mfD,          mfDebtCurrent:      mfDC,
  };
}

// ── Main export ────────────────────────────────────────────────────────────

export async function exportToExcel(
  mode: ExportMode,
  transactions: LocalTransaction[],
  wealth: WealthSnapshot,
) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Finance Manager';
  wb.created = new Date();

  if (mode === 'transactions' || mode === 'both') {
    await buildTransactionsSheet(wb, transactions);
    await buildCategorySheet(wb, transactions);
    await buildMonthlySheet(wb, transactions);
  }
  if (mode === 'wealth' || mode === 'both') {
    await buildWealthSheet(wb, wealth);
    await buildAllocationSheet(wb, wealth);
  }
  if (mode === 'both') {
    await buildSummarySheet(wb, transactions, wealth);
  }

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `finance-export-${mode}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════════════════
// Sheet 1 — Transactions Ledger
// ══════════════════════════════════════════════════════════════════════════════

async function buildTransactionsSheet(wb: import('exceljs').Workbook, raw: LocalTransaction[]) {
  const ws = wb.addWorksheet('📋 Transactions', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  ws.columns = [
    { key: 'date',    width: 14 },
    { key: 'type',    width: 11 },
    { key: 'main',    width: 14 },
    { key: 'sub',     width: 20 },
    { key: 'amount',  width: 16 },
    { key: 'comment', width: 38 },
    { key: 'source',  width: 11 },
  ];

  const txs      = [...raw].sort((a, b) => b.date.localeCompare(a.date)).map(enrichTx);
  const expenses = txs.filter(t => t.type === 'expense');
  const incomes  = txs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const net      = totalInc - totalExp;

  ws.mergeCells('A1:G1');
  const title = ws.getCell('A1');
  title.value     = '  Transaction Ledger';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:B2');
  ws.mergeCells('C2:D2');
  ws.mergeCells('E2:F2');
  ws.getRow(2).height = 28;

  function statCell(addr: string, label: string, val: string, tc: string, pale: string, mid: string) {
    const c = ws.getCell(addr);
    c.value     = `${label}   ${val}`;
    c.font      = font(true, 11, tc);
    c.fill      = fill(pale);
    c.alignment = align('center', 'middle');
    c.border    = { ...borderBottom(mid), left: { style: 'thin', color: { argb: mid } }, right: { style: 'thin', color: { argb: mid } } };
  }
  statCell('A2', '⬇ Income',  inr(totalInc),       P.green, P.greenPale, P.greenMid);
  statCell('C2', '⬆ Expense', inr(totalExp),        P.red,   P.redPale,   P.redMid);
  statCell('E2', `${net >= 0 ? '✅' : '⚠️'} Net`, inr(net), net >= 0 ? P.green : P.red, net >= 0 ? P.greenPale : P.redPale, net >= 0 ? P.greenMid : P.redMid);
  const tc = ws.getCell('G2');
  tc.value     = `${txs.length} txns`;
  tc.font      = font(true, 10, P.slateLight);
  tc.fill      = fill(P.slateMid);
  tc.alignment = align('center', 'middle');

  ws.mergeCells('A3:G3');
  const cn = ws.getCell('A3');
  cn.value     = '  📊 See "Category Breakdown" and "Monthly Trend" sheets for charts';
  cn.font      = font(false, 10, P.slateLight, true);
  cn.fill      = fill(P.gray50);
  cn.alignment = align('left', 'middle');
  ws.getRow(3).height = 18;

  const headers = ['Date', 'Type', 'Category', 'Sub-Category', 'Amount (₹)', 'Description', 'Source'];
  const hRow = ws.getRow(4);
  hRow.height = 24;
  headers.forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.font      = font(true, 11, P.white);
    c.fill      = fill(P.purpleDk);
    c.alignment = align(i === 4 ? 'right' : 'left', 'middle');
    c.border    = border(P.purple);
  });

  txs.forEach((t, idx) => {
    const row  = ws.getRow(idx + 5);
    row.height = 20;
    const even = idx % 2 === 0;
    const bg   = even ? P.gray50 : P.white;
    const cat  = CATEGORY_COLORS[t.mainCategory] ?? { text: P.slate, pale: P.slatePale, mid: P.slateMid };

    const cells: [string | number, string, string, EjAlign][] = [
      [t.date.slice(0, 10), P.gray600, bg, align('left', 'middle')],
      [t.type === 'income' ? '⬇ Income' : '⬆ Expense', t.type === 'income' ? P.greenDk : P.redDk, t.type === 'income' ? P.greenPale : P.redPale, align('center', 'middle')],
      [t.mainCategory, cat.text, cat.pale, align('left', 'middle')],
      [t.subCategory,  P.gray600, bg, align('left', 'middle')],
      [t.amount, t.type === 'income' ? P.greenDk : P.redDk, bg, align('right', 'middle')],
      [t.comment || '—', t.comment ? P.gray800 : P.gray400, bg, align('left', 'middle')],
      [t.source === 'manual' ? '✍ Manual' : '📁 Excel', P.slateLight, P.slatePale, align('center', 'middle')],
    ];

    cells.forEach(([val, clr, bg2, al], ci) => {
      const c = row.getCell(ci + 1);
      c.value     = val;
      if (ci === 4) c.numFmt = '₹#,##0';
      c.font      = font(ci === 4, ci === 4 ? 11 : 10, clr);
      c.fill      = fill(bg2);
      c.alignment = al;
      c.border    = borderBottom(P.gray200);
    });
  });

  ws.autoFilter = { from: 'A4', to: 'G4' };
}

// ══════════════════════════════════════════════════════════════════════════════
// Sheet 2 — Category Breakdown + PIE CHARTS
// ══════════════════════════════════════════════════════════════════════════════

async function buildCategorySheet(wb: import('exceljs').Workbook, raw: LocalTransaction[]) {
  const ws = wb.addWorksheet('🥧 Category Breakdown', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
  });

  ws.columns = [
    { key: 'cat',   width: 20 },
    { key: 'sub',   width: 24 },
    { key: 'count', width: 10 },
    { key: 'total', width: 18 },
    { key: 'avg',   width: 16 },
    { key: 'pct',   width: 12 },
  ];

  const txs      = raw.map(enrichTx);
  const expenses = txs.filter(t => t.type === 'expense');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);

  ws.mergeCells('A1:F1');
  const title = ws.getCell('A1');
  title.value     = '  Spending by Category';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:F2');
  const sub = ws.getCell('A2');
  sub.value     = `  Total expenses: ${inr(totalExp)}  ·  ${expenses.length} transactions`;
  sub.font      = font(false, 11, P.purpleDk, true);
  sub.fill      = fill(P.purplePale);
  sub.alignment = align('left', 'middle');
  ws.getRow(2).height = 20;

  const mainAgg: Record<string, number> = {};
  for (const t of expenses) mainAgg[t.mainCategory] = (mainAgg[t.mainCategory] ?? 0) + t.amount;
  const mainLabels = Object.keys(mainAgg);
  const mainVals   = mainLabels.map(k => mainAgg[k]);

  const subAgg: Record<string, number> = {};
  for (const t of expenses) subAgg[t.subCategory] = (subAgg[t.subCategory] ?? 0) + t.amount;
  const subEntries = Object.entries(subAgg).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topSubs    = Object.entries(subAgg).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const topColors  = topSubs.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  const [piePng1, piePng2, topBarPng] = await Promise.all([
    makePieChart(mainLabels, mainVals, 'Spending by Main Category', `Total: ${fmtShort(totalExp)}`),
    makePieChart(subEntries.map(e => e[0]), subEntries.map(e => e[1]), 'Top Sub-Categories (by spend)', `${expenses.length} transactions`),
    makeHorizontalBarChart(
      topSubs.map(e => e[0]),
      topSubs.map(e => e[1]),
      topColors,
      'Top 12 Spending Sub-Categories',
      `Ranked by total spend`,
    ),
  ]);

  // Rows 3-24: two pie charts side by side
  for (let r = 3; r <= 26; r++) ws.getRow(r).height = 15;
  ws.getRow(3).height = 8;

  const imgId1 = wb.addImage({ base64: piePng1, extension: 'png' });
  const imgId2 = wb.addImage({ base64: piePng2, extension: 'png' });
  const imgId3 = wb.addImage({ base64: topBarPng, extension: 'png' });
  ws.addImage(imgId1, { tl: { col: 0, row: 2 }, ext: { width: 420, height: 300 } } as Parameters<typeof ws.addImage>[1]);
  ws.addImage(imgId2, { tl: { col: 3, row: 2 }, ext: { width: 420, height: 300 } } as Parameters<typeof ws.addImage>[1]);

  // Horizontal bar chart rows 27+
  const barH = Math.max(340, topSubs.length * 44 + 120);
  const barRows = Math.ceil(barH / 15) + 2;
  for (let r = 27; r <= 27 + barRows; r++) ws.getRow(r).height = 15;
  ws.addImage(imgId3, { tl: { col: 0, row: 26 }, ext: { width: 820, height: barH } } as Parameters<typeof ws.addImage>[1]);

  const startRow = 27 + barRows + 2;
  const hRow = ws.getRow(startRow);
  hRow.height = 24;
  ['Category', 'Sub-Category', 'Count', 'Total Spent', 'Avg / Txn', '% of Total'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.font      = font(true, 11, P.white);
    c.fill      = fill(P.purpleDk);
    c.alignment = align(i >= 2 ? 'center' : 'left', 'middle');
    c.border    = border(P.purple);
  });

  let rowIdx = startRow + 1;
  const mainOrder = ['Need', 'Want', 'Investment'];
  const grouped: Record<string, Record<string, { count: number; total: number }>> = {};
  for (const t of expenses) {
    if (!grouped[t.mainCategory]) grouped[t.mainCategory] = {};
    if (!grouped[t.mainCategory][t.subCategory]) grouped[t.mainCategory][t.subCategory] = { count: 0, total: 0 };
    grouped[t.mainCategory][t.subCategory].count++;
    grouped[t.mainCategory][t.subCategory].total += t.amount;
  }

  for (const main of mainOrder) {
    if (!grouped[main]) continue;
    const subs     = grouped[main];
    const cat      = CATEGORY_COLORS[main] ?? { text: P.slate, pale: P.slatePale, mid: P.slateMid };
    const mainTotal = Object.values(subs).reduce((s, v) => s + v.total, 0);
    const mCount    = Object.values(subs).reduce((s, v) => s + v.count, 0);

    ws.mergeCells(`A${rowIdx}:B${rowIdx}`);
    const mr = ws.getRow(rowIdx);
    mr.height = 26;
    const mc = mr.getCell(1);
    mc.value     = `◆  ${main}`;
    mc.font      = font(true, 13, cat.text);
    mc.fill      = fill(cat.mid);
    mc.alignment = align('left', 'middle');
    mc.border    = border(cat.text + '60');

    [mCount, mainTotal, mainTotal / mCount, (mainTotal / totalExp) * 100].forEach((val, ci) => {
      const c = mr.getCell(ci + 3);
      c.value     = val;
      c.numFmt    = ci === 0 ? '0' : ci === 3 ? '0.0"%"' : '₹#,##0';
      c.font      = font(true, 11, cat.text);
      c.fill      = fill(cat.mid);
      c.alignment = align('center', 'middle');
      c.border    = border(cat.text + '60');
    });
    rowIdx++;

    Object.entries(subs).sort((a, b) => b[1].total - a[1].total).forEach(([subCat, { count, total }]) => {
      const sr = ws.getRow(rowIdx++);
      sr.height = 20;
      const sc1 = sr.getCell(1);
      sc1.value = ''; sc1.fill = fill(P.white); sc1.border = borderBottom();
      const sc2 = sr.getCell(2);
      sc2.value     = `    · ${subCat}`;
      sc2.font      = font(false, 10, P.gray600);
      sc2.fill      = fill(P.gray50);
      sc2.alignment = align('left', 'middle');
      sc2.border    = borderBottom();
      [count, total, total / count, (total / totalExp) * 100].forEach((val, ci) => {
        const c = sr.getCell(ci + 3);
        c.value     = val;
        c.numFmt    = ci === 0 ? '0' : ci === 3 ? '0.0"%"' : '₹#,##0';
        c.font      = font(false, 10, P.gray600);
        c.fill      = fill(P.gray50);
        c.alignment = align('center', 'middle');
        c.border    = borderBottom();
      });
    });

    const sp = ws.getRow(rowIdx++);
    sp.height = 8;
  }

  ws.autoFilter = { from: `A${startRow}`, to: `F${startRow}` };
}

// ══════════════════════════════════════════════════════════════════════════════
// Sheet 3 — Monthly Trend + BAR CHART
// ══════════════════════════════════════════════════════════════════════════════

async function buildMonthlySheet(wb: import('exceljs').Workbook, raw: LocalTransaction[]) {
  const ws = wb.addWorksheet('📅 Monthly Trend', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 22 }],
  });

  ws.columns = [
    { key: 'month',   width: 18 },
    { key: 'income',  width: 16 },
    { key: 'expense', width: 16 },
    { key: 'net',     width: 16 },
    { key: 'savings', width: 14 },
  ];

  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const t of raw) {
    const mo = t.date.slice(0, 7);
    if (!byMonth[mo]) byMonth[mo] = { income: 0, expense: 0 };
    if (t.type === 'income')  byMonth[mo].income  += t.amount;
    if (t.type === 'expense') byMonth[mo].expense += t.amount;
  }
  const months = Object.keys(byMonth).sort();

  ws.mergeCells('A1:E1');
  const title = ws.getCell('A1');
  title.value     = '  Monthly Income vs Expense Trend';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  const moLabels = months.map(mo => {
    const [y, m] = mo.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
  });

  const avgInc = months.reduce((s, m) => s + byMonth[m].income,  0) / (months.length || 1);
  const avgExp = months.reduce((s, m) => s + byMonth[m].expense, 0) / (months.length || 1);

  const barPng = await makeBarChart(
    moLabels,
    [
      { label: 'Income',  data: months.map(m => byMonth[m].income),  color: C.income },
      { label: 'Expense', data: months.map(m => byMonth[m].expense), color: C.expense },
      { label: 'Net',     data: months.map(m => byMonth[m].income - byMonth[m].expense), color: C.net },
    ],
    'Monthly Income vs Expense',
    `${months.length} months  ·  Avg Income ${fmtShort(avgInc)}  ·  Avg Expense ${fmtShort(avgExp)}`,
  );

  for (let r = 2; r <= 21; r++) ws.getRow(r).height = 15;
  ws.addImage(wb.addImage({ base64: barPng, extension: 'png' }), {
    tl: { col: 0, row: 1 }, ext: { width: 820, height: 340 },
  } as Parameters<typeof ws.addImage>[1]);

  // Stats strip row 21
  ws.mergeCells('A21:B21');
  ws.mergeCells('C21:D21');
  ws.getRow(21).height = 26;
  [['A21', '📅 Months', String(months.length), P.purpleDk, P.purplePale, P.purpleMid],
   ['C21', '⬇ Avg Income',  inr(avgInc), P.greenDk, P.greenPale, P.greenMid],
   ['E21', '⬆ Avg Expense', inr(avgExp), P.redDk, P.redPale, P.redMid]].forEach(([addr, lbl, val, tc, pale, mid]) => {
    const c = ws.getCell(addr as string);
    c.value     = `${lbl}  ${val}`;
    c.font      = font(true, 10, tc as string);
    c.fill      = fill(pale as string);
    c.alignment = align('center', 'middle');
    c.border    = borderBottom(mid as string);
  });

  const hRow = ws.getRow(22);
  hRow.height = 24;
  ['Month', 'Income', 'Expense', 'Net Savings', 'Savings %'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.font      = font(true, 11, P.white);
    c.fill      = fill(P.purpleDk);
    c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
    c.border    = border(P.purple);
  });

  months.forEach((_, idx) => {
    const mo   = months[idx];
    const { income, expense } = byMonth[mo];
    const net  = income - expense;
    const pct  = income > 0 ? net / income : 0;
    const row  = ws.getRow(idx + 23);
    row.height = 22;
    const even = idx % 2 === 0;
    const bg   = even ? P.gray50 : P.white;
    const [y, m] = mo.split('-');
    const moLabel = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const vals: [string | number, string, string, string][] = [
      [moLabel, P.gray800, bg, ''],
      [income,  P.greenDk, P.greenPale, '₹#,##0'],
      [expense, P.redDk,   P.redPale,   '₹#,##0'],
      [net,  net >= 0 ? P.greenDk : P.redDk, net >= 0 ? P.greenPale : P.redPale, '₹#,##0'],
      [pct,  pct >= 0.2 ? P.greenDk : pct >= 0 ? P.amber : P.redDk, bg, '0.0%'],
    ];

    vals.forEach(([val, clr, bg2, fmt], ci) => {
      const c = row.getCell(ci + 1);
      c.value     = val;
      if (fmt) c.numFmt = fmt;
      c.font      = font(ci > 0, 11, clr);
      c.fill      = fill(bg2);
      c.alignment = align(ci === 0 ? 'left' : 'center', 'middle');
      c.border    = borderBottom();
    });
  });

  if (months.length > 0) {
    const totInc = months.reduce((s, m) => s + byMonth[m].income, 0);
    const totExp = months.reduce((s, m) => s + byMonth[m].expense, 0);
    const totNet = totInc - totExp;
    const tRow   = ws.getRow(months.length + 23);
    tRow.height  = 26;
    [['TOTAL', '', P.purpleDk], [totInc, '₹#,##0', P.greenDk], [totExp, '₹#,##0', P.redDk],
     [totNet, '₹#,##0', totNet >= 0 ? P.greenDk : P.redDk], [totNet / totInc, '0.0%', P.purpleDk]].forEach(([v, fmt, clr], i) => {
      const c = tRow.getCell(i + 1);
      c.value     = v as string | number;
      if (fmt) c.numFmt = fmt as string;
      c.font      = font(true, 12, clr as string);
      c.fill      = fill(P.purplePale);
      c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
      c.border    = border(P.purple);
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Sheet 4 — Wealth Overview
// Sections: Zerodha (Equity, Gold ETF, Silver ETF, Foreign ETF, MF-Equity, MF-Gold, MF-Silver, MF-Debt)
//           Foreign Stocks (Zerodha Foreign ETF + IND Money)
//           Crypto, Debt, PF, Bank
// ══════════════════════════════════════════════════════════════════════════════

async function buildWealthSheet(wb: import('exceljs').Workbook, w: WealthSnapshot) {
  const ws = wb.addWorksheet('💎 Wealth Overview', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }],
  });

  ws.columns = [
    { key: 'label',    width: 34 },
    { key: 'invested', width: 18 },
    { key: 'current',  width: 18 },
    { key: 'pnl',      width: 18 },
    { key: 'pct',      width: 14 },
  ];

  const g = deriveGranular(w);

  ws.mergeCells('A1:E1');
  const title = ws.getCell('A1');
  title.value     = '  Wealth & Net Worth Snapshot';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:B2');
  ws.mergeCells('C2:D2');
  ws.getRow(2).height = 30;
  [['A2', `🏦 Assets  ${fmtShort(w.totalAssets)}`,      P.greenDk, P.greenMid],
   ['C2', `💳 Liab  ${fmtShort(w.totalLiabilities)}`,   P.redDk,   P.redMid],
   ['E2', `✦ Net Worth  ${fmtShort(w.netWorth)}`,        w.netWorth >= 0 ? P.purpleDk : P.redDk, w.netWorth >= 0 ? P.purpleMid : P.redMid]].forEach(([addr, val, tc, pale]) => {
    const c = ws.getCell(addr as string);
    c.value     = val;
    c.font      = font(true, 13, tc as string);
    c.fill      = fill(pale as string);
    c.alignment = align('center', 'middle');
    c.border    = border(tc + '60' as string);
  });

  const hRow = ws.getRow(3);
  hRow.height = 22;
  ['Asset', 'Invested', 'Current Value', 'P&L', '% Return'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.font      = font(true, 11, P.white);
    c.fill      = fill(P.purpleDk);
    c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
    c.border    = border(P.purple);
  });

  // Asset rows definition
  type AssetRow = { label: string; inv: number; cur: number; color: string; pale: string; indent?: boolean; sectionHeader?: boolean };
  const assetDefs: AssetRow[] = [];

  const zTotal = { inv: w.eqTotalInvested + w.mfTotalInvested, cur: w.eqTotalCurrent + w.mfTotalCurrent };
  assetDefs.push({ label: '📈  ZERODHA (Kite + Coin)', inv: zTotal.inv, cur: zTotal.cur, color: P.purple, pale: P.purpleMid, sectionHeader: true });

  // Equity sub-section
  if (g.pureEquityInvested > 0 || g.pureEquityCurrent > 0)
    assetDefs.push({ label: '   · Stocks (Pure Equity)', inv: g.pureEquityInvested, cur: g.pureEquityCurrent, color: P.purple, pale: P.purplePale, indent: true });
  if (g.mfEquityInvested > 0 || g.mfEquityCurrent > 0)
    assetDefs.push({ label: '   · MF — Equity Funds', inv: g.mfEquityInvested, cur: g.mfEquityCurrent, color: P.teal, pale: P.tealPale, indent: true });

  // Gold — separate rows for ETF + MF
  const goldRow: AssetRow = { label: '   · Gold (ETF + MF combined)', inv: g.goldInvested, cur: g.goldCurrent, color: P.amber, pale: P.amberPale, indent: true };
  if (g.goldInvested > 0 || g.goldCurrent > 0) {
    assetDefs.push(goldRow);
    if (g.eqGoldInvested > 0 || g.eqGoldCurrent > 0)
      assetDefs.push({ label: '      ↳ Gold ETF (Equity / Kite)', inv: g.eqGoldInvested, cur: g.eqGoldCurrent, color: P.amber, pale: P.goldPale, indent: true });
    if (g.mfGoldInvested > 0 || g.mfGoldCurrent > 0)
      assetDefs.push({ label: '      ↳ Gold MF (Coin)', inv: g.mfGoldInvested, cur: g.mfGoldCurrent, color: P.amber, pale: P.goldPale, indent: true });
  }

  // Silver — separate rows for ETF + MF
  if (g.silverInvested > 0 || g.silverCurrent > 0) {
    assetDefs.push({ label: '   · Silver (ETF + MF combined)', inv: g.silverInvested, cur: g.silverCurrent, color: P.silver, pale: P.silverPale, indent: true });
    if (g.eqSilverInvested > 0 || g.eqSilverCurrent > 0)
      assetDefs.push({ label: '      ↳ Silver ETF (Equity / Kite)', inv: g.eqSilverInvested, cur: g.eqSilverCurrent, color: P.silver, pale: P.silverMid, indent: true });
    if (g.mfSilverInvested > 0 || g.mfSilverCurrent > 0)
      assetDefs.push({ label: '      ↳ Silver MF (Coin)', inv: g.mfSilverInvested, cur: g.mfSilverCurrent, color: P.silver, pale: P.silverMid, indent: true });
  }

  if (g.mfDebtInvested > 0 || g.mfDebtCurrent > 0)
    assetDefs.push({ label: '   · MF — Debt Funds (Coin)', inv: g.mfDebtInvested, cur: g.mfDebtCurrent, color: P.violet, pale: P.violetPale, indent: true });

  // Foreign Stocks section — Zerodha ETF + IND Money
  assetDefs.push({ label: '🌐  FOREIGN STOCKS (Combined)', inv: g.foreignInvested, cur: g.foreignCurrent, color: P.teal, pale: P.tealMid, sectionHeader: true });
  assetDefs.push({ label: '   · Zerodha Foreign ETF (Kite)', inv: g.eqForeignInvested, cur: g.eqForeignCurrent, color: P.teal, pale: P.tealPale, indent: true });
  assetDefs.push({ label: '   · IND Money (US Stocks)', inv: w.indmoneyInvested, cur: w.indmoneyCurrent, color: P.teal, pale: P.tealPale, indent: true });

  // Crypto
  if (w.cryptoInvested > 0 || w.cryptoCurrent > 0)
    assetDefs.push({ label: '₿  Crypto (CoinDCX)', inv: w.cryptoInvested, cur: w.cryptoCurrent, color: P.orange, pale: P.orangePale });

  // Debt
  assetDefs.push({ label: '🏛  DEBT INSTRUMENTS', inv: w.debtInvested, cur: w.debtCurrent, color: P.violet, pale: P.violetMid, sectionHeader: true });
  if (w.bondInvested ?? 0 > 0)
    assetDefs.push({ label: '   · Bonds (Stable Money)', inv: w.bondInvested ?? 0, cur: w.bondCurrent ?? 0, color: P.violet, pale: P.violetPale, indent: true });
  if (w.fdInvested ?? 0 > 0)
    assetDefs.push({ label: '   · Fixed Deposit', inv: w.fdInvested ?? 0, cur: w.fdCurrent ?? 0, color: P.violet, pale: P.violetPale, indent: true });

  // PF & Bank
  if (w.pfInvested > 0 || w.pfCurrent > 0)
    assetDefs.push({ label: '🔒  Provident Fund (PF / EPFO)', inv: w.pfInvested, cur: w.pfCurrent, color: P.green, pale: P.greenPale });
  if (w.bankTotal > 0)
    assetDefs.push({ label: '🏦  Bank & Cash', inv: w.bankTotal, cur: w.bankTotal, color: P.slate, pale: P.slatePale });

  let r = 4;
  for (const a of assetDefs) {
    const row  = ws.getRow(r++);
    row.height = a.sectionHeader ? 26 : 20;
    const pnl  = a.cur - a.inv;
    const pct  = pnlPct(a.inv, a.cur);
    const isZero = a.cur === 0 && a.inv === 0;

    const lc = row.getCell(1);
    lc.value     = a.label;
    lc.font      = font(a.sectionHeader ?? false, a.sectionHeader ? 12 : 10, a.sectionHeader ? a.color : (a.indent ? P.gray600 : P.gray800));
    lc.fill      = fill(a.sectionHeader ? a.pale : (r % 2 === 0 ? P.gray50 : P.white));
    lc.alignment = align('left', 'middle');
    lc.border    = a.sectionHeader ? border(a.color + '60') : borderBottom(P.gray200);

    if (isZero && !a.sectionHeader) {
      ws.mergeCells(`B${r - 1}:E${r - 1}`);
      const nc = row.getCell(2);
      nc.value = '—'; nc.font = font(false, 10, P.gray400);
      nc.fill = fill(P.gray50); nc.alignment = align('center', 'middle');
      continue;
    }
    if (isZero && a.sectionHeader) {
      ws.mergeCells(`B${r - 1}:E${r - 1}`);
      const nc = row.getCell(2);
      nc.value = '—'; nc.font = font(false, 10, P.gray400);
      nc.fill = fill(a.pale); nc.alignment = align('center', 'middle');
      continue;
    }

    [[a.inv, P.gray600, a.sectionHeader ? a.pale : P.gray50, '₹#,##0'],
     [a.cur, a.color, a.pale, '₹#,##0'],
     [pnl, pnl >= 0 ? P.greenDk : P.redDk, pnl >= 0 ? P.greenPale : P.redPale, '₹#,##0'],
     [pct / 100, pct >= 0 ? P.greenDk : P.redDk, a.sectionHeader ? a.pale : P.gray50, '+0.00%;-0.00%']].forEach(([val, clr, bg, fmt], ci) => {
      const c = row.getCell(ci + 2);
      c.value     = val as number;
      c.numFmt    = fmt as string;
      c.font      = font(a.sectionHeader || ci === 1 || ci === 2 || ci === 3, a.sectionHeader ? 11 : 10, clr as string);
      c.fill      = fill(bg as string);
      c.alignment = align('center', 'middle');
      c.border    = a.sectionHeader ? border(a.color + '60') : borderBottom(P.gray200);
    });
  }

  // Grand total
  const totInv = w.eqTotalInvested + w.mfTotalInvested + g.foreignInvested + w.cryptoInvested + w.debtInvested + w.pfInvested;
  const totCur = w.eqTotalCurrent  + w.mfTotalCurrent  + g.foreignCurrent  + w.cryptoCurrent  + w.debtCurrent  + w.pfCurrent;
  const totPnl = totCur - totInv;
  const totPct = pnlPct(totInv, totCur);
  const totRow = ws.getRow(r++);
  totRow.height = 30;
  [['TOTAL INVESTED (excl. Bank)', P.purpleDk, P.purpleMid, ''],
   [totInv, P.gray600, P.purplePale, '₹#,##0'],
   [totCur, P.purpleDk, P.purplePale, '₹#,##0'],
   [totPnl, totPnl >= 0 ? P.greenDk : P.redDk, totPnl >= 0 ? P.greenPale : P.redPale, '₹#,##0'],
   [totPct / 100, totPct >= 0 ? P.greenDk : P.redDk, P.purplePale, '+0.00%;-0.00%']].forEach(([v, clr, bg, fmt], i) => {
    const c = totRow.getCell(i + 1);
    c.value     = v as string | number;
    if (fmt) c.numFmt = fmt as string;
    c.font      = font(true, 12, clr as string);
    c.fill      = fill(bg as string);
    c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
    c.border    = border(P.purple);
  });

  // Liabilities
  r++;
  sectionHeader(ws, r++, 5, 'Liabilities', P.redDk, P.redMid);
  const liabRow = ws.getRow(r++);
  liabRow.height = 22;
  ws.mergeCells(`A${liabRow.number}:C${liabRow.number}`);
  const la = liabRow.getCell(1);
  la.value     = '💳 Credit Card + Dues';
  la.font      = font(false, 11, P.gray600);
  la.fill      = fill(P.redPale);
  la.alignment = align('left', 'middle');
  la.border    = borderBottom(P.redMid);
  const lv = liabRow.getCell(4);
  lv.value     = w.totalLiabilities;
  lv.numFmt    = '₹#,##0';
  lv.font      = font(true, 12, P.redDk);
  lv.fill      = fill(P.redPale);
  lv.alignment = align('center', 'middle');
  lv.border    = borderBottom(P.redMid);
}

// ══════════════════════════════════════════════════════════════════════════════
// Sheet 5 — Asset Allocation + PIE + BAR CHARTS
// ══════════════════════════════════════════════════════════════════════════════

async function buildAllocationSheet(wb: import('exceljs').Workbook, w: WealthSnapshot) {
  const ws = wb.addWorksheet('🎯 Asset Allocation', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 26 }],
  });

  ws.columns = [
    { key: 'asset',    width: 26 },
    { key: 'value',    width: 18 },
    { key: 'pct',      width: 14 },
    { key: 'invested', width: 18 },
    { key: 'pnl',      width: 18 },
  ];

  const g = deriveGranular(w);

  // Granular slices — Gold, Silver, Foreign all separate
  const slices = [
    { name: 'Equity Stocks',   cur: g.pureEquityCurrent,  inv: g.pureEquityInvested,  color: CHART_COLORS[0], pale: CHART_PALE[0] },
    { name: 'MF Equity Funds', cur: g.mfEquityCurrent,    inv: g.mfEquityInvested,    color: CHART_COLORS[1], pale: CHART_PALE[1] },
    { name: 'Gold',            cur: g.goldCurrent,         inv: g.goldInvested,         color: CHART_COLORS[2], pale: CHART_PALE[2] },
    { name: 'Silver',          cur: g.silverCurrent,       inv: g.silverInvested,       color: CHART_COLORS[3], pale: CHART_PALE[3] },
    { name: 'Foreign Stocks',  cur: g.foreignCurrent,      inv: g.foreignInvested,      color: CHART_COLORS[4], pale: CHART_PALE[4] },
    { name: 'Crypto',          cur: w.cryptoCurrent,       inv: w.cryptoInvested,       color: CHART_COLORS[5], pale: CHART_PALE[5] },
    { name: 'Debt',            cur: w.debtCurrent + (w.mfDebtCurrent ?? 0),   inv: w.debtInvested + (w.mfDebtInvested ?? 0),   color: CHART_COLORS[6], pale: CHART_PALE[6] },
    { name: 'PF',              cur: w.pfCurrent,           inv: w.pfInvested,           color: CHART_COLORS[7], pale: CHART_PALE[7] },
    { name: 'Bank & Cash',     cur: w.bankTotal,           inv: w.bankTotal,            color: CHART_COLORS[8], pale: CHART_PALE[8] },
  ].filter(s => s.cur > 0 || s.inv > 0);

  const totalCur  = slices.reduce((s, x) => s + x.cur, 0);
  const totalInvA = slices.reduce((s, x) => s + x.inv, 0);

  ws.mergeCells('A1:E1');
  const title = ws.getCell('A1');
  title.value     = '  Asset Allocation & Portfolio Mix';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  const activeSlices = slices.filter(s => s.inv > 0);
  const visibleSlices = slices.filter(s => s.inv > 0 || s.cur > 0);

  const [piePng, barPng, stackedPng] = await Promise.all([
    makePieChart(
      activeSlices.map(s => s.name),
      activeSlices.map(s => s.inv),
      'Asset Allocation (by Invested Amount)',
      `Total Invested: ${fmtShort(totalInvA)}`,
    ),
    makeBarChart(
      visibleSlices.map(s => s.name),
      [
        { label: 'Invested', data: visibleSlices.map(s => s.inv), color: C.equity },
        { label: 'Current',  data: visibleSlices.map(s => s.cur), color: C.mfEq },
      ],
      'Invested vs Current Value by Asset',
      `Overall P&L: ${fmtShort(totalCur - totalInvA)} (${pnlPct(totalInvA, totalCur).toFixed(1)}%)`,
    ),
    makeStackedBarChart(
      ['Portfolio'],
      activeSlices.map(s => ({ label: s.name, data: [s.inv], color: s.color })),
      'Portfolio Composition (Stacked)',
    ),
  ]);

  // Rows 2-22: pie (left) + bar (right) side by side
  for (let r = 2; r <= 24; r++) ws.getRow(r).height = 14;
  ws.addImage(wb.addImage({ base64: piePng, extension: 'png' }), {
    tl: { col: 0, row: 1 }, ext: { width: 430, height: 320 },
  } as Parameters<typeof ws.addImage>[1]);
  ws.addImage(wb.addImage({ base64: barPng, extension: 'png' }), {
    tl: { col: 3, row: 1 }, ext: { width: 430, height: 320 },
  } as Parameters<typeof ws.addImage>[1]);

  // Stacked bar chart — rows 25-42
  for (let r = 25; r <= 42; r++) ws.getRow(r).height = 14;
  ws.addImage(wb.addImage({ base64: stackedPng, extension: 'png' }), {
    tl: { col: 0, row: 24 }, ext: { width: 820, height: 240 },
  } as Parameters<typeof ws.addImage>[1]);

  // Stats strip row 25+18=43 → let's use a fixed row after stacked chart
  ws.getRow(43).height = 26;
  ws.mergeCells('A43:B43');
  ws.mergeCells('C43:D43');
  [['A43', `📊 Total Invested: ${fmtShort(totalInvA)}`, P.purpleDk, P.purplePale],
   ['C43', `💰 Current Value: ${fmtShort(totalCur)}`, P.greenDk, P.greenPale],
   ['E43', `P&L: ${fmtShort(totalCur - totalInvA)} (${pnlPct(totalInvA, totalCur).toFixed(1)}%)`, totalCur >= totalInvA ? P.greenDk : P.redDk, totalCur >= totalInvA ? P.greenMid : P.redMid]].forEach(([addr, val, tc, pale]) => {
    const c = ws.getCell(addr as string);
    c.value     = val;
    c.font      = font(true, 11, tc as string);
    c.fill      = fill(pale as string);
    c.alignment = align('center', 'middle');
    c.border    = border(tc + '40' as string);
  });

  const hRow = ws.getRow(44);
  hRow.height = 24;
  ['Asset Class', 'Current Value', 'Allocation %', 'Invested', 'P&L'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.font      = font(true, 11, P.white);
    c.fill      = fill(P.purpleDk);
    c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
    c.border    = border(P.purple);
  });

  slices.sort((a, b) => b.inv - a.inv).forEach((s, idx) => {
    const pct = totalInvA > 0 ? (s.inv / totalInvA) * 100 : 0;
    const pnl = s.cur - s.inv;
    const row = ws.getRow(idx + 45);
    row.height = 24;
    const colorHex = s.color.replace('#', 'FF');
    const palHex   = s.pale.replace('#', 'FF');

    [[s.name, colorHex, palHex, ''],
     [s.cur,  colorHex, palHex, '₹#,##0'],
     [pct / 100, colorHex, palHex, '0.0%'],
     [s.inv, P.gray600, P.gray50, '₹#,##0'],
     [pnl, pnl >= 0 ? P.greenDk : P.redDk, pnl >= 0 ? P.greenPale : P.redPale, '+₹#,##0;-₹#,##0']].forEach(([v, clr, bg, fmt], i) => {
      const c = row.getCell(i + 1);
      c.value     = v as string | number;
      if (fmt) c.numFmt = fmt as string;
      c.font      = font(true, 11, clr as string);
      c.fill      = fill(bg as string);
      c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
      c.border    = border(colorHex + '50');
    });
  });

  const totPnl = slices.reduce((s, x) => s + (x.cur - x.inv), 0);
  const tRow   = ws.getRow(slices.length + 45);
  tRow.height  = 28;
  [['TOTAL', P.purpleDk, P.purpleMid, ''],
   [totalCur, P.purpleDk, P.purplePale, '₹#,##0'],
   [1, P.purpleDk, P.purplePale, '0.0%'],
   [totalInvA, P.gray600, P.purplePale, '₹#,##0'],
   [totPnl, totPnl >= 0 ? P.greenDk : P.redDk, totPnl >= 0 ? P.greenPale : P.redPale, '+₹#,##0;-₹#,##0']].forEach(([v, clr, bg, fmt], i) => {
    const c = tRow.getCell(i + 1);
    c.value     = v as string | number;
    if (fmt) c.numFmt = fmt as string;
    c.font      = font(true, 12, clr as string);
    c.fill      = fill(bg as string);
    c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
    c.border    = border(P.purple);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Sheet 6 — Summary Dashboard (both mode)
// ══════════════════════════════════════════════════════════════════════════════

async function buildSummarySheet(wb: import('exceljs').Workbook, raw: LocalTransaction[], w: WealthSnapshot) {
  const ws = wb.addWorksheet('🏠 Summary Dashboard', {});

  ws.columns = [
    { key: 'a', width: 28 },
    { key: 'b', width: 20 },
    { key: 'c', width: 20 },
    { key: 'd', width: 14 },
  ];

  const txs      = raw.map(enrichTx);
  const expenses = txs.filter(t => t.type === 'expense');
  const incomes  = txs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const net      = totalInc - totalExp;
  const g        = deriveGranular(w);

  ws.mergeCells('A1:D1');
  const title = ws.getCell('A1');
  title.value     = `  Personal Finance Dashboard  ·  ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  const catAgg: Record<string, number> = {};
  for (const t of expenses) catAgg[t.mainCategory] = (catAgg[t.mainCategory] ?? 0) + t.amount;

  // Wealth allocation — granular Gold, Silver, Foreign separated
  const wealthSlices = [
    { name: 'Equity Stocks',   val: g.pureEquityInvested },
    { name: 'MF Equity',       val: g.mfEquityInvested },
    { name: 'Gold',            val: g.goldInvested },
    { name: 'Silver',          val: g.silverInvested },
    { name: 'Foreign',         val: g.foreignInvested },
    { name: 'Crypto',          val: w.cryptoInvested },
    { name: 'Debt',            val: w.debtInvested + (w.mfDebtInvested ?? 0) },
    { name: 'PF',              val: w.pfInvested },
    { name: 'Bank',            val: w.bankTotal },
  ].filter(s => s.val > 0);

  const totInv = w.eqTotalInvested + w.mfTotalInvested + g.foreignInvested + w.cryptoInvested + w.debtInvested + w.pfInvested;
  const totCur = w.eqTotalCurrent  + w.mfTotalCurrent  + g.foreignCurrent  + w.cryptoCurrent  + w.debtCurrent  + w.pfCurrent;
  const totPnl = totCur - totInv;

  const [expPie, wealthPie] = await Promise.all([
    makePieChart(Object.keys(catAgg), Object.values(catAgg), 'Expense Categories', `Total: ${fmtShort(totalExp)}`),
    makePieChart(wealthSlices.map(s => s.name), wealthSlices.map(s => s.val), 'Wealth Allocation (Invested)', `Total: ${fmtShort(totInv)}`),
  ]);

  for (let r = 2; r <= 22; r++) ws.getRow(r).height = 14;
  ws.addImage(wb.addImage({ base64: expPie,    extension: 'png' }), { tl: { col: 0, row: 1 }, ext: { width: 420, height: 300 } } as Parameters<typeof ws.addImage>[1]);
  ws.addImage(wb.addImage({ base64: wealthPie, extension: 'png' }), { tl: { col: 2, row: 1 }, ext: { width: 420, height: 300 } } as Parameters<typeof ws.addImage>[1]);

  let r = 23;

  function heroCard(rowN: number, label: string, value: string, tc: string, pale: string, mid: string) {
    const row  = ws.getRow(rowN);
    row.height = 34;
    ws.mergeCells(`A${rowN}:B${rowN}`);
    const lc = row.getCell(1);
    lc.value     = label;
    lc.font      = font(true, 10, tc);
    lc.fill      = fill(pale);
    lc.alignment = align('left', 'middle');
    ws.mergeCells(`C${rowN}:D${rowN}`);
    const vc = row.getCell(3);
    vc.value     = value;
    vc.font      = font(true, 16, tc);
    vc.fill      = fill(mid);
    vc.alignment = align('right', 'middle');
    vc.border    = border(tc + '40');
  }

  function kvRow(rowN: number, label: string, value: string | number, tc: string, fmt = '') {
    const row  = ws.getRow(rowN);
    row.height = 22;
    ws.mergeCells(`A${rowN}:C${rowN}`);
    const lc = row.getCell(1);
    lc.value     = `  ${label}`;
    lc.font      = font(false, 11, P.gray600);
    lc.fill      = fill(P.gray50);
    lc.alignment = align('left', 'middle');
    lc.border    = borderBottom();
    const vc = row.getCell(4);
    vc.value     = value;
    if (fmt) vc.numFmt = fmt;
    vc.font      = font(true, 12, tc);
    vc.fill      = fill(P.white);
    vc.alignment = align('right', 'middle');
    vc.border    = borderBottom();
  }

  sectionHeader(ws, r++, 4, '📋 Transactions Summary', P.purpleDk, P.purpleMid);
  heroCard(r++, '⬇ Total Income',   inr(totalInc),  P.greenDk, P.greenPale, P.greenMid);
  heroCard(r++, '⬆ Total Expenses', inr(totalExp),  P.redDk,   P.redPale,   P.redMid);
  heroCard(r++, `${net >= 0 ? '✅' : '⚠️'} Net Savings`, inr(net), net >= 0 ? P.greenDk : P.redDk, net >= 0 ? P.greenPale : P.redPale, net >= 0 ? P.greenMid : P.redMid);
  kvRow(r++, 'Total Transactions', txs.length, P.purpleDk);
  kvRow(r++, 'Expense Count', expenses.length, P.redDk);
  kvRow(r++, 'Income Count',  incomes.length,  P.greenDk);
  if (totalInc > 0) kvRow(r++, 'Savings Rate', net / totalInc, P.tealDk, '0.0%');

  r++;
  sectionHeader(ws, r++, 4, '💎 Wealth Summary', P.purpleDk, P.purpleMid);
  heroCard(r++, '🏆 Net Worth',       fmtShort(w.netWorth),         w.netWorth >= 0 ? P.purpleDk : P.redDk, w.netWorth >= 0 ? P.purplePale : P.redPale, w.netWorth >= 0 ? P.purpleMid : P.redMid);
  heroCard(r++, '🏦 Total Assets',    fmtShort(w.totalAssets),      P.greenDk, P.greenPale, P.greenMid);
  heroCard(r++, '💳 Total Liab.',     fmtShort(w.totalLiabilities), P.redDk,   P.redPale,   P.redMid);

  r++;
  sectionHeader(ws, r++, 4, '📊 Asset Breakdown (Invested Amount)', P.amberDk, P.amberMid);
  if (g.pureEquityInvested > 0) kvRow(r++, 'Equity Stocks (Zerodha)',        inr(g.pureEquityInvested), P.purple);
  if (g.mfEquityInvested > 0)   kvRow(r++, 'MF Equity Funds (Coin)',         inr(g.mfEquityInvested),   P.tealDk);
  if (g.goldInvested > 0) {
    kvRow(r++, 'Gold — Total (ETF + MF)',             inr(g.goldInvested),       P.amber);
    if (g.eqGoldInvested > 0)   kvRow(r++, '  ↳ Gold ETF (Kite)',             inr(g.eqGoldInvested),     P.amber);
    if (g.mfGoldInvested > 0)   kvRow(r++, '  ↳ Gold MF (Coin)',              inr(g.mfGoldInvested),     P.amber);
  }
  if (g.silverInvested > 0) {
    kvRow(r++, 'Silver — Total (ETF + MF)',           inr(g.silverInvested),     P.silver);
    if (g.eqSilverInvested > 0) kvRow(r++, '  ↳ Silver ETF (Kite)',            inr(g.eqSilverInvested),   P.silver);
    if (g.mfSilverInvested > 0) kvRow(r++, '  ↳ Silver MF (Coin)',             inr(g.mfSilverInvested),   P.silver);
  }
  if (g.foreignInvested > 0) {
    kvRow(r++, 'Foreign Stocks — Total',              inr(g.foreignInvested),    P.teal);
    if (g.eqForeignInvested > 0) kvRow(r++, '  ↳ Zerodha Foreign ETF (Kite)', inr(g.eqForeignInvested),  P.teal);
    if (w.indmoneyInvested > 0) kvRow(r++, '  ↳ IND Money (US Stocks)',        inr(w.indmoneyInvested),   P.teal);
  }
  if (w.cryptoInvested > 0)     kvRow(r++, 'Crypto (CoinDCX)',                 inr(w.cryptoInvested),     P.orange);
  if (w.debtInvested > 0) {
    kvRow(r++, 'Debt — Total',                        inr(w.debtInvested),       P.violet);
    if (w.bondInvested ?? 0 > 0) kvRow(r++, '  ↳ Bonds (Stable Money)',        inr(w.bondInvested ?? 0),  P.violet);
    if (w.fdInvested ?? 0 > 0)   kvRow(r++, '  ↳ Fixed Deposit',               inr(w.fdInvested ?? 0),    P.violet);
  }
  if (w.pfInvested > 0)         kvRow(r++, 'Provident Fund (EPFO)',             inr(w.pfInvested),         P.green);
  if (w.bankTotal > 0)          kvRow(r++, 'Bank & Cash',                       inr(w.bankTotal),          P.slate);

  r++;
  kvRow(r++, 'Total Invested',  inr(totInv), P.gray600);
  kvRow(r++, 'Current Value',   inr(totCur), P.purpleDk);
  kvRow(r++, 'Total P&L',       inr(totPnl), totPnl >= 0 ? P.greenDk : P.redDk);
  if (totInv > 0) kvRow(r++, 'Overall Return', totPnl / totInv, totPnl >= 0 ? P.greenDk : P.redDk, '0.0%');

  // Move summary sheet to first position
  const sheets = (wb as unknown as { _worksheets: import('exceljs').Worksheet[] })._worksheets;
  if (sheets) {
    const idx = sheets.findIndex((s: import('exceljs').Worksheet) => s && s.name === '🏠 Summary Dashboard');
    if (idx > 1) {
      const [sheet] = sheets.splice(idx, 1);
      sheets.splice(1, 0, sheet);
    }
  }
}
