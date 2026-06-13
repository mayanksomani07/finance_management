import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared auth helper for API routes.
 * Returns the authenticated user + their scoped Supabase client.
 * Returns null if unauthenticated — caller should return 401.
 */
export async function getAuthUser(): Promise<{
  supabase: SupabaseClient;
  user: NonNullable<Awaited<ReturnType<SupabaseClient['auth']['getUser']>>['data']['user']>;
} | null> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

/** Convenience: returns a 401 response */
export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
