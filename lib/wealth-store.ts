import { createServerClient } from './supabase-server';

/** Read a string value stored in wealth_manual keyed by (user_id, key). */
export async function getStoredValue(userId: string, key: string): Promise<string | null> {
  const db = createServerClient();
  const { data } = await db
    .from('wealth_manual')
    .select('note')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();
  return data?.note ?? null;
}

/** Delete a stored value from wealth_manual keyed by (user_id, key). */
export async function deleteStoredValue(userId: string, key: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from('wealth_manual')
    .delete()
    .eq('user_id', userId)
    .eq('key', key);
  if (error) throw new Error(`deleteStoredValue failed for key "${key}": ${error.message}`);
}

/** Write (upsert) a string value into wealth_manual keyed by (user_id, key). */
export async function setStoredValue(userId: string, key: string, value: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from('wealth_manual')
    .upsert(
      { user_id: userId, key, value: 0, note: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    );
  if (error) throw new Error(`setStoredValue failed for key "${key}": ${error.message}`);
}
