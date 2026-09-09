import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sessions } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// Vereist een geldige custom-login sessie (cookie gezet door /api/auth/custom-sign-in).
// Valideert het session token direct tegen de `session` tabel.
export async function requireAuth() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('antrian.session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const session = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        token: sessions.token,
      })
      .from(sessions)
      .where(eq(sessions.token, sessionToken))
      .limit(1);

    if (session.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Cek of sessie verlopen is.
    if (new Date(session[0].expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return { session: session[0] };
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
}
