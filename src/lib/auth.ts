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
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username(),
  ],
  user: {
    modelName: 'user',
    fields: {
      name: 'name',
      email: 'email',
      emailVerified: 'emailVerified',
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
  account: {
    modelName: 'account',
    fields: {
      userId: 'userId',
      accountId: 'accountId',
      providerId: 'providerId',
      accessToken: 'accessToken',
      refreshToken: 'refreshToken',
      idToken: 'idToken',
      accessTokenExpiresAt: 'accessTokenExpiresAt',
      refreshTokenExpiresAt: 'refreshTokenExpiresAt',
      scope: 'scope',
      password: 'password',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  },
  verification: {
    modelName: 'verification',
    fields: {
      identifier: 'identifier',
      value: 'value',
      expiresAt: 'expiresAt',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
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
