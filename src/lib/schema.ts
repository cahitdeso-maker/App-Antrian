import { mysqlTable, varchar, int, mysqlEnum, boolean, datetime, timestamp } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// Users table - Better Auth compatible
export const users = mysqlTable('user', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  displayUsername: varchar('displayUsername', { length: 255 }),
  password: varchar('password', { length: 255 }),
  email: varchar('email', { length: 255 }),
  emailVerified: boolean('emailVerified').notNull().default(false),
  role: varchar('role', { length: 50 }).notNull().default('admin'),
  name: varchar('name', { length: 255 }),
  image: varchar('image', { length: 500 }),
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

// YouTube playlist entries (uploaded via video-manager)
export const youtubeVideos = mysqlTable('youtube_videos', {
  id: int('id').primaryKey().autoincrement(),
  url: varchar('url', { length: 500 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  isDeleted: boolean('is_deleted').notNull().default(false), // Soft delete
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
