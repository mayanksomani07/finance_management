export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  source: string;
  description: string;
  account_last4: string | null;
  balance_after: number | null;
  transaction_at: Date;
}

function parseAmount(str: string): number {
  // Remove currency symbols, commas, spaces
  const cleaned = str.replace(/[Rs\.INR,\s₹]/gi, '').trim();
  return parseFloat(cleaned) || 0;
}

function parseDate(str: string): Date {
  if (!str) return new Date();

  // Format: 16May26 or 16May2026
  const match1 = str.match(/(\d{1,2})([A-Za-z]{3})(\d{2,4})/);
  if (match1) {
    const day = match1[1];
    const mon = match1[2];
    const yr = match1[3].length === 2 ? '20' + match1[3] : match1[3];
    const d = new Date(`${day} ${mon} ${yr}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Format: 16-05-26 or 16/05/26 or 16-05-2026
  const match2 = str.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (match2) {
    const day = match2[1].padStart(2, '0');
    const mon = match2[2].padStart(2, '0');
    const yr = match2[3].length === 2 ? '20' + match2[3] : match2[3];
    const d = new Date(`${yr}-${mon}-${day}`);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}

export function parseSMS(text: string): ParsedTransaction {
  const t = text.trim();

  // Bank new UPI debit: "Dear UPI user A/C X1234 debited by 500.0 on date 16May26 trf to MERCHANT Ref No 123456 -BANK"
  const bankDebitNew = t.match(
    /A\/C\s+[Xx*]?(\d{4})\s+debited\s+by\s+([\d,.]+)\s+on\s+date\s+(\w+)\s+trf\s+to\s+(.*?)\s+Ref/i
  );
  if (bankDebitNew) {
    return {
      amount: parseAmount(bankDebitNew[2]),
      type: 'expense',
      source: 'bank',
      description: `Paid to ${bankDebitNew[4].trim()}`,
      account_last4: bankDebitNew[1],
      balance_after: null,
      transaction_at: parseDate(bankDebitNew[3]),
    };
  }

  // Bank new UPI credit: "Dear UPI user A/C X1234 credited by 2000.0 on date 16May26 trf from NAME Ref No 123456 -BANK"
  const bankCreditNew = t.match(
    /A\/C\s+[Xx*]?(\d{4})\s+credited\s+by\s+([\d,.]+)\s+on\s+date\s+(\w+)\s+trf\s+from\s+(.*?)\s+Ref/i
  );
  if (bankCreditNew) {
    return {
      amount: parseAmount(bankCreditNew[2]),
      type: 'income',
      source: 'bank',
      description: `Received from ${bankCreditNew[4].trim()}`,
      account_last4: bankCreditNew[1],
      balance_after: null,
      transaction_at: parseDate(bankCreditNew[3]),
    };
  }

  // Bank old format debit: "INR 500.00 debited from A/c X1234 on 16-05-26. Info: UPI/GOOGLEPAY"
  const bankOldDebit = t.match(
    /INR\s+([\d,.]+)\s+debited\s+from\s+A\/c\s+[Xx*]?(\d{4})\s+on\s+([\d\-\/]+)\.?\s*Info:\s*(.*)/i
  );
  if (bankOldDebit) {
    return {
      amount: parseAmount(bankOldDebit[1]),
      type: 'expense',
      source: 'bank',
      description: bankOldDebit[4].trim(),
      account_last4: bankOldDebit[2],
      balance_after: null,
      transaction_at: parseDate(bankOldDebit[3]),
    };
  }

  // Bank old format credit: "INR 5000.00 credited to A/c X1234 on 16-05-26. Info: NEFT"
  const bankOldCredit = t.match(
    /INR\s+([\d,.]+)\s+credited\s+to\s+A\/c\s+[Xx*]?(\d{4})\s+on\s+([\d\-\/]+)\.?\s*Info:\s*(.*)/i
  );
  if (bankOldCredit) {
    return {
      amount: parseAmount(bankOldCredit[1]),
      type: 'income',
      source: 'bank',
      description: bankOldCredit[4].trim(),
      account_last4: bankOldCredit[2],
      balance_after: null,
      transaction_at: parseDate(bankOldCredit[3]),
    };
  }

  // GPay/UPI generic debit: "Rs.500.00 debited from a/c **1234 on 16-05-26;UPI Ref No 123456"
  const gpayDebit = t.match(
    /Rs\.?\s*([\d,.]+)\s+debited\s+from\s+a\/c\s+[*Xx]*(\d{4})\s+on\s+([\d\-\/]+)[;,]?\s*(.*?)(?:UPI\s*Ref|$)/i
  );
  if (gpayDebit) {
    return {
      amount: parseAmount(gpayDebit[1]),
      type: 'expense',
      source: 'gpay',
      description: gpayDebit[4].trim() || 'UPI Payment',
      account_last4: gpayDebit[2],
      balance_after: null,
      transaction_at: parseDate(gpayDebit[3]),
    };
  }

  // GPay/UPI generic credit
  const gpayCredit = t.match(
    /Rs\.?\s*([\d,.]+)\s+credited\s+to\s+a\/c\s+[*Xx]*(\d{4})\s+on\s+([\d\-\/]+)[;,]?\s*(.*?)(?:UPI\s*Ref|$)/i
  );
  if (gpayCredit) {
    return {
      amount: parseAmount(gpayCredit[1]),
      type: 'income',
      source: 'gpay',
      description: gpayCredit[4].trim() || 'UPI Credit',
      account_last4: gpayCredit[2],
      balance_after: null,
      transaction_at: parseDate(gpayCredit[3]),
    };
  }

  // MobiKwik debit: "Rs. 200 has been debited from your MobiKwik wallet"
  const mobikwikDebit = t.match(/Rs\.?\s*([\d,.]+)\s+has\s+been\s+debited\s+from\s+your\s+MobiKwik/i);
  if (mobikwikDebit) {
    return {
      amount: parseAmount(mobikwikDebit[1]),
      type: 'expense',
      source: 'mobikwik',
      description: 'MobiKwik wallet payment',
      account_last4: null,
      balance_after: null,
      transaction_at: new Date(),
    };
  }

  // MobiKwik credit
  const mobikwikCredit = t.match(/Rs\.?\s*([\d,.]+)\s+has\s+been\s+credited\s+to\s+your\s+MobiKwik/i);
  if (mobikwikCredit) {
    return {
      amount: parseAmount(mobikwikCredit[1]),
      type: 'income',
      source: 'mobikwik',
      description: 'MobiKwik wallet credit',
      account_last4: null,
      balance_after: null,
      transaction_at: new Date(),
    };
  }

  // NEFT credit: "NEFT CR:XXXXXXXXXX:NAME:BANKNAME:INR 5000.00 credited to A/c X1234"
  const neftCredit = t.match(
    /NEFT\s+CR:([^:]+):([^:]+):([^:]+):INR\s+([\d,.]+)\s+credited\s+to\s+A\/c\s+[Xx*]?(\d{4})/i
  );
  if (neftCredit) {
    return {
      amount: parseAmount(neftCredit[4]),
      type: 'income',
      source: 'neft',
      description: `NEFT from ${neftCredit[2].trim()} via ${neftCredit[3].trim()}`,
      account_last4: neftCredit[5],
      balance_after: null,
      transaction_at: new Date(),
    };
  }

  // NEFT debit: "NEFT XXXXXXXXXX Rs.5000 debited from A/c X1234"
  const neftDebit = t.match(
    /NEFT\s+(\S+)\s+Rs\.?\s*([\d,.]+)\s+debited\s+from\s+A\/c\s+[Xx*]?(\d{4})/i
  );
  if (neftDebit) {
    return {
      amount: parseAmount(neftDebit[2]),
      type: 'expense',
      source: 'neft',
      description: `NEFT transfer ${neftDebit[1]}`,
      account_last4: neftDebit[3],
      balance_after: null,
      transaction_at: new Date(),
    };
  }

  // Generic debit patterns
  const genericDebit = t.match(
    /(?:Rs\.?|INR)\s*([\d,.]+)\s+(?:has been\s+)?debited/i
  );
  if (genericDebit) {
    const acct = t.match(/[Xx*]{2,}(\d{4})/);
    const bal = t.match(/(?:balance|bal)[:\s]+([\d,.]+)/i);
    const dateStr = t.match(/on\s+([\d\-\/]+)/i);
    return {
      amount: parseAmount(genericDebit[1]),
      type: 'expense',
      source: 'unknown',
      description: 'Debit transaction',
      account_last4: acct ? acct[1] : null,
      balance_after: bal ? parseAmount(bal[1]) : null,
      transaction_at: dateStr ? parseDate(dateStr[1]) : new Date(),
    };
  }

  // Generic credit patterns
  const genericCredit = t.match(
    /(?:Rs\.?|INR)\s*([\d,.]+)\s+(?:has been\s+)?credited/i
  );
  if (genericCredit) {
    const acct = t.match(/[Xx*]{2,}(\d{4})/);
    const bal = t.match(/(?:balance|bal)[:\s]+([\d,.]+)/i);
    const dateStr = t.match(/on\s+([\d\-\/]+)/i);
    return {
      amount: parseAmount(genericCredit[1]),
      type: 'income',
      source: 'unknown',
      description: 'Credit transaction',
      account_last4: acct ? acct[1] : null,
      balance_after: bal ? parseAmount(bal[1]) : null,
      transaction_at: dateStr ? parseDate(dateStr[1]) : new Date(),
    };
  }

  // Fallback — could not parse
  return {
    amount: 0,
    type: 'expense',
    source: 'unknown',
    description: 'Unknown transaction',
    account_last4: null,
    balance_after: null,
    transaction_at: new Date(),
  };
}
