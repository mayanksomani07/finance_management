'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { setLocalUserId, clearLocalUserId } from '@/lib/localStore';
import { useTheme } from '@/components/ThemeProvider';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const { resetTheme } = useTheme();
  // Tracks whether a session existed at page load — used to distinguish a real
  // new login (SIGNED_IN with no prior session) from a token refresh.
  const hadSessionRef = useRef(false);

  useEffect(() => {
    const auth = supabase.auth;
    auth.getSession().then((res: { data: { session: Session | null } }) => {
      const s = res.data.session;
      if (s) hadSessionRef.current = true;
      setSession(s);
      if (s?.user) setLocalUserId(s.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = auth.onAuthStateChange(
      (event: string, s: Session | null) => {
        // Only reset theme on a genuinely new login, not on token refresh
        // (TOKEN_REFRESHED also fires SIGNED_IN; hadSessionRef is stable across renders)
        if (event === 'SIGNED_IN' && !hadSessionRef.current) resetTheme();
        if (event === 'SIGNED_OUT') hadSessionRef.current = false;
        if (s) hadSessionRef.current = true;
        setSession(s);
        if (s?.user) setLocalUserId(s.user.id);
        else clearLocalUserId();
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  // supabase is a singleton from getSupabaseBrowser() — stable across renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = session?.user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  async function signOut() {
    resetTheme();
    await supabase.auth.signOut();
    clearLocalUserId();
    ['tx_search','tx_filterType','tx_filterMain','tx_filterSub','tx_dateFilter','tx_customFrom','tx_customTo','tx_page']
      .forEach(k => sessionStorage.removeItem(k));
    router.replace('/login');
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
