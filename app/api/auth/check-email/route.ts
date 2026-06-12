import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Only allow same-origin calls (login page UX only — not a public enumeration API)
    const origin = req.headers.get('origin') ?? '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const normalizedAppUrl = appUrl.replace(/\/$/, '');
    // If APP_URL is configured, enforce an exact origin match.
    // If it's not set (local dev without env), fall through — the route is still
    // protected by SUPABASE_SERVICE_KEY being server-only.
    if (appUrl && origin && origin !== normalizedAppUrl) {
      return NextResponse.json({ exists: false }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email || typeof email !== 'string') return NextResponse.json({ exists: false });

    const normalised = email.trim().toLowerCase();

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(normalised)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_KEY!,
      },
    });

    if (!res.ok) {
      console.error('[check-email] admin API error:', res.status, await res.text());
      return NextResponse.json({ exists: false }, { status: 500 });
    }

    const { users } = await res.json() as { users: { email: string }[] };
    const exists = users.some(u => u.email === normalised);

    return NextResponse.json({ exists });
  } catch (err) {
    console.error('[check-email] unexpected error:', err);
    return NextResponse.json({ exists: false }, { status: 500 });
  }
}
