import { NextResponse } from 'next/server';
import { createServerClient as createSSRServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Shared admin auth helper.
 * Verifies the caller is the admin via their session (not a body param).
 * Returns the caller email or null.
 */
export async function getCallerEmail(): Promise<string | null> {
  const cookieStore = cookies();
  const supabase = createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/**
 * Returns the admin email from the server-only ADMIN_EMAIL env var.
 * Never exposed to the client bundle.
 */
export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL ?? '';
}

/** Returns a 403 Forbidden response */
export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
