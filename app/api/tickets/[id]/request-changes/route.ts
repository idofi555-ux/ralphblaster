import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeRalphChanges, RalphInstance } from '@/lib/ralph';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function isClaudeCliAvailable(): Promise<boolean> {
  try {
    await execAsync('which claude');
    return true;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { changeRequest } = body;

    if (!changeRequest || typeof changeRequest !== 'string') {
      return NextResponse.json(
        { error: 'Change request is required' },
        { status: 400 }
      );
    }

    // Check if Claude CLI is available
    const cliAvailable = await isClaudeCliAvailable();
    if (!cliAvailable) {
      return NextResponse.json(
        {
          error: 'Ralph requires Claude CLI',
          details: 'Ralph execution requires running the app locally with Claude CLI installed.'
        },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    if (!ticket.ralphInstancePath) {
      return NextResponse.json(
        { error: 'No Ralph instance exists for this ticket' },
        { status: 400 }
      );
    }

    if (!ticket.prdContent) {
      return NextResponse.json(
        { error: 'No PRD content found' },
        { status: 400 }
      );
    }

    // Check if Ralph is already running
    if (ticket.ralphStatus === 'LAUNCHING' || ticket.ralphStatus === 'RUNNING') {
      return NextResponse.json(
        { error: 'Ralph is already running for this ticket' },
        { status: 400 }
      );
    }

    // Extract worktree path and branch from existing instance
    const instanceName = ticket.ralphInstancePath.split('/').pop() || '';
    const branchName = `ralph/${instanceName.replace(/-\d{3}Z$/, '')}`;
    const worktreePath = `${ticket.ralphInstancePath}/worktree`;

    // Create instance object from existing data
    const instance: RalphInstance = {
      instancePath: ticket.ralphInstancePath,
      ticketSlug: instanceName.replace(/-\d{4}-\d{2}-\d{2}T.*$/, ''),
      timestamp: new Date().toISOString(),
      worktreePath,
      branchName,
    };

    // Update ticket status
    await prisma.ticket.update({
      where: { id },
      data: {
        ralphStatus: 'RUNNING',
        ralphLogs: (ticket.ralphLogs || '') + `\n\n=== CHANGE REQUEST ===\n${changeRequest}\n\n`,
        status: 'IN_PROGRESS',
      },
    });

    // Start Ralph execution with change request (async - don't await)
    executeRalphChanges(
      instance,
      ticket.project.codePath,
      id,
      changeRequest,
      ticket.prdContent,
      async (log) => {
        try {
          const currentTicket = await prisma.ticket.findUnique({
            where: { id },
            select: { ralphLogs: true },
          });

          const currentLogs = currentTicket?.ralphLogs || '';
          const truncatedLogs = currentLogs.length > 50000
            ? currentLogs.slice(-40000)
            : currentLogs;

          await prisma.ticket.update({
            where: { id },
            data: {
              ralphLogs: truncatedLogs + log,
              ralphStatus: 'RUNNING',
            },
          });
        } catch (err) {
          console.error('Failed to update logs:', err);
        }
      }
    )
      .then(async () => {
        await prisma.ticket.update({
          where: { id },
          data: {
            ralphStatus: 'COMPLETED',
            ralphCompletedAt: new Date(),
            status: 'IN_TESTING',
          },
        });
      })
      .catch(async (error) => {
        const currentTicket = await prisma.ticket.findUnique({
          where: { id },
          select: { ralphLogs: true },
        });

        await prisma.ticket.update({
          where: { id },
          data: {
            ralphStatus: 'FAILED',
            ralphLogs: (currentTicket?.ralphLogs || '') + `\n\n=== FAILED ===\n${error.message}`,
          },
        });
      });

    return NextResponse.json({
      success: true,
      message: 'Ralph is implementing the requested changes',
    });
  } catch (error) {
    console.error('Request changes error:', error);
    return NextResponse.json(
      { error: 'Failed to request changes', details: String(error) },
      { status: 500 }
    );
  }
}
