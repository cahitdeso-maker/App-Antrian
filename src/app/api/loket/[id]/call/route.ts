import { NextRequest, NextResponse } from 'next/server';
import { callQueue } from '@/lib/queue';

// POST /api/loket/[id]/call - Call a queue to a specific loket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Optional: Add auth check later if needed
    // For now, allow any authenticated request
    
    const { id } = await params;
    const queueId = parseInt(id);
    
    if (isNaN(queueId)) {
      return NextResponse.json(
        { error: 'Invalid queue ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { loket } = body;

    if (!loket || !['LOKET_1', 'LOKET_2', 'LOKET_3', 'LOKET_4'].includes(loket)) {
      return NextResponse.json(
        { error: 'Valid loket is required (LOKET_1, LOKET_2, LOKET_3, or LOKET_4)' },
        { status: 400 }
      );
    }

    // Call the queue (mark as DIPANGGIL) with loket info
    await callQueue(queueId, loket);

    // Return success with loket info
    return NextResponse.json({
      success: true,
      message: `${loket} memanggil antrian ${queueId}`,
      queueId,
      loket,
    });
  } catch (error) {
    console.error('Error calling queue to loket:', error);
    return NextResponse.json(
      { error: 'Failed to call queue to loket' },
      { status: 500 }
    );
  }
}
