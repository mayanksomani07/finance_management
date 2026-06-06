import { NextRequest, NextResponse } from 'next/server';
import { callKiteAPI } from '@/lib/kite';

interface KiteHolding {
  tradingsymbol: string;
  average_price: number;
  quantity: number;
  last_price: number;
  pnl: number;
  t1_quantity: number;
}

interface KiteMFHolding {
  tradingsymbol: string;
  fund: string;
  average_price: number;
  quantity: number;
  last_price: number;
  pnl: number;
}

// ─── Equity symbol sets ───────────────────────────────────────────────────────
// Gold ETFs traded on NSE/BSE (as of 2025 — exhaustive list)
const GOLD_ETF_SYMBOLS = new Set([
  // Nippon India
  'GOLDBEES',
  // SBI
  'SETFGOLD',
  // HDFC
  'HDFCMFGETF', 'HDFCGOLD',
  // ICICI Prudential
  'ICICIGOLD',
  // Kotak
  'KOTAKGOLD',
  // Axis
  'AXISGOLD',
  // Aditya Birla Sun Life
  'BSLGOLDETF',
  // UTI (GOLDETF is the live NSE symbol; GOLDIETF and GOLDSHARE are aliases)
  'GOLDETF', 'GOLDSHARE', 'GOLDIETF',
  // Quantum
  'QGOLDHALF',
  // Invesco
  'IVZINGOLD',
  // LIC MF
  'LICMFGOLD',
  // Mirae Asset
  'MIAETFGOLD',
  // DSP
  'DSPGOLDETF',
  // Tata
  'TATGOLDETF',
  // Edelweiss
  'EBBETFGOLD',
  // Bandhan (formerly IDFC)
  'BFNGOLDETF',
  // Motilal Oswal
  'MOGOLD',
  // Baroda BNP Paribas
  'BARODAGOLD',
  // HSBC
  'HSBCGOLDETF',
  // Union
  'UNIONGOLD',
  // 360 ONE (IIFL)
  '360GOLDETF',
  // Zerodha
  'ZGOLD',
  // Canara Robeco
  'CANRGOLD',
  // The Wealth Company (formerly PGIM)
  'TWCGOLDETF',
  // Choice
  'CHOICEGOLD',
  // NJ
  'NJGOLDETF',
  // WhiteOak
  'WOAETFGOLD',
]);

// Silver ETFs traded on NSE/BSE (as of 2025 — exhaustive list)
const SILVER_ETF_SYMBOLS = new Set([
  // Nippon India (SILVER is the live NSE symbol; SILVERBEES is the older/alternate name)
  'SILVER', 'SILVERBEES',
  // SBI
  'SETFSILVER',
  // HDFC
  'HDFCSILVER',
  // ICICI Prudential
  'ICICISILVE',
  // Kotak
  'KOTAKSILVE',
  // Axis
  'AXISILVER',
  // Mirae Asset
  'MASILVER',
  // DSP
  'DSPSILVETF',
  // UTI
  'SILVERIETF',
  // Aditya Birla Sun Life
  'BSLSILVETF',
  // Tata
  'TATSILVETF',
  // Motilal Oswal
  'MOSILVER',
  // Edelweiss
  'EBBSILVETF',
  // Invesco
  'IVZINSILVE',
  // Bandhan
  'BFNSILVETF',
  // Zerodha
  'ZSILVER',
]);

// Foreign/international ETFs traded on NSE/BSE (as of 2025 — exhaustive list)
const FOREIGN_ETF_SYMBOLS = new Set([
  // Motilal Oswal — Nasdaq 100
  'MON100',
  // Motilal Oswal — Nasdaq Q50 (next 50)
  'MONQ50',
  // Mirae Asset — NYSE FANG+
  'MAFANG',
  // Motilal Oswal — S&P 500
  'MAN50',
  // Mirae Asset — Hang Seng Tech
  'MAHKTECH',
  // Nippon India — Hang Seng BeES
  'HNGSNGBEES',
  // LIC MF — Nasdaq 100
  'LICNMID100',
  // Motilal Oswal S&P 500 Quality
  'MOQUALITY',
  // Motilal Oswal S&P 500 Value
  'MOVALUE',
  // Motilal Oswal S&P 500 Low Volatility
  'MOLOW',
  // Mirae Asset S&P 500 Top 50
  'MASETF50',
  // Kotak Nasdaq 100
  'KTNIFTY10',
  // HDFC Developed World Indexes FoF (ETF wrapper, if listed)
  'HDFCNIFTY',
  // Legacy / alternate symbols that may appear in older portfolios
  'NASDAQ100', 'N100', 'HANGSENG', 'HNGSNG',
]);

function bucketEquity(sym: string): 'gold' | 'silver' | 'foreign' | 'equity' {
  if (GOLD_ETF_SYMBOLS.has(sym))    return 'gold';
  if (SILVER_ETF_SYMBOLS.has(sym))  return 'silver';
  if (FOREIGN_ETF_SYMBOLS.has(sym)) return 'foreign';
  return 'equity';
}

// ─── MF fund name keyword rules ──────────────────────────────────────────────
// Ordered: more specific first. First match wins.
// These patterns match against the fund name as returned by Kite Coin (h.fund field).
const MF_BUCKET_RULES: Array<{ keywords: string[]; bucket: string }> = [
  // Silver (must be before GOLD to catch "Gold & Silver" funds — classify as gold)
  {
    keywords: ['SILVER ETF', 'SILVER FUND', 'SILVER FOF', 'SILVER SAVINGS'],
    bucket: 'silver',
  },
  // Gold — ETF FoF, Gold Savings Fund, Gold ETF Fund of Fund
  {
    keywords: [
      'GOLD ETF', 'GOLD FUND', 'GOLD SAVINGS', 'GOLD FOF',
      'GOLD EXCHANGE TRADED', 'GOLD BEES',
    ],
    bucket: 'gold',
  },
  // International / Foreign — US Fund, Nasdaq FoF, FANG FoF, S&P 500 FoF, etc.
  // Note: these are Fund-of-Funds invested in foreign ETFs — they are equity for our
  // purposes (not domestic equity, but still risk-on). Mark as 'foreign' bucket.
  {
    keywords: [
      'NASDAQ', 'FANG', 'S&P 500', 'SP500',
      'US FUND', 'US EQUITY', 'US TECHNOLOGY', 'US FLEXIBLE', 'US OPPORTUNITIES',
      ' US ', // catches "Franklin India Feeder - Franklin US Opportunities"
      'HANG SENG', 'GLOBAL FUND', 'GLOBAL EQUITY', 'INTERNATIONAL FUND',
      'INTERNATIONAL EQUITY', 'OVERSEAS FUND', 'OVERSEAS EQUITY',
      'WORLD FUND', 'WORLD EQUITY', 'FEEDER', 'GREATER CHINA', 'ASIA PACIFIC',
      'JAPAN FUND', 'EUROPE FUND', 'EMERGING MARKETS',
      'OPPORTUNITIES FUND', // e.g. "Franklin US Opportunities Fund"
    ],
    bucket: 'foreign',
  },
  // Debt — all sub-categories per SEBI classification
  {
    keywords: [
      'LIQUID', 'OVERNIGHT', 'ULTRA SHORT', 'LOW DURATION',
      'SHORT DURATION', 'SHORT TERM',
      'MEDIUM DURATION', 'MEDIUM TERM', 'MEDIUM TO LONG',
      'LONG DURATION', 'LONG TERM',
      'DYNAMIC BOND', 'CORPORATE BOND',
      'CREDIT RISK', 'CREDIT OPPORTUNITIES',
      'BANKING AND PSU', 'BANKING & PSU',
      'GILT', 'G-SEC', 'GSEC', 'GOVERNMENT SECURITIES',
      'CONSTANT DURATION', '10 YEAR',
      'FLOATER', 'FLOATING RATE',
      'MONEY MARKET', 'FIXED MATURITY', 'FMP',
      'DEBT FUND', 'INCOME FUND', 'BOND FUND',
    ],
    bucket: 'debt',
  },
  // Fallback — equity
  { keywords: [], bucket: 'equity' },
];

function bucketMF(fundName: string): 'gold' | 'silver' | 'debt' | 'foreign' | 'equity' {
  const upper = fundName.toUpperCase();
  for (const rule of MF_BUCKET_RULES) {
    if (rule.keywords.length === 0 || rule.keywords.some((k) => upper.includes(k))) {
      return rule.bucket as 'gold' | 'silver' | 'debt' | 'foreign' | 'equity';
    }
  }
  return 'equity';
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function round2(n: number) { return parseFloat(n.toFixed(2)); }

function sumBucket<T>(items: T[], predicate: (item: T) => boolean, inv: (i: T) => number, cur: (i: T) => number) {
  const filtered = items.filter(predicate);
  return {
    invested: round2(filtered.reduce((s, i) => s + inv(i), 0)),
    current:  round2(filtered.reduce((s, i) => s + cur(i), 0)),
  };
}

// ─── route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'equity';

  try {
    if (type === 'equity') {
      const raw = await callKiteAPI<KiteHolding[]>('/portfolio/holdings');

      const enriched = raw.map((h) => ({
        symbol: h.tradingsymbol,
        qty:    h.quantity + (h.t1_quantity ?? 0),
        avg:    h.average_price,
        ltp:    h.last_price,
        pnl:    h.pnl,
        inv:    h.average_price * (h.quantity + (h.t1_quantity ?? 0)),
        cur:    h.last_price * (h.quantity + (h.t1_quantity ?? 0)),
        bucket: bucketEquity(h.tradingsymbol),
      }));

      const total = {
        invested: round2(enriched.reduce((s, h) => s + h.inv, 0)),
        current:  round2(enriched.reduce((s, h) => s + h.cur, 0)),
      };

      return NextResponse.json({
        success: true,
        ...total,
        breakdown: {
          equity:  sumBucket(enriched, (h) => h.bucket === 'equity',  (h) => h.inv, (h) => h.cur),
          gold:    sumBucket(enriched, (h) => h.bucket === 'gold',    (h) => h.inv, (h) => h.cur),
          silver:  sumBucket(enriched, (h) => h.bucket === 'silver',  (h) => h.inv, (h) => h.cur),
          foreign: sumBucket(enriched, (h) => h.bucket === 'foreign', (h) => h.inv, (h) => h.cur),
        },
        holdings: enriched,
        fetched_at: new Date().toISOString(),
      });
    }

    // MF via Kite Coin
    const raw = await callKiteAPI<KiteMFHolding[]>('/mf/holdings');

    const enriched = raw.map((h) => ({
      symbol: h.tradingsymbol,
      fund:   h.fund,
      qty:    h.quantity,
      avg:    h.average_price,
      ltp:    h.last_price,
      inv:    h.average_price * h.quantity,
      cur:    h.last_price * h.quantity,
      bucket: bucketMF(h.fund),
    }));

    const total = {
      invested: round2(enriched.reduce((s, h) => s + h.inv, 0)),
      current:  round2(enriched.reduce((s, h) => s + h.cur, 0)),
    };

    return NextResponse.json({
      success: true,
      ...total,
      breakdown: {
        equity:  sumBucket(enriched, (h) => h.bucket === 'equity',  (h) => h.inv, (h) => h.cur),
        gold:    sumBucket(enriched, (h) => h.bucket === 'gold',    (h) => h.inv, (h) => h.cur),
        silver:  sumBucket(enriched, (h) => h.bucket === 'silver',  (h) => h.inv, (h) => h.cur),
        debt:    sumBucket(enriched, (h) => h.bucket === 'debt',    (h) => h.inv, (h) => h.cur),
        foreign: sumBucket(enriched, (h) => h.bucket === 'foreign', (h) => h.inv, (h) => h.cur),
      },
      holdings: enriched,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNotConnected = msg === 'not_connected' || msg === 'token_expired' || msg === 'not_configured';
    return NextResponse.json(
      { success: false, error: isNotConnected ? msg : `Kite API: ${msg}` },
      { status: isNotConnected ? 401 : 500 },
    );
  }
}
