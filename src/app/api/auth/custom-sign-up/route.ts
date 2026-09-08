import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq, like } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Generasi ID user dengan format sederhana: "<seq>-<jari>" contoh "01-2026".
// Seq adalah nomor urut (2 sifer) untuk tahun tersebut, jadi ID di database
// mudah dibaca dan bukan string UUID panjang seperti "9edca69a-...".
async function generateSimpleUserId(db: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `%-${year}`;

  // Ambil semua ID user yang sudah ada untuk tahun ini.
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.id, prefix));

  let maxSeq = 0;
  for (const row of rows) {
    const num = parseInt(String(row.id).split('-')[0], 10);
    if (!isNaN(num) && num > maxSeq) {
      maxSeq = num;
    }
  }

  const nextSeq = maxSeq + 1;
  return `${String(nextSeq).padStart(2, '0')}-${year}`;
}

// Sign up (daftar) user baru dengan ID yang sederhana. Berlaku seperti
// custom-sign-in: menyimpan langsung ke tabel `user`, zodat na daftar
// login via /api/auth/custom-sign-in terus berfungsa.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, username, password } = body;

    if (!name || !username || !password) {
      return NextResponse.json(
        { message: 'Name, username dan password diperlukan' },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password minimal 6 karakter' },
        { status: 400 },
      );
    }

    const db = await getDb();
    if (!db) {
      console.error('[custom-sign-up] Database connection not available');
      return NextResponse.json(
        { message: 'Database tidak tersedia' },
        { status: 500 },
      );
    }

    // Cek username unik.
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { message: 'Username sudah sudah dipakai' },
        { status: 409 },
      );
    }

    // ID sederhana: "01-2026", "02-2026", ...
    const userId = await generateSimpleUserId(db);
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    // Insert ke tabel user.
    await db.insert(users).values({
      id: userId,
      username,
      name,
      password: passwordHash,
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        message: 'Registrasi berhasil! Silakan login.',
        user: { id: userId, username, name, role: 'admin' },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[custom-sign-up] Error:', error);
    return NextResponse.json(
      {
        message: 'Terjadi kesalahan server',
        detail: error instanceof Error ? error.message : 'unknown',
      },
      { status: 500 },
    );
  }
}