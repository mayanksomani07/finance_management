export type MainCategory = 'Need' | 'Want' | 'Investment';

export interface CategoryInfo {
  main: MainCategory;
  sub: string;
}

// Keywords in comment that push "Other" expense → Need
const NEED_OTHER_KEYWORDS = ["mom's", "mom", "papa", "priya", "gunjan", "didi", "ghar", "interest"];

// Keywords in comment that push "Gifts" → Need
const NEED_GIFT_KEYWORDS = ['bhai', 'gunjan', 'sweet', 'mom'];

// Sub-categories that are always Need regardless of comment
const NEED_SUBS: Record<string, string> = {
  'PG Rent':          'PG Rent',
  'Health':           'Health',
  'Recharge':         'Recharge',
  'Donation':         'Donation',
  'Insterest':        'Interest',   // typo in source data
  'Interest':         'Interest',
  'Washing':          'Washing',
  'Xerox':            'Xerox',
  'Home':             'Home',
  'Education':        'Education',
  'Mess Bill':        'Mess Bill',
};

// Sub-categories that are always Investment
const INVEST_SUBS: Record<string, string> = {
  'Investment':       'Investment',
  'Investment (Debt)':'Investment (Debt)',
};

// Sub-categories that are always Want (unless overridden above)
const WANT_SUBS: Record<string, string> = {
  'Groceries':        'Groceries',
  'Transportation':   'Transportation',
  'Food':             'Food',
  'Leisure':          'Leisure',
};

export function categorizeExpense(subCategory: string, comment: string): CategoryInfo {
  const sub = subCategory.trim();
  const commentLower = comment.toLowerCase();

  // Investment always wins
  if (INVEST_SUBS[sub]) return { main: 'Investment', sub: INVEST_SUBS[sub] };

  // Strict Need subs
  if (NEED_SUBS[sub]) return { main: 'Need', sub: NEED_SUBS[sub] };

  // "Gifts" — Need if comment has need-gift keywords, else Want
  if (sub === 'Gifts') {
    const isNeedGift = NEED_GIFT_KEYWORDS.some((k) => commentLower.includes(k));
    return { main: isNeedGift ? 'Need' : 'Want', sub: 'Gifts' };
  }

  // "Other" — Need if comment has need-other keywords, else Want
  if (sub === 'Other') {
    const isNeedOther = NEED_OTHER_KEYWORDS.some((k) => commentLower.includes(k));
    return { main: isNeedOther ? 'Need' : 'Want', sub: 'Other' };
  }

  // Explicit Want subs
  if (WANT_SUBS[sub]) return { main: 'Want', sub: WANT_SUBS[sub] };

  // Fallback — treat unknown as Want
  return { main: 'Want', sub: sub || 'Other' };
}

// Income category normaliser
export function normaliseIncomeCategory(cat: string): string {
  const map: Record<string, string> = {
    Paycheck: 'Payslip',
    Payslip: 'Payslip',
    Interest: 'Interest',
    'Money Back': 'Money Back',
    Gift: 'Gift',
  };
  return map[cat] ?? cat;
}
