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
}

export type ExportMode = 'transactions' | 'wealth' | 'both';

// ── Palette — ALL light backgrounds, no black/navy ─────────────────────────

const P = {
  // brand
  purple:     'FF6C63FF',
  purpleDk:   'FF4338CA',
  purplePale: 'FFEEF0FF',
  purpleMid:  'FFD5D3FF',
  // teal
  teal:       'FF00C9A7',
  tealDk:     'FF0A7A58',
  tealPale:   'FFD0FFF5',
  // amber
  amber:      'FFCA8A04',
  amberPale:  'FFFEF3C7',
  // red / expense
  red:        'FFE53935',
  redDk:      'FFC62828',
  redPale:    'FFFFF5F5',
  redMid:     'FFFECACA',
  // green / income
  green:      'FF15803D',
  greenDk:    'FF065F46',
  greenPale:  'FFF0FDF4',
  greenMid:   'FFBBF7D0',
  // orange
  orange:     'FFD97706',
  orangePale: 'FFFEF8EC',
  // violet
  violet:     'FF7C3AED',
  violetPale: 'FFF5F3FF',
  violetMid:  'FFEDE9FE',
  // slate
  slate:      'FF334155',
  slateLight: 'FF64748B',
  slatePale:  'FFF8FAFC',
  slateMid:   'FFE2E8F0',
  // neutrals
  white:      'FFFFFFFF',
  gray50:     'FFF9FAFB',
  gray100:    'FFF3F4F6',
  gray200:    'FFE5E7EB',
  gray400:    'FF9CA3AF',
  gray600:    'FF4B5563',
  gray800:    'FF1F2937',
  // category colours (text / dark enough to read on pale bg)
  need:       'FF1D4ED8',
  needPale:   'FFEFF6FF',
  needMid:    'FFBFDBFE',
  want:       'FFC2410C',
  wantPale:   'FFFFF7ED',
  wantMid:    'FFFED7AA',
  invest:     'FF6D28D9',
  investPale: 'FFF5F3FF',
  investMid:  'FFEDE9FE',
  income:     'FF065F46',
  incomePale: 'FFF0FDF4',
  incomeMid:  'FFBBF7D0',
};

// Hex colours for Chart.js (no ARGB prefix)
const CHART_COLORS = ['#6C63FF','#00C9A7','#CA8A04','#D97706','#7C3AED','#15803D','#64748B','#E53935'];
const CHART_PALE   = ['#EEF0FF','#D0FFF5','#FEF3C7','#FEF8EC','#F5F3FF','#F0FDF4','#F8FAFC','#FFF5F5'];

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

// ── Chart image generation (browser canvas → PNG base64) ──────────────────

async function renderChartPng(config: object, width = 600, height = 320): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);
  const ctx = canvas.getContext('2d')!;
  // white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chart = new Chart(ctx, config as any);
  // wait one frame for rendering
  await new Promise(r => setTimeout(r, 60));
  const png = canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
  chart.destroy();
  return png;
}

async function makePieChart(labels: string[], values: number[], title: string): Promise<string> {
  return renderChartPng({
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 12, family: 'Calibri' }, padding: 14, color: '#1F2937' },
        },
        title: {
          display: true,
          text: title,
          font: { size: 15, family: 'Calibri', weight: 'bold' },
          color: '#1F2937',
          padding: { bottom: 16 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: { label: string; parsed: number; dataset: { data: number[] } }) => {
              const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
              return ` ${ctx.label}: ${fmtShort(ctx.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  }, 640, 340);
}

async function makeBarChart(
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
        borderRadius: 6,
      })),
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 11, family: 'Calibri' }, color: '#1F2937' },
        },
        title: {
          display: true,
          text: title,
          font: { size: 15, family: 'Calibri', weight: 'bold' },
          color: '#1F2937',
          padding: { bottom: 12 },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 11, family: 'Calibri' }, color: '#4B5563' },
          grid: { color: '#F3F4F6' },
        },
        y: {
          ticks: {
            font: { size: 10, family: 'Calibri' }, color: '#4B5563',
            callback: (v: number) => fmtShort(v),
          },
          grid: { color: '#F3F4F6' },
        },
      },
    },
  }, 640, 340);
}

// ── Embed image helper ─────────────────────────────────────────────────────

async function embedImage(
  wb: import('exceljs').Workbook,
  ws: import('exceljs').Worksheet,
  base64: string,
  tl: { col: number; row: number },
  ext: { col: number; row: number },
) {
  const imgId = wb.addImage({ base64, extension: 'png' });
  ws.addImage(imgId, {
    tl: { col: tl.col, row: tl.row },
    ext: { width: 480, height: 260 },
  } as Parameters<typeof ws.addImage>[1]);
  // reserve row height for image area
  for (let r = tl.row + 1; r <= tl.row + ext.row; r++) {
    ws.getRow(r).height = 15;
  }
}

// ── Section header helper (light purple gradient) ──────────────────────────

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

// ── Main export ────────────────────────────────────────────────────────────

export async function exportToExcel(
  mode: ExportMode,
  transactions: LocalTransaction[],
  wealth: WealthSnapshot,
) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Finance Manager';
  wb.created  = new Date();

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

  const txs = [...raw].sort((a, b) => b.date.localeCompare(a.date)).map(enrichTx);
  const expenses = txs.filter(t => t.type === 'expense');
  const incomes  = txs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const net      = totalInc - totalExp;

  // ── Row 1: Title
  ws.mergeCells('A1:G1');
  const title = ws.getCell('A1');
  title.value     = '  Transaction Ledger';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  // ── Row 2: Stats strip
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

  // ── Row 3: Sub-header for chart note
  ws.mergeCells('A3:G3');
  const cn = ws.getCell('A3');
  cn.value     = '  📊 See "Category Breakdown" and "Monthly Trend" sheets for charts';
  cn.font      = font(false, 10, P.slateLight, true);
  cn.fill      = fill(P.gray50);
  cn.alignment = align('left', 'middle');
  ws.getRow(3).height = 18;

  // ── Row 4: Column headers
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

  // ── Data rows
  txs.forEach((t, idx) => {
    const row  = ws.getRow(idx + 5);
    row.height = 20;
    const even = idx % 2 === 0;
    const bg   = even ? P.gray50 : P.white;
    const cat  = CATEGORY_COLORS[t.mainCategory] ?? { text: P.slate, pale: P.slatePale, mid: P.slateMid };

    const cells: [string | number, string, string, EjAlign][] = [
      [t.date.slice(0, 10),                                    P.gray600,                   bg,        align('left', 'middle')],
      [t.type === 'income' ? '⬇ Income' : '⬆ Expense',       t.type === 'income' ? P.greenDk : P.redDk, t.type === 'income' ? P.greenPale : P.redPale, align('center', 'middle')],
      [t.mainCategory,                                         cat.text,                    cat.pale,  align('left', 'middle')],
      [t.subCategory,                                          P.gray600,                   bg,        align('left', 'middle')],
      [t.amount,                                               t.type === 'income' ? P.greenDk : P.redDk, bg, align('right', 'middle')],
      [t.comment || '—',                                       t.comment ? P.gray800 : P.gray400, bg,  align('left', 'middle')],
      [t.source === 'manual' ? '✍ Manual' : '📁 Excel',       P.slateLight,                P.slatePale, align('center', 'middle')],
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
// Sheet 2 — Category Breakdown + PIE CHART
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

  const txs     = raw.map(enrichTx);
  const expenses = txs.filter(t => t.type === 'expense');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);

  // Title
  ws.mergeCells('A1:F1');
  const title = ws.getCell('A1');
  title.value     = '  Spending by Category';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  // Subtitle
  ws.mergeCells('A2:F2');
  const sub = ws.getCell('A2');
  sub.value     = `  Total expenses: ${inr(totalExp)}  ·  ${expenses.length} transactions`;
  sub.font      = font(false, 11, P.purpleDk, true);
  sub.fill      = fill(P.purplePale);
  sub.alignment = align('left', 'middle');
  ws.getRow(2).height = 20;

  // ── Generate pie charts before writing data ──
  // Main category pie
  const mainAgg: Record<string, number> = {};
  for (const t of expenses) mainAgg[t.mainCategory] = (mainAgg[t.mainCategory] ?? 0) + t.amount;
  const mainLabels = Object.keys(mainAgg);
  const mainVals   = mainLabels.map(k => mainAgg[k]);

  // Sub-category pie (top 8)
  const subAgg: Record<string, number> = {};
  for (const t of expenses) subAgg[t.subCategory] = (subAgg[t.subCategory] ?? 0) + t.amount;
  const subEntries = Object.entries(subAgg).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const [piePng1, piePng2] = await Promise.all([
    makePieChart(mainLabels, mainVals, 'Spending by Main Category'),
    makePieChart(subEntries.map(e => e[0]), subEntries.map(e => e[1]), 'Top Sub-Categories'),
  ]);

  // Reserve rows 3..19 for charts (two side by side)
  // Chart 1: cols A-C, rows 3-19
  // Chart 2: cols D-F, rows 3-19
  for (let r = 3; r <= 21; r++) ws.getRow(r).height = 14;
  ws.getRow(3).height = 8; // small gap above charts

  const imgId1 = wb.addImage({ base64: piePng1, extension: 'png' });
  const imgId2 = wb.addImage({ base64: piePng2, extension: 'png' });
  ws.addImage(imgId1, { tl: { col: 0, row: 3 }, ext: { width: 340, height: 240 } } as Parameters<typeof ws.addImage>[1]);
  ws.addImage(imgId2, { tl: { col: 3, row: 3 }, ext: { width: 340, height: 240 } } as Parameters<typeof ws.addImage>[1]);

  // Headers at row 22
  const hRow = ws.getRow(22);
  hRow.height = 24;
  ['Category', 'Sub-Category', 'Count', 'Total Spent', 'Avg / Txn', '% of Total'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.font      = font(true, 11, P.white);
    c.fill      = fill(P.purpleDk);
    c.alignment = align(i >= 2 ? 'center' : 'left', 'middle');
    c.border    = border(P.purple);
  });

  // Data
  let rowIdx = 23;
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
    const mCount   = Object.values(subs).reduce((s, v) => s + v.count, 0);

    // Main row
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

    // Sub rows
    Object.entries(subs).sort((a, b) => b[1].total - a[1].total).forEach(([sub, { count, total }]) => {
      const sr = ws.getRow(rowIdx++);
      sr.height = 20;

      const sc1 = sr.getCell(1);
      sc1.value = ''; sc1.fill = fill(P.white); sc1.border = borderBottom();

      const sc2 = sr.getCell(2);
      sc2.value     = `    · ${sub}`;
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

    // Spacer
    const sp = ws.getRow(rowIdx++);
    sp.height = 8;
  }

  ws.autoFilter = { from: 'A22', to: 'F22' };
}

// ══════════════════════════════════════════════════════════════════════════════
// Sheet 3 — Monthly Trend + BAR CHART
// ══════════════════════════════════════════════════════════════════════════════

async function buildMonthlySheet(wb: import('exceljs').Workbook, raw: LocalTransaction[]) {
  const ws = wb.addWorksheet('📅 Monthly Trend', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 20 }],
  });

  ws.columns = [
    { key: 'month',    width: 18 },
    { key: 'income',   width: 16 },
    { key: 'expense',  width: 16 },
    { key: 'net',      width: 16 },
    { key: 'savings',  width: 14 },
  ];

  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const t of raw) {
    const mo = t.date.slice(0, 7);
    if (!byMonth[mo]) byMonth[mo] = { income: 0, expense: 0 };
    if (t.type === 'income')  byMonth[mo].income  += t.amount;
    if (t.type === 'expense') byMonth[mo].expense += t.amount;
  }
  const months = Object.keys(byMonth).sort();

  // Title
  ws.mergeCells('A1:E1');
  const title = ws.getCell('A1');
  title.value     = '  Monthly Income vs Expense Trend';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  // ── Generate bar chart
  const moLabels = months.map(mo => {
    const [y, m] = mo.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
  });
  const barPng = await makeBarChart(
    moLabels,
    [
      { label: 'Income',  data: months.map(m => byMonth[m].income),  color: '#15803D' },
      { label: 'Expense', data: months.map(m => byMonth[m].expense), color: '#E53935' },
      { label: 'Net',     data: months.map(m => byMonth[m].income - byMonth[m].expense), color: '#6C63FF' },
    ],
    'Monthly Income vs Expense',
  );

  // Reserve rows 2-18 for chart
  for (let r = 2; r <= 18; r++) ws.getRow(r).height = 15;
  ws.addImage(wb.addImage({ base64: barPng, extension: 'png' }), {
    tl: { col: 0, row: 1 }, ext: { width: 600, height: 280 },
  } as Parameters<typeof ws.addImage>[1]);

  // Stats strip row 19
  ws.mergeCells('A19:B19');
  ws.mergeCells('C19:D19');
  ws.getRow(19).height = 26;

  const avgInc = months.reduce((s, m) => s + byMonth[m].income, 0) / (months.length || 1);
  const avgExp = months.reduce((s, m) => s + byMonth[m].expense, 0) / (months.length || 1);

  [['A19', '📅 Months', String(months.length), P.purpleDk, P.purplePale, P.purpleMid],
   ['C19', '⬇ Avg Income', inr(avgInc), P.greenDk, P.greenPale, P.greenMid],
   ['E19', '⬆ Avg Expense', inr(avgExp), P.redDk, P.redPale, P.redMid]].forEach(([addr, lbl, val, tc, pale, mid]) => {
    const c = ws.getCell(addr as string);
    c.value     = `${lbl}  ${val}`;
    c.font      = font(true, 10, tc as string);
    c.fill      = fill(pale as string);
    c.alignment = align('center', 'middle');
    c.border    = borderBottom(mid as string);
  });

  // Headers row 20
  const hRow = ws.getRow(20);
  hRow.height = 24;
  ['Month', 'Income', 'Expense', 'Net Savings', 'Savings %'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.font      = font(true, 11, P.white);
    c.fill      = fill(P.purpleDk);
    c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
    c.border    = border(P.purple);
  });

  // Data rows
  months.forEach(({ }, idx) => {
    const mo   = months[idx];
    const { income, expense } = byMonth[mo];
    const net  = income - expense;
    const pct  = income > 0 ? net / income : 0;
    const row  = ws.getRow(idx + 21);
    row.height = 22;
    const even = idx % 2 === 0;
    const bg   = even ? P.gray50 : P.white;

    const [y, m] = mo.split('-');
    const moLabel = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const vals: [string | number, string, string, string][] = [
      [moLabel,  P.gray800,                             bg,            ''],
      [income,   P.greenDk,                             P.greenPale,   '₹#,##0'],
      [expense,  P.redDk,                               P.redPale,     '₹#,##0'],
      [net,      net >= 0 ? P.greenDk : P.redDk,        net >= 0 ? P.greenPale : P.redPale, '₹#,##0'],
      [pct,      pct >= 0.2 ? P.greenDk : pct >= 0 ? P.amber : P.redDk, bg, '0.0%'],
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

  // Totals
  if (months.length > 0) {
    const totInc = months.reduce((s, m) => s + byMonth[m].income, 0);
    const totExp = months.reduce((s, m) => s + byMonth[m].expense, 0);
    const totNet = totInc - totExp;
    const tRow   = ws.getRow(months.length + 21);
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
// ══════════════════════════════════════════════════════════════════════════════

async function buildWealthSheet(wb: import('exceljs').Workbook, w: WealthSnapshot) {
  const ws = wb.addWorksheet('💎 Wealth Overview', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }],
  });

  ws.columns = [
    { key: 'label',    width: 28 },
    { key: 'invested', width: 18 },
    { key: 'current',  width: 18 },
    { key: 'pnl',      width: 18 },
    { key: 'pct',      width: 14 },
  ];

  // Title
  ws.mergeCells('A1:E1');
  const title = ws.getCell('A1');
  title.value     = '  Wealth & Net Worth Snapshot';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  // Net Worth row
  ws.mergeCells('A2:B2');
  ws.mergeCells('C2:D2');
  ws.getRow(2).height = 30;

  [['A2', `🏦 Assets  ${fmtShort(w.totalAssets)}`,      P.greenDk, P.greenMid],
   ['C2', `💳 Liab  ${fmtShort(w.totalLiabilities)}`,  P.redDk,   P.redMid],
   ['E2', `✦ Net Worth  ${fmtShort(w.netWorth)}`,       w.netWorth >= 0 ? P.purpleDk : P.redDk, w.netWorth >= 0 ? P.purpleMid : P.redMid]].forEach(([addr, val, tc, pale]) => {
    const c = ws.getCell(addr as string);
    c.value     = val;
    c.font      = font(true, 13, tc as string);
    c.fill      = fill(pale as string);
    c.alignment = align('center', 'middle');
    c.border    = border(tc + '60' as string);
  });

  // Column headers row 3
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

  const assetDefs = [
    { label: 'Stocks (Kite)',  inv: w.eqTotalInvested,  cur: w.eqTotalCurrent,  color: P.purple,  pale: P.purplePale },
    { label: 'Mutual Funds',  inv: w.mfTotalInvested,  cur: w.mfTotalCurrent,  color: P.teal,    pale: P.tealPale   },
    { label: 'US Stocks',     inv: w.indmoneyInvested, cur: w.indmoneyCurrent, color: P.amber,   pale: P.amberPale  },
    { label: 'Crypto',        inv: w.cryptoInvested,   cur: w.cryptoCurrent,   color: P.orange,  pale: P.orangePale },
    { label: 'Debt',          inv: w.debtInvested,     cur: w.debtCurrent,     color: P.violet,  pale: P.violetPale },
    { label: 'PF',            inv: w.pfInvested,       cur: w.pfCurrent,       color: P.green,   pale: P.greenPale  },
    { label: 'Bank & Cash',   inv: w.bankTotal,        cur: w.bankTotal,       color: P.slate,   pale: P.slatePale  },
  ];

  let r = 4;
  for (const a of assetDefs) {
    if (a.cur === 0 && a.inv === 0) continue;
    const row  = ws.getRow(r++);
    row.height = 22;
    const pnl  = a.cur - a.inv;
    const pct  = pnlPct(a.inv, a.cur);

    const lc = row.getCell(1);
    lc.value     = a.label;
    lc.font      = font(true, 11, a.color);
    lc.fill      = fill(a.pale);
    lc.alignment = align('left', 'middle');
    lc.border    = borderBottom(a.color + '60');

    [[a.inv, P.gray600, a.pale, '₹#,##0'], [a.cur, a.color, a.pale, '₹#,##0'],
     [pnl, pnl >= 0 ? P.greenDk : P.redDk, pnl >= 0 ? P.greenPale : P.redPale, '₹#,##0'],
     [pct / 100, pct >= 0 ? P.greenDk : P.redDk, a.pale, '+0.00%;-0.00%']].forEach(([val, clr, bg, fmt], ci) => {
      const c = row.getCell(ci + 2);
      c.value     = val as number;
      c.numFmt    = fmt as string;
      c.font      = font(ci === 1 || ci === 2 || ci === 3, 11, clr as string);
      c.fill      = fill(bg as string);
      c.alignment = align('center', 'middle');
      c.border    = borderBottom();
    });
  }

  // Grand total
  const totInv = assetDefs.reduce((s, a) => s + a.inv, 0);
  const totCur = assetDefs.reduce((s, a) => s + a.cur, 0);
  const totPnl = totCur - totInv;
  const totPct = pnlPct(totInv, totCur);
  const totRow = ws.getRow(r++);
  totRow.height = 26;
  [['TOTAL', P.purpleDk, P.purpleMid, ''], [totInv, P.gray600, P.purplePale, '₹#,##0'],
   [totCur, P.purpleDk, P.purplePale, '₹#,##0'], [totPnl, totPnl >= 0 ? P.greenDk : P.redDk, totPnl >= 0 ? P.greenPale : P.redPale, '₹#,##0'],
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
    views: [{ state: 'frozen', xSplit: 0, ySplit: 21 }],
  });

  ws.columns = [
    { key: 'asset',    width: 22 },
    { key: 'value',    width: 18 },
    { key: 'pct',      width: 14 },
    { key: 'invested', width: 18 },
    { key: 'pnl',      width: 18 },
  ];

  const slices = [
    { name: 'Stocks (Kite)', cur: w.eqTotalCurrent,  inv: w.eqTotalInvested,  color: CHART_COLORS[0], pale: CHART_PALE[0] },
    { name: 'Mutual Funds',  cur: w.mfTotalCurrent,  inv: w.mfTotalInvested,  color: CHART_COLORS[1], pale: CHART_PALE[1] },
    { name: 'US Stocks',     cur: w.indmoneyCurrent, inv: w.indmoneyInvested, color: CHART_COLORS[2], pale: CHART_PALE[2] },
    { name: 'Crypto',        cur: w.cryptoCurrent,   inv: w.cryptoInvested,   color: CHART_COLORS[3], pale: CHART_PALE[3] },
    { name: 'Debt',          cur: w.debtCurrent,     inv: w.debtInvested,     color: CHART_COLORS[4], pale: CHART_PALE[4] },
    { name: 'PF',            cur: w.pfCurrent,       inv: w.pfInvested,       color: CHART_COLORS[5], pale: CHART_PALE[5] },
    { name: 'Bank & Cash',   cur: w.bankTotal,       inv: w.bankTotal,        color: CHART_COLORS[6], pale: CHART_PALE[6] },
  ].filter(s => s.cur > 0);

  const totalCur = slices.reduce((s, x) => s + x.cur, 0);

  // Title
  ws.mergeCells('A1:E1');
  const title = ws.getCell('A1');
  title.value     = '  Asset Allocation & Portfolio Mix';
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  // ── Generate charts
  const [piePng, barPng] = await Promise.all([
    makePieChart(slices.map(s => s.name), slices.map(s => s.cur), 'Portfolio Allocation'),
    makeBarChart(
      slices.map(s => s.name),
      [
        { label: 'Invested', data: slices.map(s => s.inv), color: '#6C63FF' },
        { label: 'Current',  data: slices.map(s => s.cur), color: '#00C9A7' },
      ],
      'Invested vs Current Value (P&L)',
    ),
  ]);

  // Reserve rows 2-10 for pie, cols A-C
  // Reserve rows 2-10 for bar, cols D-E+
  for (let r = 2; r <= 19; r++) ws.getRow(r).height = 14;

  ws.addImage(wb.addImage({ base64: piePng, extension: 'png' }), {
    tl: { col: 0, row: 1 }, ext: { width: 360, height: 260 },
  } as Parameters<typeof ws.addImage>[1]);

  ws.addImage(wb.addImage({ base64: barPng, extension: 'png' }), {
    tl: { col: 3, row: 1 }, ext: { width: 360, height: 260 },
  } as Parameters<typeof ws.addImage>[1]);

  // Headers at row 20
  const hRow = ws.getRow(20);
  hRow.height = 24;
  ['Asset Class', 'Current Value', 'Allocation %', 'Invested', 'P&L'].forEach((h, i) => {
    const c = hRow.getCell(i + 1);
    c.value     = h;
    c.font      = font(true, 11, P.white);
    c.fill      = fill(P.purpleDk);
    c.alignment = align(i === 0 ? 'left' : 'center', 'middle');
    c.border    = border(P.purple);
  });

  slices.sort((a, b) => b.cur - a.cur).forEach((s, idx) => {
    const pct = (s.cur / totalCur) * 100;
    const pnl = s.cur - s.inv;
    const row = ws.getRow(idx + 21);
    row.height = 24;

    const colorHex = s.color.replace('#', 'FF');
    const palHex   = s.pale.replace('#', 'FF');

    [[s.name, colorHex, palHex, ''], [s.cur, colorHex, palHex, '₹#,##0'],
     [pct / 100, colorHex, palHex, '0.0%'], [s.inv, P.gray600, P.gray50, '₹#,##0'],
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

  // Total
  const totPnl = slices.reduce((s, x) => s + (x.cur - x.inv), 0);
  const totInv = slices.reduce((s, x) => s + x.inv, 0);
  const tRow   = ws.getRow(slices.length + 21);
  tRow.height  = 26;
  [['TOTAL', P.purpleDk, P.purpleMid, ''], [totalCur, P.purpleDk, P.purplePale, '₹#,##0'],
   [1, P.purpleDk, P.purplePale, '0.0%'], [totInv, P.gray600, P.purplePale, '₹#,##0'],
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

  const txs     = raw.map(enrichTx);
  const expenses = txs.filter(t => t.type === 'expense');
  const incomes  = txs.filter(t => t.type === 'income');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0);
  const net      = totalInc - totalExp;

  // Title
  ws.mergeCells('A1:D1');
  const title = ws.getCell('A1');
  title.value     = `  Personal Finance Dashboard  ·  ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  title.font      = font(true, 18, P.purpleDk);
  title.fill      = fill(P.purplePale);
  title.alignment = align('left', 'middle');
  title.border    = borderBottom(P.purple);
  ws.getRow(1).height = 40;

  // ── Generate summary charts
  // Pie: category breakdown
  const catAgg: Record<string, number> = {};
  for (const t of expenses) catAgg[t.mainCategory] = (catAgg[t.mainCategory] ?? 0) + t.amount;
  const catLabels = Object.keys(catAgg);
  const catVals   = catLabels.map(k => catAgg[k]);

  // Pie: wealth allocation
  const wealthSlices = [
    { name: 'Stocks', val: w.eqTotalCurrent },
    { name: 'MF',     val: w.mfTotalCurrent },
    { name: 'US',     val: w.indmoneyCurrent },
    { name: 'Crypto', val: w.cryptoCurrent },
    { name: 'Debt',   val: w.debtCurrent },
    { name: 'PF',     val: w.pfCurrent },
    { name: 'Bank',   val: w.bankTotal },
  ].filter(s => s.val > 0);

  const [expPie, wealthPie] = await Promise.all([
    makePieChart(catLabels, catVals, 'Expense Categories'),
    makePieChart(wealthSlices.map(s => s.name), wealthSlices.map(s => s.val), 'Wealth Allocation'),
  ]);

  // Charts in rows 2-20, side by side
  for (let r = 2; r <= 20; r++) ws.getRow(r).height = 14;
  ws.addImage(wb.addImage({ base64: expPie,    extension: 'png' }), { tl: { col: 0, row: 1 }, ext: { width: 320, height: 260 } } as Parameters<typeof ws.addImage>[1]);
  ws.addImage(wb.addImage({ base64: wealthPie, extension: 'png' }), { tl: { col: 2, row: 1 }, ext: { width: 320, height: 260 } } as Parameters<typeof ws.addImage>[1]);

  let r = 21;

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

  const totInv = w.eqTotalInvested + w.mfTotalInvested + w.indmoneyInvested + w.cryptoInvested + w.debtInvested + w.pfInvested;
  const totCur = w.eqTotalCurrent  + w.mfTotalCurrent  + w.indmoneyCurrent  + w.cryptoCurrent  + w.debtCurrent  + w.pfCurrent;
  const totPnl = totCur - totInv;
  kvRow(r++, 'Total Invested',  inr(totInv), P.gray600);
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
