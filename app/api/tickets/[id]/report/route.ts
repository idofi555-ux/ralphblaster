import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function GET(
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

    if (!ticket.ralphInstancePath) {
      return NextResponse.json({ error: 'No Ralph instance' }, { status: 400 });
    }

    // Try to read report.json
    const reportPath = path.join(ticket.ralphInstancePath, 'report.json');
    try {
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);
      return NextResponse.json(report);
    } catch {
      // No report yet
      return NextResponse.json({ error: 'Report not available yet' }, { status: 404 });
    }
  } catch (error) {
    console.error('Get report error:', error);
    return NextResponse.json(
      { error: 'Failed to get report', details: String(error) },
      { status: 500 }
    );
  }
}
