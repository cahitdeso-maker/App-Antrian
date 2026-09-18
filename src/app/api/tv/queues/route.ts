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

    // Sort by last call time (updated_at) DESC so 'current' reflects the
    // most recently CALLED queue, not the most recently CREATED one.
    // This matters for "Panggil Ulang" where an older queue number is
    // re-called and its updated_at becomes the newest.
    const sortedCalled = [...calledQueues].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );

    // Get the most recently called queue for display
    const currentQueue = sortedCalled.length > 0 ? sortedCalled[0] : null;

    // Group called queues by loket
    const loketData: Record<string, any> = {
      LOKET_1: null,
      LOKET_2: null,
      LOKET_3: null,
      LOKET_4: null,
    };

    // Get the last called queue for each loket
    for (const loket of ['LOKET_1', 'LOKET_2', 'LOKET_3', 'LOKET_4']) {
      const loketQueue = sortedCalled.find(q => q.loket === loket);
      loketData[loket] = loketQueue || null;
    }

    return NextResponse.json({
      success: true,
      // The hospital SERVER's current time (ISO). The TV clock syncs to this
      // so the display always follows the server clock, regardless of the
      // device's own (possibly wrong) local time.
      serverTime: new Date().toISOString(),
      queues: {
        current: currentQueue,
        lokets: loketData,
        allCalled: sortedCalled,
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
