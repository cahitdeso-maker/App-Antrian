import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, sessions } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Mengubah password user yang sedang login. Menerima { currentPassword,
// newPassword, confirmPassword }. Password baru di-hash dengan bcrypt lalu
// ditulis alleen naar de tabel `user`.
export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(
    'antrian.session_token',
  )?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Tidak ada sesi login' },
      { status: 401 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Data tidak valid' },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword, confirmPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Password lama dan password baru diperlukan' },
      { status: 400 },
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: 'Konfirmasi password baru tidak cocok' },
      { status: 400 },
    );
  }

  const db = await getDb();
  if (!db) {
    console.error('[auth/change-password] Database connection not available');
    return NextResponse.json(
      { error: 'Database tidak tersedia' },
      { status: 500 },
    );
  }

  try {
    // Temukan user berdasarkan session token.
    const sessionRows = await db
      .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.token, sessionToken))
      .limit(1);

    if (sessionRows.length === 0) {
      return NextResponse.json(
        { error: 'Sesi tidak ditemukan' },
        { status: 401 },
      );
    }

    if (new Date(sessionRows[0].expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Sesi telah kedaluwarsa' },
        { status: 401 },
      );
    }

    const userId = sessionRows[0].userId;

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length === 0) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 401 },
      );
    }

    const foundUser = userRows[0];

    // Password hash wordt direct uit de tabel user gehaald (geen account meer).
    const currentHash: string | null = foundUser.password;

    if (!currentHash) {
      return NextResponse.json(
        { error: 'Akun tidak memiliki password untuk diverifikasi' },
        { status: 400 },
      );
    }

    // Verifikasi password lama.
    let isValid = false;
    if (currentHash.startsWith('$2')) {
      isValid = await bcrypt.compare(currentPassword, currentHash);
    } else {
      isValid = currentPassword === currentHash;
      if (!isValid) {
        try {
          isValid = await bcrypt.compare(currentPassword, currentHash);
        } catch {
          isValid = false;
        }
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Password lama salah' },
        { status: 400 },
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password di tabel user.
    await db
      .update(users)
      .set({ password: newHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    console.error('[auth/change-password] Error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 },
    );
  }
}