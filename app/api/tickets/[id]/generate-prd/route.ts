import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePRD, ClaudeError } from '@/lib/claude';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const prdContent = await generatePRD(
      { title: ticket.title, description: ticket.description },
      ticket.project.codePath
    );

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        prdContent,
        prdGeneratedAt: new Date(),
      },
    });

    return NextResponse.json(updatedTicket);
  } catch (error) {
    console.error('PRD generation error:', error);

    if (error instanceof ClaudeError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.code === 'RATE_LIMIT' ? 429 : 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate PRD' },
      { status: 500 }
    );
  }
}
