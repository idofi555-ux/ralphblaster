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
      return NextResponse.json({ error: 'No Ralph instance to merge' }, { status: 400 });
    }

    // Extract branch name from instance path
    const instanceName = ticket.ralphInstancePath.split('/').pop() || '';
    const branchName = `ralph/${instanceName.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '')}`;

    try {
      // Merge the branch into main
      await execAsync(`git checkout main && git merge ${branchName} --no-edit`, {
        cwd: ticket.project.codePath,
      });

      // Update ticket status to COMPLETED
      await prisma.ticket.update({
        where: { id },
        data: {
          status: 'COMPLETED',
        },
      });

      return NextResponse.json({ success: true, message: 'Branch merged successfully' });
    } catch (gitError) {
      console.error('Git merge error:', gitError);
      return NextResponse.json(
        { error: 'Failed to merge branch', details: String(gitError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Merge error:', error);
    return NextResponse.json({ error: 'Failed to merge' }, { status: 500 });
  }
}
