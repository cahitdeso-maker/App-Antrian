import { mysqlTable, varchar, int, mysqlEnum, datetime, timestamp, text, boolean } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// Users table - Better Auth compatible
export const users = mysqlTable('user', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('admin'),
  email: varchar('email', { length: 255 }).unique(),
  name: varchar('name', { length: 255 }),
  image: varchar('image', { length: 500 }),
  emailVerified: boolean('emailVerified').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow(),
});

// Sessions table for Better Auth
export const sessions = mysqlTable('session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('userId', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expiresAt').notNull(),
  ipAddress: varchar('ipAddress', { length: 255 }),
  userAgent: varchar('userAgent', { length: 500 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow(),
});

// Accounts table for Better Auth (required for credential auth)
export const accounts = mysqlTable('account', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('userId', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: varchar('accountId', { length: 255 }).notNull(),
  providerId: varchar('providerId', { length: 255 }).notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: varchar('scope', { length: 500 }),
  password: varchar('password', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow(),
});

// Verification table for Better Auth
export const verifications = mysqlTable('verification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow(),
});

// Queues table
export const queues = mysqlTable('queues', {
  id: int('id').primaryKey().autoincrement(),
  queueNumber: varchar('queue_number', { length: 50 }).notNull(),
  patientType: mysqlEnum('patient_type', ['BPJS', 'UMUM']).notNull(),
  shift: mysqlEnum('shift', ['PAGI', 'SIANG']).notNull(),
  status: mysqlEnum('status', ['MENUNGGU', 'DIPANGGIL', 'SELESAI', 'DILEWATI'])
    .notNull()
    .default('MENUNGGU'),
  loket: varchar('loket', { length: 20 }), // LOKET_1, LOKET_2, LOKET_3, LOKET_4
  createdAt: datetime('created_at').default(sql`NOW()`).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
