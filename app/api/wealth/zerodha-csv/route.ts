import { NextRequest, NextResponse } from 'next/server';

// Parse Zerodha Console holdings CSV export
// Download from: console.zerodha.com → Portfolio → Holdings → Download
// Also handles Zerodha Coin MF statement CSV

interface ParsedHolding {
  symbol: string;
  qty: number;
  avg_cost: number;
  ltp?: number;
  invested: number;
  current?: number;
  type: 'equity' | 'mf';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const csvType = (formData.get('csv_type') as string) ?? 'equity';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV appears empty' }, { status: 400 });
    }

    // Detect CSV type from headers
    const header = lines[0].toLowerCase();
    const isMF = header.includes('fund') || header.includes('folio') || csvType === 'mf';

    const holdings: ParsedHolding[] = [];

    if (isMF) {
      // Zerodha Coin MF CSV format:
      // Fund,Folio,Units,Nav,Invested Value,Current Value,P&L
      const colIdx = parseHeader(lines[0], ['fund', 'units', 'nav', 'invested', 'current']);
      for (const line of lines.slice(1)) {
        const cols = splitCSV(line);
        if (cols.length < 4) continue;
        const symbol = cols[colIdx.fund ?? 0]?.replace(/"/g, '').trim();
        const qty = parseNum(cols[colIdx.units ?? 2]);
        const nav = parseNum(cols[colIdx.nav ?? 3]);
        const invested = parseNum(cols[colIdx.invested ?? 4]);
        const current = parseNum(cols[colIdx.current ?? 5]);
        if (!symbol || qty === 0) continue;
        holdings.push({ symbol, qty, avg_cost: invested / qty, ltp: nav, invested, current, type: 'mf' });
      }
    } else {
      // Zerodha Console Holdings CSV format:
      // Instrument,Qty,Avg cost,LTP,Cur val,P&L,Net chg,Day chg
      const colIdx = parseHeader(lines[0], ['instrument', 'qty', 'avg', 'ltp', 'cur val', 'p&l']);
      for (const line of lines.slice(1)) {
        const cols = splitCSV(line);
        if (cols.length < 3) continue;
        const symbol = cols[colIdx.instrument ?? 0]?.replace(/"/g, '').trim();
        const qty = parseNum(cols[colIdx.qty ?? 1]);
        const avgCost = parseNum(cols[colIdx.avg ?? 2]);
        const ltp = parseNum(cols[colIdx.ltp ?? 3]);
        const curVal = parseNum(cols[colIdx['cur val'] ?? 4]);
        if (!symbol || qty === 0) continue;
        const invested = avgCost * qty;
        holdings.push({ symbol, qty, avg_cost: avgCost, ltp, invested, current: curVal || ltp * qty, type: 'equity' });
      }
    }

    const totalInvested = holdings.reduce((s, h) => s + h.invested, 0);
    const totalCurrent = holdings.reduce((s, h) => s + (h.current ?? h.invested), 0);

    return NextResponse.json({
      success: true,
      type: isMF ? 'mf' : 'equity',
      invested: parseFloat(totalInvested.toFixed(2)),
      current: parseFloat(totalCurrent.toFixed(2)),
      holdings_count: holdings.length,
      holdings: holdings.slice(0, 50), // cap for response size
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

function parseHeader(headerLine: string, keys: string[]): Record<string, number> {
  const cols = splitCSV(headerLine).map((c) => c.toLowerCase().replace(/"/g, '').trim());
  const result: Record<string, number> = {};
  for (const key of keys) {
    const idx = cols.findIndex((c) => c.includes(key));
    if (idx >= 0) result[key] = idx;
  }
  return result;
}

function splitCSV(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[₹,\s]/g, '')) || 0;
}
