import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAdminEmail } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/';
  // Allowlist: must start with / and not contain a protocol separator (guards against
  // /%2F, //, /\, and other open-redirect bypasses). Decode once before checking.
  let decoded = '/';
  try { decoded = decodeURIComponent(rawNext); } catch { /* malformed — fall back to / */ }
  const next = decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.startsWith('/\\') ? decoded : '/';

  if (code) {
    const cookieStore: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.push({ name, value, options })
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      const adminEmail = getAdminEmail();
      const redirectTo = adminEmail && data.session.user.email === adminEmail ? '/admin' : next;
      const response = NextResponse.redirect(`${origin}${redirectTo}`);
      cookieStore.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      );
      return response;
    }

    // Log error in dev to help debug
    if (error) console.error('[auth/callback] exchangeCodeForSession error:', error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
