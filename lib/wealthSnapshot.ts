import type { WealthSnapshot } from './exportExcel';

export async function fetchWealthSnapshot(): Promise<WealthSnapshot> {
  const [manualRes, equityRes, mfRes, cryptoRes, indmoneyRes] = await Promise.allSettled([
    fetch('/api/wealth/manual').then(r => r.json()),
    fetch('/api/wealth/zerodha?type=equity').then(r => r.json()),
    fetch('/api/wealth/zerodha?type=mf').then(r => r.json()),
    fetch('/api/wealth/coindcx').then(r => r.json()),
    fetch('/api/wealth/indmoney').then(r => r.json()),
  ]);

  const manual: Record<string, { value: number }> =
    manualRes.status === 'fulfilled' && manualRes.value?.success ? manualRes.value.data : {};
  const equityLive = equityRes.status === 'fulfilled' ? equityRes.value : null;
  const mfLive     = mfRes.status === 'fulfilled'     ? mfRes.value     : null;
  const cryptoLive = cryptoRes.status === 'fulfilled' ? cryptoRes.value : null;
  const indmoneyLive = indmoneyRes.status === 'fulfilled' ? indmoneyRes.value : null;

  const mv = (k: string) => manual[k]?.value ?? 0;

  const eb = equityLive?.success ? equityLive.breakdown : null;
  const mb = mfLive?.success     ? mfLive.breakdown     : null;

  const equityInvested    = eb?.equity?.invested  ?? mv('equity_invested');
  const equityCurrent     = eb?.equity?.current   ?? mv('equity_current');
  const eqGoldInvested    = eb?.gold?.invested    ?? mv('equity_gold_invested');
  const eqGoldCurrent     = eb?.gold?.current     ?? mv('equity_gold_current');
  const eqSilverInvested  = eb?.silver?.invested  ?? mv('equity_silver_invested');
  const eqSilverCurrent   = eb?.silver?.current   ?? mv('equity_silver_current');
  const eqForeignInvested = eb?.foreign?.invested ?? mv('equity_foreign_invested');
  const eqForeignCurrent  = eb?.foreign?.current  ?? mv('equity_foreign_current');
  const eqTotalInvested   = equityLive?.success ? (equityLive.invested ?? 0) : (mv('equity_total_invested') || (equityInvested + eqGoldInvested + eqSilverInvested + eqForeignInvested));
  const eqTotalCurrent    = equityLive?.success ? (equityLive.current  ?? 0) : (mv('equity_total_current')  || (equityCurrent  + eqGoldCurrent  + eqSilverCurrent  + eqForeignCurrent));

  const mfEquityInvested  = mb?.equity?.invested  ?? mv('mf_equity_invested');
  const mfEquityCurrent   = mb?.equity?.current   ?? mv('mf_equity_current');
  const mfGoldInvested    = mb?.gold?.invested    ?? mv('mf_gold_invested');
  const mfGoldCurrent     = mb?.gold?.current     ?? mv('mf_gold_current');
  const mfSilverInvested  = mb?.silver?.invested  ?? mv('mf_silver_invested');
  const mfSilverCurrent   = mb?.silver?.current   ?? mv('mf_silver_current');
  const mfDebtInvested    = mb?.debt?.invested    ?? mv('mf_debt_invested');
  const mfDebtCurrent     = mb?.debt?.current     ?? mv('mf_debt_current');
  const mfTotalInvested   = mfLive?.success ? (mfLive.invested ?? 0) : (mv('mf_total_invested') || (mfEquityInvested + mfGoldInvested + mfSilverInvested + mfDebtInvested));
  const mfTotalCurrent    = mfLive?.success ? (mfLive.current  ?? 0) : (mv('mf_total_current')  || (mfEquityCurrent  + mfGoldCurrent  + mfSilverCurrent  + mfDebtCurrent));

  const indmoneyInvested  = indmoneyLive?.success ? (indmoneyLive.invested ?? 0) : mv('indmoney_foreign_invested');
  const indmoneyCurrent   = indmoneyLive?.success ? (indmoneyLive.current  ?? 0) : mv('indmoney_foreign_current');

  const cryptoInvested    = mv('crypto_invested');
  const cryptoCurrent     = cryptoLive?.success ? (cryptoLive.current ?? 0) : mv('crypto_current');

  const bankBalance  = mv('bank_balance');
  const cashInHand   = mv('cash_in_hand');
  const mobikwik     = mv('mobikwik');
  const bondInvested = mv('bond_invested');
  const bondCurrent  = mv('bond_current');
  const fdInvested   = mv('fd_invested');
  const fdCurrent    = mv('fd_current');
  const pfInvested   = mv('pf_invested');
  const pfCurrent    = mv('pf_current');

  const debtInvested     = bondInvested + fdInvested;
  const debtCurrent      = bondCurrent  + fdCurrent;
  const bankTotal        = bankBalance  + cashInHand + mobikwik;
  const totalAssets      = bankTotal + eqTotalCurrent + mfTotalCurrent + indmoneyCurrent + cryptoCurrent + debtCurrent + pfCurrent;
  const totalLiabilities = mv('credit_card_due') + mv('pay_to_someone');
  const netWorth         = totalAssets - totalLiabilities;

  return {
    netWorth, totalAssets, totalLiabilities,
    eqTotalInvested, mfTotalInvested, indmoneyInvested,
    cryptoInvested, debtInvested, pfInvested,
    eqTotalCurrent, mfTotalCurrent, indmoneyCurrent,
    cryptoCurrent, debtCurrent, pfCurrent,
    bankBalance, cashInHand, mobikwik, bankTotal,
    creditCardDue: mv('credit_card_due'), payToSomeone: mv('pay_to_someone'),
    eqEquityInvested: equityInvested, eqEquityCurrent: equityCurrent,
    eqGoldInvested,    eqGoldCurrent,
    eqSilverInvested,  eqSilverCurrent,
    eqForeignInvested, eqForeignCurrent,
    mfEquityInvested,  mfEquityCurrent,
    mfGoldInvested,    mfGoldCurrent,
    mfSilverInvested,  mfSilverCurrent,
    mfDebtInvested,    mfDebtCurrent,
    bondInvested, bondCurrent,
    fdInvested,   fdCurrent,
  };
}
