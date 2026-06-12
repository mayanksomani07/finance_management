import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createServerClient } from '@/lib/supabase-server';
import { isWealthUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

// CoinDCX Portfolio API
// Requires: COINDCX_API_KEY + COINDCX_API_SECRET in env
// Docs: https://docs.coindcx.com/

const COINDCX_BASE = 'https://api.coindcx.com';

interface CoinDCXBalance {
  currency: string;
  balance: string;
  locked_balance: string;
}

interface CoinDCXTicker {
  market: string;
  last_price: string;
}

interface CoinDCXTrade {
  id: number;
  side: 'buy' | 'sell';
  fee_amount: string;
  quantity: string;
  price: string;
  symbol: string;
  timestamp: number;
}

function sign(apiSecret: string, body: string) {
  return createHmac('sha256', apiSecret).update(body).digest('hex');
}

async function postAuth(apiKey: string, apiSecret: string, endpoint: string, extra: Record<string, unknown> = {}) {
  const timestamp = Date.now();
  const body = JSON.stringify({ timestamp, ...extra });
  const res = await fetch(`${COINDCX_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AUTH-APIKEY': apiKey,
      'X-AUTH-SIGNATURE': sign(apiSecret, body),
    },
    body,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`CoinDCX ${endpoint} → ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!isWealthUser(user.email)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const apiKey = process.env.COINDCX_API_KEY;
  const apiSecret = process.env.COINDCX_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({
      success: false,
      error: 'not_configured',
      message: 'Add COINDCX_API_KEY and COINDCX_API_SECRET to .env.local',
    });
  }

  try {
    // Fetch balances, tickers, and trade history in parallel
    const [balances, tickers, trades]: [CoinDCXBalance[], CoinDCXTicker[], CoinDCXTrade[]] = await Promise.all([
      postAuth(apiKey, apiSecret, '/exchange/v1/users/balances'),
      fetch(`${COINDCX_BASE}/exchange/ticker`, { cache: 'no-store' }).then((r) => r.json()),
      postAuth(apiKey, apiSecret, '/exchange/v1/orders/trade_history', { limit: 5000 }),
    ]);

    // Build INR price map from tickers
    const priceMap: Record<string, number> = { INR: 1 };
    for (const t of tickers) {
      if (t.market.endsWith('INR')) {
        priceMap[t.market.slice(0, -3)] = parseFloat(t.last_price);
      }
    }

    // Current holdings
    const nonZero = balances.filter((b) => parseFloat(b.balance) > 0 || parseFloat(b.locked_balance) > 0);
    const holdings = nonZero.map((b) => {
      const qty = parseFloat(b.balance) + parseFloat(b.locked_balance);
      const price = priceMap[b.currency] ?? 0;
      return { currency: b.currency, qty, price_inr: price, value_inr: qty * price };
    });
    const totalCurrentINR = holdings.reduce((s, h) => s + h.value_inr, 0);

    // Recent trade cost — CoinDCX API only returns recent trades, not full history.
    // Used as a reference hint in the UI only; not used for the invested total.
    let recentTradesCost = 0;
    for (const t of trades) {
      const cost = parseFloat(t.quantity) * parseFloat(t.price) + parseFloat(t.fee_amount);
      if (t.side === 'buy') recentTradesCost += cost;
      else recentTradesCost -= cost;
    }

    return NextResponse.json({
      success: true,
      current: parseFloat(totalCurrentINR.toFixed(2)),
      invested_breakdown: {
        from_trades: parseFloat(recentTradesCost.toFixed(2)),
        trade_count: trades.length,
        note: 'CoinDCX API only returns recent trades — full history unavailable',
      },
      holdings,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
