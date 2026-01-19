import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!ticket) {
    return new Response(JSON.stringify({ error: 'Ticket not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropic = new Anthropic();

        const prompt = `You are a product manager creating a PRD. Generate a structured PRD for this ticket:

Title: ${ticket.title}

Description: ${ticket.description}

Project Path: ${ticket.project.codePath}

Create a PRD with these sections:
1. **Overview** - Brief summary of the feature/fix
2. **User Stories** - In format "As a [role], I want [feature], so that [benefit]"
3. **Acceptance Criteria** - Clear, testable requirements (use checkboxes)
4. **Technical Notes** - Implementation hints and considerations
5. **Out of Scope** - What this PRD explicitly does not cover

Format as clean markdown. Be specific and actionable.`;

        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;

        const messageStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        });

        messageStream.on('text', (text) => {
          fullContent += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', text })}\n\n`));
        });

        messageStream.on('message', (message) => {
          inputTokens = message.usage.input_tokens;
          outputTokens = message.usage.output_tokens;
        });

        await messageStream.finalMessage();

        // Save to database
        await prisma.ticket.update({
          where: { id },
          data: {
            prdContent: fullContent,
            prdGeneratedAt: new Date(),
          },
        });

        // Send completion with token usage
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens
        })}\n\n`));

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
