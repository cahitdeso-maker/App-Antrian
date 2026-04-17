import { NextRequest, NextResponse } from 'next/server';
import { skipQueue } from '@/lib/queue';
import { requireAuth } from '@/lib/auth-server';

// POST /api/queue/[id]/skip - Skip a queue (protected)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuth();
  if ('status' in authCheck) return authCheck;

  try {
    const { id } = await params;

    await skipQueue(parseInt(id));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error skipping queue:', error);
    return NextResponse.json(
      { error: 'Failed to skip queue' },
      { status: 500 }
    );
  }
}
