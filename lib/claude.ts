import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

async function checkClaudeInstalled(): Promise<boolean> {
  try {
    await execAsync('which claude');
    return true;
  } catch {
    return false;
  }
}

export async function generatePRD(
  ticket: { title: string; description: string },
  projectPath: string
): Promise<string> {
  const isInstalled = await checkClaudeInstalled();
  if (!isInstalled) {
    throw new ClaudeError(
      'Claude CLI is not installed or not in PATH',
      'NOT_INSTALLED',
      'Install Claude CLI: npm install -g @anthropic-ai/claude-code'
    );
  }

  const prompt = buildPRDPrompt(ticket, projectPath);

  try {
    const result = await runClaudeCommand(prompt);

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

    if (errorMessage.includes('ENOENT')) {
      throw new ClaudeError(
        'Claude CLI not found',
        'NOT_FOUND',
        'Claude CLI binary could not be executed'
      );
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      throw new ClaudeError(
        'PRD generation timed out',
        'TIMEOUT',
        'The request took too long. Try simplifying the ticket description.'
      );
    }

    if (errorMessage.includes('SIGTERM') || errorMessage.includes('SIGKILL')) {
      throw new ClaudeError(
        'PRD generation was interrupted',
        'INTERRUPTED',
        'The process was terminated unexpectedly'
      );
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      throw new ClaudeError(
        'Rate limit exceeded',
        'RATE_LIMIT',
        'Too many requests. Please wait a moment and try again.'
      );
    }

    if (errorMessage.includes('API key') || errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      throw new ClaudeError(
        'Authentication failed',
        'AUTH_ERROR',
        'Check that your Claude API key is configured correctly'
      );
    }

    throw new ClaudeError(
      'PRD generation failed',
      'UNKNOWN',
      errorMessage
    );
  }
}

async function runClaudeCommand(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const escapedPrompt = prompt
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');

    const child = spawn('claude', ['--print', escapedPrompt], {
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, 300000);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      if (timedOut) {
        reject(new Error('timeout'));
      } else if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });
  });
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
