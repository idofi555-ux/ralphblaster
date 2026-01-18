import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProgress, getProgressLogs } from '@/lib/ralph';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encoder = new TextEncoder();
  let isActive = true;
  let lastLogLength = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = async () => {
        if (!isActive) return;

        try {
          const ticket = await prisma.ticket.findUnique({
            where: { id },
            select: {
              ralphStatus: true,
              ralphLogs: true,
              ralphInstancePath: true,
              ralphStartedAt: true,
              ralphCompletedAt: true,
            },
          });

          if (!ticket) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Ticket not found' })}\n\n`));
            controller.close();
            return;
          }

          // Try to get detailed progress from instance path
          let progress = null;
          let progressLogs = '';
          if (ticket.ralphInstancePath) {
            progress = await getProgress(ticket.ralphInstancePath);
            progressLogs = await getProgressLogs(ticket.ralphInstancePath);
          }

          // Calculate duration
          let duration = null;
          if (ticket.ralphStartedAt) {
            const endTime = ticket.ralphCompletedAt || new Date();
            duration = Math.floor((endTime.getTime() - ticket.ralphStartedAt.getTime()) / 1000);
          }

          // Only send new logs to reduce bandwidth
          const currentLogs = ticket.ralphLogs || progressLogs || '';
          const newLogs = currentLogs.slice(lastLogLength);
          lastLogLength = currentLogs.length;

          const data = JSON.stringify({
            status: ticket.ralphStatus,
            phase: progress?.phase || (ticket.ralphStatus === 'RUNNING' ? 'Executing' : ticket.ralphStatus),
            message: progress?.message || '',
            logs: newLogs || undefined, // Only include if there are new logs
            fullLogs: lastLogLength === currentLogs.length ? undefined : currentLogs, // Include full on first request
            duration,
            timestamp: new Date().toISOString(),
          });

          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Stop streaming if Ralph is complete or failed
          if (ticket.ralphStatus === 'COMPLETED' || ticket.ralphStatus === 'FAILED') {
            // Send one final update with complete status
            setTimeout(() => {
              isActive = false;
              controller.close();
            }, 500);
            return;
          }

          // Poll every 1.5 seconds for more responsive updates
          setTimeout(sendUpdate, 1500);
        } catch (error) {
          console.error('SSE error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
          controller.close();
        }
      };

      // Send initial update immediately
      sendUpdate();
    },
    cancel() {
      isActive = false;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
