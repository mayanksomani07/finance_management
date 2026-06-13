import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAuthUser, unauthorized } from '@/lib/auth-server';
import { isWealthUser } from '@/lib/users';
import { isGoldETF, isSilverETF, isForeignETF, bucketMF, round2 } from '@/lib/etf-buckets';

export const dynamic = 'force-dynamic';

// Actual Zerodha XLSX column names (from console.zerodha.com Holdings download)
// Equity sheet:  Symbol | ISIN | Sector | Quantity | Available Quantity | Discrepant Quantity |
//                Long Term Quantity | Pledged (Margin) Quantity | Pledged (Loan) Quantity |
//                Average Price | Previous Closing Price | Unrealized P&L | Unrealized P&L Pct.
// MF sheet:      Symbol | ISIN | Instrument Type | Quantity | Available Quantity |
//                Discrepant Quantity | Pledged (Margin) Quantity | Pledged (Loan) Quantity |
//                Average Price | Previous Closing Price | Unrealized P&L | Unrealized P&L Pct.

const EXCLUDE_SYMBOLS = new Set(['1040SML26-F']);

function isGoldSilverETF(symbol: string, sector?: string): boolean {
  return isGoldETF(symbol, sector) || isSilverETF(symbol, sector);
}

// Wrapper: XLSX merges gold+silver into 'gold_silver' for backward-compat with the client
function classifyMF(instrumentType: string, fundName: string): 'equity' | 'gold_silver' | 'debt' {
  const bucket = bucketMF(fundName || instrumentType);
  if (bucket === 'gold' || bucket === 'silver') return 'gold_silver';
  if (bucket === 'debt') return 'debt';
  return 'equity';
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  return parseFloat(String(v).replace(/[₹,\s]/g, '')) || 0;
}

// Get column value by partial case-insensitive header match
function col(row: Record<string, unknown>, ...candidates: string[]): unknown {
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase().trim();
    for (const c of candidates) {
      if (k === c.toLowerCase() || k.startsWith(c.toLowerCase())) return row[key];
    }
  }
  return undefined;
}

interface Cat { invested: number; current: number; }
interface Result {
  equity: { equity: Cat; gold_silver: Cat; foreign_etf: Cat; total: Cat };
  mf: { equity: Cat; gold_silver: Cat; debt: Cat; total: Cat };
}

function emptyResult(): Result {
  const z = () => ({ invested: 0, current: 0 });
  return {
    equity: { equity: z(), gold_silver: z(), foreign_etf: z(), total: z() },
    mf: { equity: z(), gold_silver: z(), debt: z(), total: z() },
  };
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return unauthorized();
  if (!isWealthUser(auth.user.email)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large (max 10 MB)' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    // raw: true preserves string values and avoids XLSX auto-converting numbers with commas
    const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: false });

    const result = emptyResult();
    const debug: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      const nameLower = sheetName.toLowerCase().trim();

      // Skip combined sheet — it duplicates equity + MF data
      if (nameLower.includes('combined')) continue;

      // Zerodha XLSX has metadata rows at the top before the real column header row.
      // Find the row index that contains "Symbol" as the first non-empty cell.
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      let headerRowIndex = -1;
      for (let i = 0; i < rawRows.length; i++) {
        const r = rawRows[i] as unknown[];
        if (r.some((cell) => String(cell).trim().toLowerCase() === 'symbol')) {
          headerRowIndex = i;
          break;
        }
      }

      // Re-parse from the actual header row
      const rows = headerRowIndex >= 0
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', range: headerRowIndex })
        : XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      if (!rows.length) continue;

      const isEquity = nameLower.includes('equity') || nameLower === 'holdings';
      const isMF = nameLower.includes('mutual') || nameLower.includes('mf') || nameLower.includes('fund');

      debug.push(`Sheet: "${sheetName}" → equity=${isEquity} mf=${isMF} rows=${rows.length}`);

      if (!isEquity && !isMF) {
        // Fallback: detect by columns if sheet name doesn't match
        const firstRow = rows[0];
        const keys = Object.keys(firstRow).map((k) => k.toLowerCase());
        const hasInstrumentType = keys.some((k) => k.includes('instrument type'));
        const hasSector = keys.some((k) => k === 'sector');
        if (hasSector && !hasInstrumentType) {
          debug.push(`  → detected as Equity by columns`);
          processEquityRows(rows, result, debug);
        } else if (hasInstrumentType) {
          debug.push(`  → detected as MF by columns`);
          processMFRows(rows, result, debug);
        }
        continue;
      }

      if (isEquity) processEquityRows(rows, result, debug);
      else if (isMF) processMFRows(rows, result, debug);
    }

    // Round
    for (const cat of ['equity', 'gold_silver', 'foreign_etf', 'total'] as const) {
      result.equity[cat].invested = round2(result.equity[cat].invested);
      result.equity[cat].current = round2(result.equity[cat].current);
    }
    for (const cat of ['equity', 'gold_silver', 'debt', 'total'] as const) {
      result.mf[cat].invested = round2(result.mf[cat].invested);
      result.mf[cat].current = round2(result.mf[cat].current);
    }

    if (result.equity.total.invested === 0 && result.mf.total.invested === 0) {
      return NextResponse.json({
        success: false,
        error: `Could not parse holdings. Sheets found: [${workbook.SheetNames.join(', ')}]. Debug: ${debug.join(' | ')}`,
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('XLSX parse error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

function processEquityRows(rows: Record<string, unknown>[], result: Result, debug: string[]) {
  let count = 0;
  for (const row of rows) {
    const symbol = String(col(row, 'symbol', 'instrument') ?? '').trim();
    if (!symbol || EXCLUDE_SYMBOLS.has(symbol)) continue;

    const qty = parseNum(col(row, 'quantity'));
    if (qty === 0) continue;

    const avgPrice = parseNum(col(row, 'average price'));
    const closingPrice = parseNum(col(row, 'previous closing price', 'closing price', 'ltp'));
    const sector = String(col(row, 'sector') ?? '').trim();

    const invested = avgPrice * qty;
    const current = closingPrice * qty;
    if (invested === 0 && current === 0) continue;

    count++;
    if (isGoldSilverETF(symbol, sector)) {
      result.equity.gold_silver.invested += invested;
      result.equity.gold_silver.current += current;
    } else if (isForeignETF(symbol)) {
      result.equity.foreign_etf.invested += invested;
      result.equity.foreign_etf.current += current;
    } else {
      result.equity.equity.invested += invested;
      result.equity.equity.current += current;
    }
    result.equity.total.invested += invested;
    result.equity.total.current += current;
  }
  debug.push(`  Equity: parsed ${count} rows`);
}

function processMFRows(rows: Record<string, unknown>[], result: Result, debug: string[]) {
  let count = 0;
  for (const row of rows) {
    const symbol = String(col(row, 'symbol') ?? '').trim();
    if (!symbol) continue;

    const qty = parseNum(col(row, 'quantity'));
    if (qty === 0) continue;

    const avgPrice = parseNum(col(row, 'average price'));
    const closingPrice = parseNum(col(row, 'previous closing price', 'closing price', 'nav'));
    const instrumentType = String(col(row, 'instrument type') ?? '').trim();
    const fundName = String(col(row, 'fund name', 'scheme name', 'name', 'fund') ?? symbol).trim();

    const invested = avgPrice * qty;
    const current = closingPrice * qty;
    if (invested === 0 && current === 0) continue;

    count++;
    const category = classifyMF(instrumentType, fundName);
    result.mf[category].invested += invested;
    result.mf[category].current += current;
    result.mf.total.invested += invested;
    result.mf.total.current += current;
  }
  debug.push(`  MF: parsed ${count} rows`);
}
