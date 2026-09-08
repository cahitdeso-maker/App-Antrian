import { NextRequest, NextResponse } from 'next/server';
import { createQueue, getQueues, getCurrentShift } from '@/lib/queue';

// POST /api/queue - Create a new queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientType } = body;

    if (!patientType) {
      return NextResponse.json(
        { error: 'patientType is required' },
        { status: 400 }
      );
    }

    if (!['BPJS', 'UMUM'].includes(patientType)) {
      return NextResponse.json(
        { error: 'patientType must be BPJS or UMUM' },
        { status: 400 }
      );
    }

    // Shift is NOT chosen by the visitor anymore. It is determined
    // automatically by the current time when the visitor prints the number
    // (Pagi 05:00-12:00, Siang mulai 12:01). We always use server time.
    const shift = getCurrentShift();

    const queue = await createQueue(patientType, shift);

    return NextResponse.json({
      success: true,
      queueNumber: queue.queue_number,
      shift,
      queue,
    });
  } catch (error) {
    console.error('Error creating queue:', error);
    return NextResponse.json(
      { error: 'Failed to create queue: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

// GET /api/queue - Get queues with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const filters = {
      patientType: searchParams.get('patientType') as 'BPJS' | 'UMUM' | undefined,
      shift: searchParams.get('shift') as 'PAGI' | 'SIANG' | undefined,
      status: searchParams.get('status') as 'MENUNGGU' | 'DIPANGGIL' | 'SELESAI' | 'DILEWATI' | undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    };

    const queues = await getQueues(filters);

    return NextResponse.json({
      success: true,
      queues,
    });
  } catch (error) {
    console.error('Error fetching queues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queues' },
      { status: 500 }
    );
  }
}
