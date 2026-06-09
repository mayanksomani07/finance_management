// Re-exports for backward compatibility — prefer supabase-browser / supabase-server for new code
export { getSupabaseBrowser as getSupabaseClient } from './supabase-browser';
export { createAdminClient as createServerClient } from './supabase-server';

// Legacy named export used by old client-side code
import { getSupabaseBrowser } from './supabase-browser';
export const supabase = new Proxy({} as ReturnType<typeof getSupabaseBrowser>, {
  get(_target, prop) {
    return getSupabaseBrowser()[prop as keyof ReturnType<typeof getSupabaseBrowser>];
  },
});

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
