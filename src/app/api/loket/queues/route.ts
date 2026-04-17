import { NextRequest, NextResponse } from 'next/server';
import { getQueues } from '@/lib/queue';

// GET /api/loket/queues - Get queues for loket management
export async function GET(request: NextRequest) {
  try {
    // Get all waiting and called queues
    const waitingQueues = await getQueues({
      status: 'MENUNGGU',
      limit: 50,
    });

    const calledQueues = await getQueues({
      status: 'DIPANGGIL',
      limit: 50,
    });

    // Count queues by patient type
    const bpjsCount = waitingQueues.filter(q => q.patientType === 'BPJS').length;
    const umumCount = waitingQueues.filter(q => q.patientType === 'UMUM').length;

    return NextResponse.json({
      success: true,
      queues: {
        waiting: waitingQueues,
        called: calledQueues,
        stats: {
          bpjs: bpjsCount,
          umum: umumCount,
          total: waitingQueues.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching loket queues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loket queues' },
      { status: 500 }
    );
  }
}
