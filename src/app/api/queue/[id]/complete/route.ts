import { NextRequest, NextResponse } from 'next/server';
import { completeQueue } from '@/lib/queue';
import { requireAuth } from '@/lib/auth-server';

// POST /api/queue/[id]/complete - Complete a queue (protected)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuth();
  if ('status' in authCheck) return authCheck;

  try {
    const { id } = await params;

    await completeQueue(parseInt(id));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error completing queue:', error);
    return NextResponse.json(
      { error: 'Failed to complete queue' },
      { status: 500 }
    );
  }
}
