import { NextResponse } from 'next/server';
import { getCallerEmail, getAdminEmail } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Reports whether the current session belongs to the admin.
 * Uses the server-only ADMIN_EMAIL source of truth so the client doesn't
 * need ADMIN_EMAIL exposed in the bundle.
 */
export async function GET() {
  const email = await getCallerEmail();
  const adminEmail = getAdminEmail();
  const isAdmin = !!email && !!adminEmail && email === adminEmail;
  return NextResponse.json({ isAdmin });
}
