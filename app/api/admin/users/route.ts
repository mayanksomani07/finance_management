import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';
import { getCallerEmail, getAdminEmail, forbidden } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    const email = await getCallerEmail();
    const adminEmail = getAdminEmail();
    if (!email || email !== adminEmail) return forbidden();

    let body: { userId?: unknown };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { userId } = body;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: targetUser } = await admin.auth.admin.getUserById(userId);
    if (targetUser?.user?.email === adminEmail) {
      return NextResponse.json({ error: 'Cannot delete the admin account.' }, { status: 403 });
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin delete user error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
