import { NextRequest, NextResponse } from 'next/server';
import { callKiteAPI } from '@/lib/kite';
import { getAuthUser, unauthorized } from '@/lib/auth-server';
import { isWealthUser } from '@/lib/users';
import { bucketEquity, bucketMF as bucketMFLib, round2 } from '@/lib/etf-buckets';

export const dynamic = 'force-dynamic';

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

// ETF symbol sets and MF classification are in lib/etf-buckets.ts (shared with zerodha-xlsx)

// ─── helpers ─────────────────────────────────────────────────────────────────

function sumBucket<T>(items: T[], predicate: (item: T) => boolean, inv: (i: T) => number, cur: (i: T) => number) {
  const filtered = items.filter(predicate);
  return {
    invested: round2(filtered.reduce((s, i) => s + inv(i), 0)),
    current:  round2(filtered.reduce((s, i) => s + cur(i), 0)),
  };
}

// ─── route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return unauthorized();
  const { user } = auth;
  if (!isWealthUser(user.email)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'equity';

  try {
    if (type === 'equity') {
      const raw = await callKiteAPI<KiteHolding[]>('/portfolio/holdings', user.id);

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
    const raw = await callKiteAPI<KiteMFHolding[]>('/mf/holdings', user.id);

    const enriched = raw.map((h) => ({
      symbol: h.tradingsymbol,
      fund:   h.fund,
      qty:    h.quantity,
      avg:    h.average_price,
      ltp:    h.last_price,
      inv:    h.average_price * h.quantity,
      cur:    h.last_price * h.quantity,
      bucket: bucketMFLib(h.fund),
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
    if (!isNotConnected) console.error('Kite API error:', err);
    return NextResponse.json(
      { success: false, error: isNotConnected ? msg : 'Kite API error' },
      { status: isNotConnected ? 401 : 500 },
    );
  }
}
