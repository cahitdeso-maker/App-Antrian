import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sessions, users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// Mendapatkan data profil user yang sedang login langsung dari tabel `user`,
// berdasarkan session cookie yang dipakai oleh custom login.
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(
    'antrian.session_token',
  )?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Tidak ada sesi login' },
      { status: 401 },
    );
  }

  const db = await getDb();
  if (!db) {
    console.error('[auth/user] Database connection not available');
    return NextResponse.json(
      { error: 'Database tidak tersedia' },
      { status: 500 },
    );
  }

  try {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        image: users.image,
        role: users.role,
      })
      .from(sessions)
      .where(eq(sessions.token, sessionToken))
      .innerJoin(users, eq(sessions.userId, users.id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Sesi tidak ditemukan' },
        { status: 401 },
      );
    }

    const user = rows[0];

    // Cek apakah sesi sudah kedaluwarsa.
    const session = await db
      .select({ expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.token, sessionToken))
      .limit(1);
    if (
      session.length > 0 &&
      new Date(session[0].expiresAt).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: 'Sesi telah kedaluwarsa' },
        { status: 401 },
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[auth/user] Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 },
    );
  }
}