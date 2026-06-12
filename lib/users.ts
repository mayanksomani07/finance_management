/**
 * Special user lists — add emails here rather than scattering them across env vars or route files.
 * All checks are case-insensitive.
 */

export const SPECIAL_USER_LIST: string[] = [
  'mayanksomani7@gmail.com',
];

export function isSpecialUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return SPECIAL_USER_LIST.some(e => e.toLowerCase() === email.toLowerCase());
}

// Wealth access uses the same list as special users; keep isWealthUser as a named alias
// so call-sites don't need to change if the two lists ever diverge.
export const isWealthUser = isSpecialUser;
