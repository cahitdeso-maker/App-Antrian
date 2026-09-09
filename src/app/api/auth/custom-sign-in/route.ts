import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { users, sessions } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    console.log('[custom-sign-in] Login attempt for:', username);

    if (!username || !password) {
      return NextResponse.json(
        { message: 'Username dan password diperlukan' },
        { status: 400 }
      );
    }

    const db = await getDb();
    if (!db) {
      console.error('[custom-sign-in] Database connection not available');
      return NextResponse.json(
        { message: 'Database tidak tersedia' },
        { status: 500 }
      );
    }

    // Find user by username
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    console.log('[custom-sign-in] User found:', user.length > 0 ? 'yes' : 'no');

    if (user.length === 0) {
      return NextResponse.json(
        { message: 'Username tidak ditemukan' },
        { status: 401 }
      );
    }

    const foundUser = user[0];
    console.log('[custom-sign-in] User ID:', foundUser.id);

    // Password hash wordt direct uit de tabel user gehaald (geen account meer).
    const passwordHash = foundUser.password;

    if (!passwordHash) {
      return NextResponse.json(
        { message: 'Akun tidak memiliki password' },
        { status: 401 }
      );
    }

    // Verify password - try bcrypt first, then fall back to direct comparison
    let isValidPassword = false;
    
    // Check if hash looks like bcrypt (starts with $2)
    if (passwordHash.startsWith('$2')) {
      isValidPassword = await bcrypt.compare(password, passwordHash);
    } else {
      // For scrypt or other formats, try direct comparison
      // Better Auth scrypt hashes look like base64
      const { createHash } = await import('crypto');
      
      // Try direct comparison first (for testing)
      if (password === passwordHash) {
        isValidPassword = true;
      } else {
        // Try bcrypt as fallback
        try {
          isValidPassword = await bcrypt.compare(password, passwordHash);
        } catch (e) {
          console.log('[custom-sign-in] Bcrypt compare failed, trying direct match');
          // For now, allow if password matches directly (development mode)
          isValidPassword = false;
        }
      }
    }

    console.log('[custom-sign-in] Password valid:', isValidPassword);

    if (!isValidPassword) {
      return NextResponse.json(
        { message: 'Password salah' },
        { status: 401 }
      );
    }

    // Create session
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    await db.insert(sessions).values({
      id: sessionToken,
      userId: foundUser.id,
      token: sessionToken,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('[custom-sign-in] Session created:', sessionToken);

    // Set session cookie
    const response = NextResponse.json(
      {
        message: 'Login berhasil',
        user: {
          id: foundUser.id,
          username: foundUser.username,
          name: foundUser.name,
          role: foundUser.role,
        },
      },
      { status: 200 }
    );

    response.cookies.set('antrian.session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('[custom-sign-in] Login error:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan server', detail: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

