import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

let dbInstance: any = null;
let mysqlConnection: any = null;

export const getDb = async () => {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    if (!mysqlConnection) {
      mysqlConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3307'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Mahmudd',
        database: process.env.DB_NAME || 'db_antrian',
        connectTimeout: 5000,
      });
    }

    dbInstance = drizzle(mysqlConnection, {
      schema,
      mode: 'default'
    });

    return dbInstance;
  } catch (error) {
    console.warn('Database connection not available:', error);
    return null;
  }
};

// Get raw MySQL connection for parameterized queries
export const getRawConnection = async () => {
  if (mysqlConnection) {
    return mysqlConnection;
  }
  
  // Initialize if not already done
  await getDb();
  return mysqlConnection;
};

// For direct access (use with caution)
export const db = await getDb();

export type Database = typeof db;
