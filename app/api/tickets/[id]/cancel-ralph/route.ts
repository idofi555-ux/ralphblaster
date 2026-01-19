import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cancelRalph } from '@/lib/ralph';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Try to cancel the running process
    const cancelled = cancelRalph(id);

    // Update ticket status
    await prisma.ticket.update({
      where: { id },
      data: {
        ralphStatus: 'FAILED',
        ralphCompletedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      cancelled,
      message: cancelled ? 'Ralph process cancelled' : 'No active process found',
    });
  } catch (error) {
    console.error('Failed to cancel Ralph:', error);
    return NextResponse.json(
      { error: 'Failed to cancel Ralph' },
      { status: 500 }
    );
  }
}
