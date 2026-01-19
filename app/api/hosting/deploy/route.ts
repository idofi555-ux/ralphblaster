import { NextRequest, NextResponse } from 'next/server';
import { getHostingConfig, deployProject } from '@/lib/hosting';
import { logSystem } from '@/lib/logging';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let projectPath = body.projectPath;

    // If ticketId is provided, get the project path from the ticket
    if (body.ticketId && !projectPath) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: body.ticketId },
        include: { project: true },
      });
      if (!ticket) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      }
      projectPath = ticket.project.codePath;
    }

    if (!projectPath) {
      return NextResponse.json(
        { error: 'Project path or ticket ID is required' },
        { status: 400 }
      );
    }

    const config = await getHostingConfig();

    await logSystem('INFO', 'SYSTEM', `Deploying project: ${projectPath} to ${config.provider}`);

    const result = await deployProject(projectPath, config);

    if (result.success) {
      await logSystem('INFO', 'SYSTEM', `Deployment successful${result.url ? `: ${result.url}` : ''}`);
    } else {
      await logSystem('ERROR', 'SYSTEM', 'Deployment failed', result.error);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to deploy:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    await logSystem('ERROR', 'SYSTEM', 'Deployment failed', errorMessage);

    return NextResponse.json(
      { success: false, logs: '', error: errorMessage },
      { status: 500 }
    );
  }
}
