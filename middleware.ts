import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Public paths — always accessible
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/auth') || pathname.startsWith('/reset-password') || pathname === '/api/auth/is-admin' || pathname === '/api/auth/check-email';

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // ADMIN_EMAIL is server-only; middleware runs server-side so it can read it directly.
  const adminEmail = process.env.ADMIN_EMAIL ?? '';
  const isAdmin = !!adminEmail && user?.email === adminEmail;

  // Admin-only routes
  if (pathname.startsWith('/admin') && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Admin must stay on /admin — block access to all app pages (but allow API routes)
  if (isAdmin && !pathname.startsWith('/admin') && !pathname.startsWith('/api') && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
};
