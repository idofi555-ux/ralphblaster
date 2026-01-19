import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRalphInstance, createWorktree, executeRalph, cleanupRalphInstance } from '@/lib/ralph';
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

    // Check if Claude CLI is available (required for Ralph execution)
    const cliAvailable = await isClaudeCliAvailable();
    if (!cliAvailable) {
      return NextResponse.json(
        {
          error: 'Ralph requires Claude CLI',
          details: 'Ralph execution requires running the app locally with Claude CLI installed. Run locally with: npm run dev'
        },
        { status: 400 }
      );
    }

    // Get settings for model configuration
    const settings = await prisma.settings.findUnique({
      where: { id: 'global' },
    });
    const model = settings?.claudeModel || 'claude-sonnet-4-5-20250514';

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!ticket || !ticket.prdContent) {
      return NextResponse.json(
        { error: 'Ticket not found or PRD not generated' },
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

    // Create Ralph instance
    const instance = await createRalphInstance(
      { id: ticket.id, title: ticket.title, prdContent: ticket.prdContent },
      ticket.project.codePath
    );

    // Try to create worktree for isolated development
    const { worktreePath, branchName } = await createWorktree(
      instance,
      ticket.project.codePath
    );
    instance.worktreePath = worktreePath;
    instance.branchName = branchName;

    // Update ticket status
    await prisma.ticket.update({
      where: { id },
      data: {
        ralphInstancePath: instance.instancePath,
        ralphStatus: 'LAUNCHING',
        ralphStartedAt: new Date(),
        ralphLogs: '',
        status: 'IN_PROGRESS',
      },
    });

    // Start Ralph execution (async - don't await)
    executeRalph(instance, ticket.project.codePath, id, async (log) => {
      // Append logs to the ticket (debounced to reduce DB writes)
      try {
        const currentTicket = await prisma.ticket.findUnique({
          where: { id },
          select: { ralphLogs: true, ralphStatus: true },
        });

        // Don't update if already completed/failed (avoid race condition)
        if (currentTicket?.ralphStatus === 'COMPLETED' || currentTicket?.ralphStatus === 'FAILED') {
          return;
        }

        const currentLogs = currentTicket?.ralphLogs || '';
        // Keep logs under 50KB to avoid DB issues
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
    }, model)
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
      instancePath: instance.instancePath,
      worktreePath: instance.worktreePath,
      branchName: instance.branchName,
    });
  } catch (error) {
    console.error('Ralph start error:', error);
    return NextResponse.json(
      { error: 'Failed to start Ralph' },
      { status: 500 }
    );
  }
}
