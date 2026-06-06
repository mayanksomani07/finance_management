import { createClient } from '@supabase/supabase-js';

// Client-side supabase client (anon key) — lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null;
export function getSupabaseClient() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Keep named export for backward compat — lazy proxy
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof createClient>];
  },
});

// Server-side supabase client (service key — only use in API routes)
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export interface Transaction {
  id: string;
  created_at: string;
  transaction_at: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  source: string | null;
  description: string | null;
  raw_text: string | null;
  account_last4: string | null;
  balance_after: number | null;
}
