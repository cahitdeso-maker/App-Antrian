import { eq, and, desc, gte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { getDb, getRawConnection } from './db';
import { queues } from './schema';
import { inMemoryStorage } from './storage';

// Global counter untuk queue numbers (persist across requests in memory)
const queueCounters = new Map<string, number>();

// Initialize counters from database on module load
const initializeCounters = async () => {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.log('[Queue] Database not available, using in-memory counters');
      return;
    }

    const db = await ensureDb();
    const today = new Date().toISOString().split('T')[0];

    // Get max count for each patientType + shift combination today
    const combinations = [
      { patientType: 'UMUM' as const, shift: 'PAGI' as const, prefix: 'A' },
      { patientType: 'UMUM' as const, shift: 'SIANG' as const, prefix: 'A' },
      { patientType: 'BPJS' as const, shift: 'PAGI' as const, prefix: 'B' },
      { patientType: 'BPJS' as const, shift: 'SIANG' as const, prefix: 'B' },
    ];

    for (const { patientType, shift, prefix } of combinations) {
      const counterKey = `${patientType}-${shift}-${today}`;
      
      const result = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(queues)
        .where(
          and(
            eq(queues.patientType, patientType),
            eq(queues.shift, shift),
            gte(queues.createdAt, sql`DATE(NOW())`)
          )
        );

      const count = result[0]?.count || 0;
      queueCounters.set(counterKey, count);
      console.log(`[Queue] Initialized counter for ${counterKey}: ${count}`);
    }
  } catch (error) {
    console.warn('[Queue] Failed to initialize counters:', error);
  }
};

// Run initialization
initializeCounters();

// Generate queue number based on patient type
// A for UMUM, B for BPJS
const getQueuePrefix = (patientType: 'BPJS' | 'UMUM'): string => {
  return patientType === 'BPJS' ? 'B' : 'A';
};

// Get current shift based on time
export const getCurrentShift = (): 'PAGI' | 'SIANG' => {
  const hour = new Date().getHours();
  return hour < 13 ? 'PAGI' : 'SIANG';
};

// Ensure db is available
const ensureDb = async () => {
  const db = await getDb();
  if (!db) {
    throw new Error('Database connection not available');
  }
  return db;
};

// Check if database is available
export const isDatabaseAvailable = async (): Promise<boolean> => {
  try {
    const db = await getDb();
    return db !== null;
  } catch {
    return false;
  }
};

// Generate next queue number
const generationLocks = new Map<string, boolean>();

export const generateQueueNumber = async (
  patientType: 'BPJS' | 'UMUM',
  shift: 'PAGI' | 'SIANG'
): Promise<string> => {
  const prefix = getQueuePrefix(patientType);
  const dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    // Fallback to in-memory storage for development
    const nextNumber = inMemoryStorage.getNextQueueNumber(patientType, shift);
    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  }

  const db = await ensureDb();

  // Count how many queues exist for this patient type and shift today
  const countResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(queues)
    .where(
      and(
        eq(queues.patientType, patientType),
        eq(queues.shift, shift),
        gte(queues.createdAt, sql`DATE(NOW())`)
      )
    );

  const nextNumber = (countResult[0]?.count || 0) + 1;

  // Format: A-001, B-001, etc.
  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
};

// Create a new queue with auto-increment number
export const createQueue = async (
  patientType: 'BPJS' | 'UMUM',
  shift: 'PAGI' | 'SIANG'
) => {
  const prefix = patientType === 'BPJS' ? 'B' : 'A';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const counterKey = `${patientType}-${shift}-${today}`;
  
  // Get or initialize counter for today
  if (!queueCounters.has(counterKey)) {
    // Initialize counter from database or in-memory
    queueCounters.set(counterKey, 0);
  }
  
  const currentCount = queueCounters.get(counterKey)! + 1;
  queueCounters.set(counterKey, currentCount);
  
  const queueNumber = `${prefix}-${String(currentCount).padStart(3, '0')}`;
  
  console.log(`[createQueue] ${patientType} + ${shift} => ${queueNumber} (count: ${currentCount})`);

  const dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    // Fallback to in-memory storage for development
    const queue = inMemoryStorage.addQueue({
      queue_number: queueNumber,
      patient_type: patientType,
      shift: shift,
      status: 'MENUNGGU',
      created_at: new Date().toISOString(),
    });
    return queue;
  }

  try {
    const conn = await getRawConnection();
    console.log(`[createQueue] Got raw connection, attempting insert...`);

    const [insertResult] = await conn.execute(
      'INSERT INTO queues (queue_number, patient_type, shift, status, created_at) VALUES (?, ?, ?, ?, NOW())',
      [queueNumber, patientType, shift, 'MENUNGGU']
    );

    console.log(`[createQueue] Insert result:`, insertResult);

    // Fetch the created queue
    const [queueResult] = await conn.execute(
      'SELECT * FROM queues WHERE id = LAST_INSERT_ID()'
    );

    const queue = (queueResult as any[])[0];
    console.log(`[createQueue] ✅ Inserted to database:`, queue);
    
    return {
      id: queue.id,
      queue_number: queue.queue_number,
      patient_type: queue.patient_type,
      shift: queue.shift,
      status: queue.status,
      created_at: queue.created_at,
    };
  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[createQueue] ❌ Database insert failed!');
    console.error('Queue number:', queueNumber);
    console.error('Patient type:', patientType);
    console.error('Shift:', shift);
    console.error('Error:', error);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[createQueue] Falling back to in-memory');
    
    // Fallback to in-memory if DB insert fails
    const queue = inMemoryStorage.addQueue({
      queue_number: queueNumber,
      patient_type: patientType,
      shift: shift,
      status: 'MENUNGGU',
      created_at: new Date().toISOString(),
    });

    return queue;
  }
};

// Get queues with filters - using raw MySQL connection
export const getQueues = async (filters?: {
  patientType?: 'BPJS' | 'UMUM';
  shift?: 'PAGI' | 'SIANG';
  status?: 'MENUNGGU' | 'DIPANGGIL' | 'SELESAI' | 'DILEWATI';
  limit?: number;
}): Promise<Array<{
  id: number;
  queueNumber: string;
  patientType: 'BPJS' | 'UMUM';
  shift?: 'PAGI' | 'SIANG';
  status: 'MENUNGGU' | 'DIPANGGIL' | 'SELESAI' | 'DILEWATI';
  loket?: string;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}>> => {
  const dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    // Fallback to in-memory storage for development
    const queueList = inMemoryStorage.getQueues(filters);

    return queueList.map((q) => ({
      id: q.id,
      queueNumber: q.queue_number,
      patientType: q.patient_type,
      shift: q.shift,
      status: q.status,
      createdAt: q.created_at,
      updatedAt: q.created_at,
    }));
  }

  try {
    const conn = await getRawConnection();
    if (!conn) {
      console.error('[getQueues] Failed to get raw connection');
      return [];
    }
    
    // Build WHERE clause
    const whereConditions: string[] = [];
    const values: any[] = [];

    if (filters?.patientType) {
      whereConditions.push('patient_type = ?');
      values.push(filters.patientType);
    }

    if (filters?.shift) {
      whereConditions.push('shift = ?');
      values.push(filters.shift);
    }

    if (filters?.status) {
      whereConditions.push('status = ?');
      values.push(filters.status);
    }

    let query = 'SELECT * FROM queues';
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ` LIMIT ${filters.limit}`;
    }

    console.log(`[getQueues] Executing: ${query}`);
    console.log(`[getQueues] Values:`, values);

    const [rows] = await conn.execute(query, values.length > 0 ? values : undefined);
    
    console.log(`[getQueues] Found ${(rows as any[]).length} rows`);
    
    return (rows as any[]).map(row => ({
      id: row.id,
      queueNumber: row.queue_number,
      patientType: row.patient_type,
      shift: row.shift,
      status: row.status,
      loket: row.loket,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('[getQueues] Error:', error);
    return [];
  }
};

// Call a queue
export const callQueue = async (id: number, loket?: string) => {
  const dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    inMemoryStorage.updateQueueStatus(id, 'DIPANGGIL');
    return { id };
  }

  try {
    const conn = await getRawConnection();
    await conn.execute(
      'UPDATE queues SET status = ?, loket = ? WHERE id = ?',
      ['DIPANGGIL', loket || null, id]
    );
    return { id, loket };
  } catch (error) {
    console.error('[callQueue] Error:', error);
    throw error;
  }
};

// Skip a queue
export const skipQueue = async (id: number) => {
  const dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    inMemoryStorage.updateQueueStatus(id, 'DILEWATI');
    return;
  }

  try {
    const conn = await getRawConnection();
    await conn.execute('UPDATE queues SET status = ? WHERE id = ?', ['DILEWATI', id]);
  } catch (error) {
    console.error('[skipQueue] Error:', error);
    throw error;
  }
};

// Complete a queue
export const completeQueue = async (id: number) => {
  const dbAvailable = await isDatabaseAvailable();

  if (!dbAvailable) {
    inMemoryStorage.updateQueueStatus(id, 'SELESAI');
    return;
  }

  try {
    const conn = await getRawConnection();
    await conn.execute('UPDATE queues SET status = ? WHERE id = ?', ['SELESAI', id]);
  } catch (error) {
    console.error('[completeQueue] Error:', error);
    throw error;
  }
};

// Reset queues for new day/shift
export const resetQueuesForNewShift = async () => {
  // This function would be called by a scheduled job
  // For now, the auto-reset is handled by the generateQueueNumber function
  // which checks the date when generating new numbers
  return;
};

// Check if we need to reset counters for a new day
export const checkAndResetForNewDay = async (): Promise<boolean> => {
  const dbAvailable = await isDatabaseAvailable();
  
  if (!dbAvailable) {
    // Reset in-memory storage
    inMemoryStorage.resetQueuesForNewDay();
    return true;
  }

  // Database automatically handles this via DATE(NOW()) filter
  return false;
};
