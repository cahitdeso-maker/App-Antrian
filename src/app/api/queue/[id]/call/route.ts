import { NextRequest, NextResponse } from 'next/server';
import { callQueue, getQueues } from '@/lib/queue';
import { requireAuth } from '@/lib/auth-server';

// POST /api/queue/[id]/call - Call a queue (protected)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuth();
  if ('status' in authCheck) return authCheck;

  try {
    const { id } = await params;
    const queueId = parseInt(id);

    await callQueue(queueId);

    const queues = await getQueues();
    const queue = queues.find(q => q.id === queueId);

    if (!queue) {
      return NextResponse.json(
        { error: 'Queue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      queue,
    });
  } catch (error) {
    console.error('Error calling queue:', error);
    return NextResponse.json(
      { error: 'Failed to call queue' },
      { status: 500 }
    );
  }
}
