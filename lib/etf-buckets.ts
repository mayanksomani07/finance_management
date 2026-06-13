// ─── ETF symbol sets ──────────────────────────────────────────────────────────
// Single source of truth shared by zerodha/route.ts and zerodha-xlsx/route.ts

// Gold ETFs traded on NSE/BSE (exhaustive, 2025)
export const GOLD_ETF_SYMBOLS = new Set([
  'GOLDBEES', 'SETFGOLD', 'HDFCMFGETF', 'HDFCGOLD', 'ICICIGOLD', 'KOTAKGOLD',
  'AXISGOLD', 'BSLGOLDETF', 'GOLDETF', 'GOLDSHARE', 'GOLDIETF', 'QGOLDHALF',
  'IVZINGOLD', 'LICMFGOLD', 'MIAETFGOLD', 'DSPGOLDETF', 'TATGOLDETF', 'EBBETFGOLD',
  'BFNGOLDETF', 'MOGOLD', 'BARODAGOLD', 'HSBCGOLDETF', 'UNIONGOLD', '360GOLDETF',
  'ZGOLD', 'CANRGOLD', 'TWCGOLDETF', 'CHOICEGOLD', 'NJGOLDETF', 'WOAETFGOLD',
]);

// Silver ETFs traded on NSE/BSE (exhaustive, 2025)
export const SILVER_ETF_SYMBOLS = new Set([
  'SILVER', 'SILVERBEES', 'SETFSILVER', 'HDFCSILVER', 'ICICISILVE', 'KOTAKSILVE',
  'AXISILVER', 'MASILVER', 'DSPSILVETF', 'SILVERIETF', 'BSLSILVETF', 'TATSILVETF',
  'MOSILVER', 'EBBSILVETF', 'IVZINSILVE', 'BFNSILVETF', 'ZSILVER',
]);

// Foreign/international ETFs traded on NSE/BSE (exhaustive, 2025)
export const FOREIGN_ETF_SYMBOLS = new Set([
  'MON100', 'MONQ50', 'MAFANG', 'MAN50', 'MAHKTECH', 'HNGSNGBEES',
  'LICNMID100', 'MOQUALITY', 'MOVALUE', 'MOLOW', 'MASETF50', 'KTNIFTY10',
  'HDFCNIFTY', 'NASDAQ100', 'N100', 'HANGSENG', 'HNGSNG',
]);

export function isForeignETF(symbol: string): boolean {
  const s = symbol.toUpperCase();
  if (FOREIGN_ETF_SYMBOLS.has(s)) return true;
  return (
    s.includes('MON100') || s.includes('MAFANG') || s.includes('MONQ50') ||
    s.includes('NASDAQ') || s.includes('HNGSNG') || s.includes('MAHKTECH') ||
    s.includes('LICNMID') || s.includes('MASETF')
  );
}

export function isGoldETF(symbol: string, sector?: string): boolean {
  const s = symbol.toUpperCase();
  const sec = (sector ?? '').toUpperCase();
  if (GOLD_ETF_SYMBOLS.has(s)) return true;
  return (s.includes('GOLD') || sec.includes('GOLD')) && !isForeignETF(symbol);
}

export function isSilverETF(symbol: string, sector?: string): boolean {
  const s = symbol.toUpperCase();
  const sec = (sector ?? '').toUpperCase();
  if (SILVER_ETF_SYMBOLS.has(s)) return true;
  return (s.includes('SILVER') || sec.includes('SILVER')) && !isForeignETF(symbol);
}

export function bucketEquity(symbol: string): 'gold' | 'silver' | 'foreign' | 'equity' {
  if (GOLD_ETF_SYMBOLS.has(symbol))    return 'gold';
  if (SILVER_ETF_SYMBOLS.has(symbol))  return 'silver';
  if (FOREIGN_ETF_SYMBOLS.has(symbol)) return 'foreign';
  if (isGoldETF(symbol))   return 'gold';
  if (isSilverETF(symbol)) return 'silver';
  if (isForeignETF(symbol)) return 'foreign';
  return 'equity';
}

// ─── MF fund name keyword rules ───────────────────────────────────────────────
// Ordered: more specific first. First match wins.
const MF_BUCKET_RULES: Array<{ keywords: string[]; bucket: string }> = [
  {
    keywords: ['SILVER ETF', 'SILVER FUND', 'SILVER FOF', 'SILVER SAVINGS'],
    bucket: 'silver',
  },
  {
    keywords: [
      'GOLD ETF', 'GOLD FUND', 'GOLD SAVINGS', 'GOLD FOF',
      'GOLD EXCHANGE TRADED', 'GOLD BEES',
    ],
    bucket: 'gold',
  },
  {
    keywords: [
      'NASDAQ', 'FANG', 'S&P 500', 'SP500',
      'US FUND', 'US EQUITY', 'US TECHNOLOGY', 'US FLEXIBLE', 'US OPPORTUNITIES',
      ' US ', 'HANG SENG', 'GLOBAL FUND', 'GLOBAL EQUITY', 'INTERNATIONAL FUND',
      'INTERNATIONAL EQUITY', 'OVERSEAS FUND', 'OVERSEAS EQUITY',
      'WORLD FUND', 'WORLD EQUITY', 'FEEDER', 'GREATER CHINA', 'ASIA PACIFIC',
      'JAPAN FUND', 'EUROPE FUND', 'EMERGING MARKETS', 'OPPORTUNITIES FUND',
    ],
    bucket: 'foreign',
  },
  {
    keywords: [
      'LIQUID', 'OVERNIGHT', 'ULTRA SHORT', 'LOW DURATION',
      'SHORT DURATION', 'SHORT TERM', 'MEDIUM DURATION', 'MEDIUM TERM',
      'MEDIUM TO LONG', 'LONG DURATION', 'LONG TERM', 'DYNAMIC BOND',
      'CORPORATE BOND', 'CREDIT RISK', 'CREDIT OPPORTUNITIES',
      'BANKING AND PSU', 'BANKING & PSU', 'GILT', 'G-SEC', 'GSEC',
      'GOVERNMENT SECURITIES', 'CONSTANT DURATION', '10 YEAR',
      'FLOATER', 'FLOATING RATE', 'MONEY MARKET', 'FIXED MATURITY', 'FMP',
      'DEBT FUND', 'INCOME FUND', 'BOND FUND',
    ],
    bucket: 'debt',
  },
  { keywords: [], bucket: 'equity' },
];

/**
 * Classify a MF fund name into a bucket.
 * Returns 'gold' | 'silver' | 'debt' | 'foreign' | 'equity'.
 * Note: zerodha-xlsx/route.ts merges gold+silver into 'gold_silver' for
 * backward-compat — do that mapping at call site.
 */
export function bucketMF(fundName: string): 'gold' | 'silver' | 'debt' | 'foreign' | 'equity' {
  const upper = fundName.toUpperCase();
  for (const rule of MF_BUCKET_RULES) {
    if (rule.keywords.length === 0 || rule.keywords.some(k => upper.includes(k))) {
      return rule.bucket as 'gold' | 'silver' | 'debt' | 'foreign' | 'equity';
    }
  }
  return 'equity';
}

export function round2(n: number): number { return parseFloat(n.toFixed(2)); }
