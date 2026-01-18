import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    if (!ticket.ralphInstancePath) {
      return NextResponse.json({ error: 'No Ralph instance to reject' }, { status: 400 });
    }

    // Extract branch name from instance path
    const instanceName = ticket.ralphInstancePath.split('/').pop() || '';
    const branchName = `ralph/${instanceName.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '')}`;

    try {
      // Delete the branch (optional - user might want to keep for reference)
      await execAsync(`git checkout main && git branch -D ${branchName}`, {
        cwd: ticket.project.codePath,
      }).catch(() => {
        // Ignore if branch doesn't exist or can't be deleted
      });

      // Move ticket back to UP_NEXT for re-work
      await prisma.ticket.update({
        where: { id },
        data: {
          status: 'UP_NEXT',
          ralphStatus: null,
          ralphInstancePath: null,
          ralphStartedAt: null,
          ralphCompletedAt: null,
          ralphLogs: null,
        },
      });

      return NextResponse.json({ success: true, message: 'Changes rejected, ticket moved back to Up Next' });
    } catch (error) {
      console.error('Reject error:', error);
      return NextResponse.json(
        { error: 'Failed to reject changes', details: String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Reject error:', error);
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}
