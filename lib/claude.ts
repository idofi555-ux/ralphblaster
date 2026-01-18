import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export class ClaudeError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: string
  ) {
    super(message);
    this.name = 'ClaudeError';
  }
}

export async function generatePRD(
  ticket: { title: string; description: string },
  projectPath: string
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeError(
      'Anthropic API key not configured',
      'NOT_CONFIGURED',
      'Set ANTHROPIC_API_KEY environment variable'
    );
  }

  const prompt = buildPRDPrompt(ticket, projectPath);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new ClaudeError(
        'Unexpected response type',
        'INVALID_RESPONSE',
        'Expected text response from Claude'
      );
    }

    const result = content.text;

    if (!result || result.trim().length === 0) {
      throw new ClaudeError(
        'Claude returned empty response',
        'EMPTY_RESPONSE',
        'The PRD generation completed but returned no content'
      );
    }

    return result;
  } catch (error) {
    if (error instanceof ClaudeError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      throw new ClaudeError(
        'Rate limit exceeded',
        'RATE_LIMIT',
        'Too many requests. Please wait a moment and try again.'
      );
    }

    if (errorMessage.includes('authentication') || errorMessage.includes('401') || errorMessage.includes('invalid_api_key')) {
      throw new ClaudeError(
        'Authentication failed',
        'AUTH_ERROR',
        'Check that your ANTHROPIC_API_KEY is configured correctly'
      );
    }

    if (errorMessage.includes('overloaded') || errorMessage.includes('529')) {
      throw new ClaudeError(
        'Service temporarily overloaded',
        'OVERLOADED',
        'Claude is experiencing high demand. Please try again in a moment.'
      );
    }

    throw new ClaudeError(
      'PRD generation failed',
      'UNKNOWN',
      errorMessage
    );
  }
}

function buildPRDPrompt(
  ticket: { title: string; description: string },
  projectPath: string
): string {
  return `You are a product manager creating a PRD. Generate a structured PRD for this ticket:

Title: ${ticket.title}

Description: ${ticket.description}

Project Path: ${projectPath}

Create a PRD with these sections:
1. **Overview** - Brief summary of the feature/fix
2. **User Stories** - In format "As a [role], I want [feature], so that [benefit]"
3. **Acceptance Criteria** - Clear, testable requirements (use checkboxes)
4. **Technical Notes** - Implementation hints and considerations
5. **Out of Scope** - What this PRD explicitly does not cover

Format as clean markdown. Be specific and actionable.`;
}
