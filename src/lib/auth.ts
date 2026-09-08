import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { username } from 'better-auth/plugins';
import { getDb } from './db';
import * as schema from './schema';

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3000',
  database: drizzleAdapter(await getDb(), {
    schema,
    provider: 'mysql',
  }),
  // Login wordt volledig afgehandeld via de custom endpoints
  // (/api/auth/custom-sign-in en custom-sign-up) die de password-hash direct
  // in de tabel `user` bewaren. De `account` tabel van Better Auth wordt
  // daarom niet gebruikt en is uit het schema verwijderd.
  plugins: [
    username(),
  ],
  user: {
    modelName: 'user',
    fields: {
      name: 'name',
      image: 'image',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  session: {
    modelName: 'session',
    fields: {
      userId: 'userId',
      expiresAt: 'expiresAt',
      token: 'token',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      ipAddress: 'ipAddress',
      userAgent: 'userAgent',
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || 'your-secret-key-change-this-in-production',
  trustedOrigins: ['http://localhost:3000'],
  advanced: {
    cookies: {
      session_token: {
        name: 'better-auth.session_token',
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        },
      },
    },
  },
});

export type Auth = typeof auth;
