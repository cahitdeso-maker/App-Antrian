import { NextResponse } from 'next/server';
import { getQueues } from '@/lib/queue';

// GET /api/tv/queues - Get queue data for TV display
export async function GET() {
  try {
    // Get all called queues (DIPANGGIL status)
    const calledQueues = await getQueues({
      status: 'DIPANGGIL',
      limit: 100,
    });

    // Get the most recently called queue for display
    const currentQueue = calledQueues.length > 0 ? calledQueues[0] : null;

    // Group called queues by loket
    const loketData: Record<string, any> = {
      LOKET_1: null,
      LOKET_2: null,
      LOKET_3: null,
      LOKET_4: null,
    };

    // Get the last called queue for each loket
    for (const loket of ['LOKET_1', 'LOKET_2', 'LOKET_3', 'LOKET_4']) {
      const loketQueue = calledQueues.find(q => q.loket === loket);
      loketData[loket] = loketQueue || null;
    }

    return NextResponse.json({
      success: true,
      queues: {
        current: currentQueue,
        lokets: loketData,
        allCalled: calledQueues,
      },
    });
  } catch (error) {
    console.error('Error fetching TV queues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TV queue data' },
      { status: 500 }
    );
  }
}
