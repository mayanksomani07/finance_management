/**
 * Two separate user lists, each from its own env var.
 * NEXT_PUBLIC_ prefix required — these are read in client components too.
 *
 * NEXT_PUBLIC_SPECIAL_USER_EMAILS  → gates Excel import
 * NEXT_PUBLIC_WEALTH_USER_EMAILS   → gates /wealth page + bottom nav + CoinDCX
 *
 * .env.local example:
 *   NEXT_PUBLIC_SPECIAL_USER_EMAILS=alice@gmail.com,bob@gmail.com
 *   NEXT_PUBLIC_WEALTH_USER_EMAILS=alice@gmail.com
 *
 * All checks are case-insensitive.
 * NOTE: functions evaluate env vars inline (not at module load) so Next.js
 * correctly inlines the NEXT_PUBLIC_ values into the client bundle.
 */

export function isSpecialUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const val = process.env.NEXT_PUBLIC_SPECIAL_USER_EMAILS ?? '';
  const list = val ? val.split(',').map(e => e.trim()).filter(Boolean) : [];
  return list.some(e => e.toLowerCase() === email.toLowerCase());
}

export function isWealthUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const val = process.env.NEXT_PUBLIC_WEALTH_USER_EMAILS ?? '';
  const list = val ? val.split(',').map(e => e.trim()).filter(Boolean) : [];
  return list.some(e => e.toLowerCase() === email.toLowerCase());
}

// Keep named exports for any code that imports the raw lists
export const SPECIAL_USER_LIST: string[] = (process.env.NEXT_PUBLIC_SPECIAL_USER_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
export const WEALTH_SPECIAL_USER_LIST: string[] = (process.env.NEXT_PUBLIC_WEALTH_USER_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
