// In-memory storage for development mode (when database is not available)

interface QueueEntry {
  id: number;
  queue_number: string;
  patient_type: 'BPJS' | 'UMUM';
  shift: 'PAGI' | 'SIANG';
  status: 'MENUNGGU' | 'DIPANGGIL' | 'SELESAI' | 'DILEWATI';
  created_at: string;
}

class InMemoryStorage {
  private queues: QueueEntry[] = [];
  private queueCounters: Map<string, number> = new Map();
  private static instance: InMemoryStorage;

  private constructor() {}

  static getInstance(): InMemoryStorage {
    if (!InMemoryStorage.instance) {
      InMemoryStorage.instance = new InMemoryStorage();
    }
    return InMemoryStorage.instance;
  }

  addQueue(queue: Omit<QueueEntry, 'id'>): QueueEntry {
    const newQueue = {
      ...queue,
      id: Date.now(),
    };
    this.queues.push(newQueue);
    return newQueue;
  }

  getQueues(filters?: {
    patientType?: 'BPJS' | 'UMUM';
    shift?: 'PAGI' | 'SIANG';
    status?: 'MENUNGGU' | 'DIPANGGIL' | 'SELESAI' | 'DILEWATI';
    limit?: number;
  }): QueueEntry[] {
    let result = [...this.queues];

    if (filters?.patientType) {
      result = result.filter(q => q.patient_type === filters.patientType);
    }

    if (filters?.shift) {
      result = result.filter(q => q.shift === filters.shift);
    }

    if (filters?.status) {
      result = result.filter(q => q.status === filters.status);
    }

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (filters?.limit) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }

  updateQueueStatus(id: number, status: QueueEntry['status']): boolean {
    const index = this.queues.findIndex(q => q.id === id);
    if (index !== -1) {
      this.queues[index].status = status;
      return true;
    }
    return false;
  }

  getNextQueueNumber(patientType: 'BPJS' | 'UMUM', shift: 'PAGI' | 'SIANG'): number {
    const today = new Date().toDateString();
    const key = `${patientType}-${shift}-${today}`;
    
    // Get or initialize counter for this combination
    const currentCount = this.queueCounters.get(key) || 0;
    const nextNumber = currentCount + 1;
    
    // Update counter
    this.queueCounters.set(key, nextNumber);
    
    return nextNumber;
  }

  resetQueuesForNewDay(): void {
    // Clear queues and counters for new day
    this.queues = [];
    this.queueCounters.clear();
  }
}

export const inMemoryStorage = InMemoryStorage.getInstance();
