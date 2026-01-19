import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface RalphInstance {
  instancePath: string;
  ticketSlug: string;
  timestamp: string;
  worktreePath?: string;
  branchName?: string;
}

export interface RalphProgress {
  status: 'LAUNCHING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  phase: string;
  message: string;
  timestamp: string;
  logs: string[];
}

export interface RalphReport {
  success: boolean;
  durationMs: number;
  totalCostUsd: number;
  numTurns: number;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  summary: string;
}

// Store active Ralph processes for cancellation
const activeProcesses = new Map<string, { kill: () => void }>();

export async function createRalphInstance(
  ticket: { id: string; title: string; prdContent: string },
  projectPath: string
): Promise<RalphInstance> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ticketSlug = ticket.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50);
  const instanceName = `${ticketSlug}-${timestamp}`;
  const instancePath = path.join(process.cwd(), 'ralph-instances', instanceName);

  // Create instance directory
  await fs.mkdir(instancePath, { recursive: true });

  // Write PRD
  await fs.writeFile(path.join(instancePath, 'source-prd.md'), ticket.prdContent);

  // Initialize progress file
  const initialProgress: RalphProgress = {
    status: 'LAUNCHING',
    phase: 'Initialization',
    message: 'Creating Ralph instance...',
    timestamp: new Date().toISOString(),
    logs: [`[${new Date().toISOString()}] Ralph instance created: ${instanceName}`],
  };
  await fs.writeFile(
    path.join(instancePath, 'progress.json'),
    JSON.stringify(initialProgress, null, 2)
  );

  // Write human-readable progress log
  await fs.writeFile(
    path.join(instancePath, 'progress.md'),
    `# Ralph Progress Log\nInstance: ${instanceName}\nCreated: ${new Date().toISOString()}\n\n## Log\n`
  );

  return { instancePath, ticketSlug, timestamp };
}

export async function createWorktree(
  instance: RalphInstance,
  projectPath: string
): Promise<{ worktreePath: string; branchName: string }> {
  const branchName = `ralph/${instance.ticketSlug}-${instance.timestamp.slice(0, 19)}`;
  const worktreePath = path.join(instance.instancePath, 'worktree');

  try {
    // Check if we're in a git repo
    await execAsync('git rev-parse --is-inside-work-tree', { cwd: projectPath });

    // Create worktree with new branch
    await execAsync(
      `git worktree add "${worktreePath}" -b "${branchName}"`,
      { cwd: projectPath }
    );

    await appendLog(instance.instancePath, `Created git worktree: ${branchName}`);

    return { worktreePath, branchName };
  } catch (error) {
    await appendLog(instance.instancePath, `Note: Could not create worktree, working directly in project`);
    return { worktreePath: projectPath, branchName: '' };
  }
}

export async function executeRalph(
  instance: RalphInstance,
  projectPath: string,
  ticketId: string,
  onProgress: (log: string) => void,
  model: string = 'claude-sonnet-4-5-20250514'
): Promise<RalphReport> {
  // Determine working directory (worktree or project)
  const workDir = instance.worktreePath || projectPath;

  await updateProgress(instance.instancePath, {
    status: 'RUNNING',
    phase: 'Execution',
    message: 'Claude is implementing the PRD...',
    timestamp: new Date().toISOString(),
    logs: [],
  });

  return new Promise((resolve, reject) => {
    const prompt = `You are Ralph, an autonomous coding agent. Your task is to implement the PRD.

PRD Location: ${instance.instancePath}/source-prd.md
Working Directory: ${workDir}
Progress Log: ${instance.instancePath}/progress.md

Instructions:
1. Read the PRD file carefully
2. Implement each requirement step by step
3. Write tests for each feature when appropriate
4. Commit after each completed task with a descriptive message
5. Append progress updates to the progress.md file

IMPORTANT:
- Work incrementally, completing one task at a time
- Test your changes before moving to the next task
- If you encounter errors, debug and fix them
- Update progress.md with your current status

Begin implementation now.`;

    const ralph = spawn(
      'claude',
      [
        '--dangerously-skip-permissions',
        '-p', '-',  // Read prompt from stdin
        '--output-format', 'stream-json',
        '--verbose',  // Required for stream-json
        '--model', model,
      ],
      {
        cwd: workDir,
        shell: false,
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // Send prompt via stdin
    ralph.stdin.write(prompt);
    ralph.stdin.end();

    // Store for potential cancellation
    activeProcesses.set(ticketId, { kill: () => ralph.kill('SIGTERM') });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let lineBuffer = '';
    let report: RalphReport | null = null;

    // Create debug log file for raw output
    const debugLogPath = path.join(instance.instancePath, 'debug.log');
    const appendDebugLog = async (msg: string) => {
      try {
        await fs.appendFile(debugLogPath, `[${new Date().toISOString()}] ${msg}\n`);
      } catch (e) {
        console.error('Failed to write debug log:', e);
      }
    };

    appendDebugLog('Ralph process started');
    appendDebugLog(`Working directory: ${workDir}`);

    ralph.stdout.on('data', async (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;
      lineBuffer += chunk;

      // Log raw output for debugging
      appendDebugLog(`[stdout] ${chunk}`);

      // Process complete lines (stream-json outputs newline-delimited JSON)
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          let logMessage = '';

          // Parse different event types
          if (event.type === 'system') {
            logMessage = `🚀 Session started (model: ${event.model || 'unknown'})`;
          } else if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_use') {
                const toolName = block.name || 'Unknown';
                const input = block.input || {};

                // Create readable progress message
                if (toolName === 'Edit') {
                  logMessage = `📝 Editing: ${input.file_path?.split('/').pop() || 'file'}`;
                } else if (toolName === 'Write') {
                  logMessage = `✍️ Writing: ${input.file_path?.split('/').pop() || 'file'}`;
                } else if (toolName === 'Read') {
                  logMessage = `📖 Reading: ${input.file_path?.split('/').pop() || 'file'}`;
                } else if (toolName === 'Bash') {
                  const cmd = input.command?.slice(0, 60) || 'command';
                  logMessage = `🖥️ Running: ${cmd}${input.command?.length > 60 ? '...' : ''}`;
                } else if (toolName === 'Glob' || toolName === 'Grep') {
                  logMessage = `🔍 Searching: ${input.pattern || 'pattern'}`;
                } else if (toolName === 'TodoWrite') {
                  logMessage = `📋 Updating task list`;
                } else {
                  logMessage = `🔧 ${toolName}`;
                }
              } else if (block.type === 'text' && block.text) {
                // Claude's thinking/response text
                const text = block.text.slice(0, 100);
                logMessage = `💭 ${text}${block.text.length > 100 ? '...' : ''}`;
              }
            }
          } else if (event.type === 'result') {
            const cost = event.total_cost_usd ? `$${event.total_cost_usd.toFixed(4)}` : '';
            const tokens = event.usage ? `${event.usage.input_tokens + event.usage.output_tokens} tokens` : '';
            logMessage = `✅ Completed ${cost} ${tokens}`.trim();

            // Build report from result event
            report = {
              success: !event.is_error,
              durationMs: event.duration_ms || 0,
              totalCostUsd: event.total_cost_usd || 0,
              numTurns: event.num_turns || 0,
              model: Object.keys(event.modelUsage || {})[0] || 'unknown',
              usage: {
                inputTokens: event.usage?.input_tokens || 0,
                outputTokens: event.usage?.output_tokens || 0,
                cacheReadTokens: event.usage?.cache_read_input_tokens || 0,
                cacheCreationTokens: event.usage?.cache_creation_input_tokens || 0,
              },
              summary: event.result || '',
            };
          }

          if (logMessage) {
            onProgress(logMessage + '\n');
            await appendLog(instance.instancePath, logMessage);
          }
        } catch {
          // Not JSON, just log raw output
          if (line.trim()) {
            onProgress(line + '\n');
            await appendLog(instance.instancePath, line.trim());
          }
        }
      }
    });

    ralph.stderr.on('data', async (data) => {
      const chunk = data.toString();
      stderrBuffer += chunk;
      appendDebugLog(`[stderr] ${chunk}`);
      appendLog(instance.instancePath, `[error] ${chunk.trim()}`);
      onProgress(`[stderr] ${chunk}`);
    });

    ralph.on('close', async (code) => {
      activeProcesses.delete(ticketId);

      if (code === 0 && report) {
        // Write report to file
        const reportPath = path.join(instance.instancePath, 'report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        // Write human-readable report
        const reportMdPath = path.join(instance.instancePath, 'report.md');
        const reportMd = `# Ralph Execution Report

## Summary
- **Status**: ${report.success ? '✅ Success' : '❌ Failed'}
- **Model**: ${report.model}
- **Duration**: ${Math.round(report.durationMs / 1000)}s
- **Cost**: $${report.totalCostUsd.toFixed(4)}
- **Turns**: ${report.numTurns}

## Token Usage
- **Input**: ${report.usage.inputTokens.toLocaleString()}
- **Output**: ${report.usage.outputTokens.toLocaleString()}
- **Cache Read**: ${report.usage.cacheReadTokens.toLocaleString()}
- **Cache Creation**: ${report.usage.cacheCreationTokens.toLocaleString()}
- **Total**: ${(report.usage.inputTokens + report.usage.outputTokens).toLocaleString()}

## Result
${report.summary}
`;
        await fs.writeFile(reportMdPath, reportMd);

        await updateProgress(instance.instancePath, {
          status: 'COMPLETED',
          phase: 'Done',
          message: 'Implementation completed successfully!',
          timestamp: new Date().toISOString(),
          logs: [],
        });
        resolve(report);
      } else {
        await updateProgress(instance.instancePath, {
          status: 'FAILED',
          phase: 'Error',
          message: `Ralph exited with code ${code}`,
          timestamp: new Date().toISOString(),
          logs: [],
        });
        reject(new Error(`Ralph exited with code ${code}`));
      }
    });

    ralph.on('error', async (error) => {
      activeProcesses.delete(ticketId);
      await updateProgress(instance.instancePath, {
        status: 'FAILED',
        phase: 'Error',
        message: `Failed to start Ralph: ${error.message}`,
        timestamp: new Date().toISOString(),
        logs: [],
      });
      reject(new Error(`Failed to start Ralph: ${error.message}`));
    });
  });
}

export function cancelRalph(ticketId: string): boolean {
  const process = activeProcesses.get(ticketId);
  if (process) {
    process.kill();
    activeProcesses.delete(ticketId);
    return true;
  }
  return false;
}

export async function executeRalphChanges(
  instance: RalphInstance,
  projectPath: string,
  ticketId: string,
  changeRequest: string,
  prdContent: string,
  onProgress: (log: string) => void,
  model: string = 'claude-sonnet-4-5-20250514'
): Promise<RalphReport> {
  // Determine working directory (worktree or project)
  const workDir = instance.worktreePath || projectPath;

  // Write the change request to the instance directory
  await fs.writeFile(
    path.join(instance.instancePath, 'change-request.md'),
    `# Change Request\n\n${changeRequest}\n\n---\n\n## Original PRD\n\n${prdContent}`
  );

  await updateProgress(instance.instancePath, {
    status: 'RUNNING',
    phase: 'Changes',
    message: 'Claude is implementing requested changes...',
    timestamp: new Date().toISOString(),
    logs: [`[${new Date().toISOString()}] Received change request: ${changeRequest.slice(0, 100)}...`],
  });

  return new Promise((resolve, reject) => {
    const prompt = `You are Ralph, an autonomous coding agent. The user has tested your implementation and is requesting changes.

CHANGE REQUEST:
${changeRequest}

ORIGINAL PRD: ${instance.instancePath}/source-prd.md
Working Directory: ${workDir}
Progress Log: ${instance.instancePath}/progress.md

Instructions:
1. Review the change request carefully
2. Look at the current implementation to understand what was built
3. Make the requested changes precisely
4. Test your changes to ensure they work
5. Commit with a descriptive message about the changes

IMPORTANT:
- Focus only on the requested changes
- Don't refactor or change things that weren't requested
- Be precise and targeted with your modifications
- Update progress.md with what changes you made

Begin implementing the requested changes now.`;

    const ralph = spawn(
      'claude',
      [
        '--dangerously-skip-permissions',
        '-p', '-',  // Read prompt from stdin
        '--output-format', 'stream-json',
        '--verbose',  // Required for stream-json
        '--model', model,
      ],
      {
        cwd: workDir,
        shell: false,
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // Send prompt via stdin
    ralph.stdin.write(prompt);
    ralph.stdin.end();

    // Store for potential cancellation
    activeProcesses.set(ticketId, { kill: () => ralph.kill('SIGTERM') });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let report: RalphReport | null = null;
    let lineBuffer = '';

    // Create debug log file for raw output
    const debugLogPath = path.join(instance.instancePath, 'debug.log');
    const appendDebugLog = async (msg: string) => {
      try {
        await fs.appendFile(debugLogPath, `[${new Date().toISOString()}] ${msg}\n`);
      } catch (e) {
        console.error('Failed to write debug log:', e);
      }
    };

    appendDebugLog('Ralph process started');
    appendDebugLog(`Working directory: ${workDir}`);

    ralph.stdout.on('data', async (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;
      lineBuffer += chunk;

      // Log raw output for debugging
      appendDebugLog(`[stdout] ${chunk}`);

      // Process complete lines (stream-json outputs newline-delimited JSON)
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          let logMessage = '';

          // Parse different event types
          if (event.type === 'system') {
            logMessage = `🚀 Session started (model: ${event.model || 'unknown'})`;
          } else if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_use') {
                const toolName = block.name || 'Unknown';
                const input = block.input || {};

                // Create readable progress message
                if (toolName === 'Edit') {
                  logMessage = `📝 Editing: ${input.file_path?.split('/').pop() || 'file'}`;
                } else if (toolName === 'Write') {
                  logMessage = `✍️ Writing: ${input.file_path?.split('/').pop() || 'file'}`;
                } else if (toolName === 'Read') {
                  logMessage = `📖 Reading: ${input.file_path?.split('/').pop() || 'file'}`;
                } else if (toolName === 'Bash') {
                  const cmd = input.command?.slice(0, 60) || 'command';
                  logMessage = `🖥️ Running: ${cmd}${input.command?.length > 60 ? '...' : ''}`;
                } else if (toolName === 'Glob' || toolName === 'Grep') {
                  logMessage = `🔍 Searching: ${input.pattern || 'pattern'}`;
                } else if (toolName === 'TodoWrite') {
                  logMessage = `📋 Updating task list`;
                } else {
                  logMessage = `🔧 ${toolName}`;
                }
              } else if (block.type === 'text' && block.text) {
                // Claude's thinking/response text
                const text = block.text.slice(0, 100);
                logMessage = `💭 ${text}${block.text.length > 100 ? '...' : ''}`;
              }
            }
          } else if (event.type === 'result') {
            const cost = event.total_cost_usd ? `$${event.total_cost_usd.toFixed(4)}` : '';
            const tokens = event.usage ? `${event.usage.input_tokens + event.usage.output_tokens} tokens` : '';
            logMessage = `✅ Completed ${cost} ${tokens}`.trim();

            // Build report from result event
            report = {
              success: !event.is_error,
              durationMs: event.duration_ms || 0,
              totalCostUsd: event.total_cost_usd || 0,
              numTurns: event.num_turns || 0,
              model: Object.keys(event.modelUsage || {})[0] || 'unknown',
              usage: {
                inputTokens: event.usage?.input_tokens || 0,
                outputTokens: event.usage?.output_tokens || 0,
                cacheReadTokens: event.usage?.cache_read_input_tokens || 0,
                cacheCreationTokens: event.usage?.cache_creation_input_tokens || 0,
              },
              summary: event.result || '',
            };
          }

          if (logMessage) {
            onProgress(logMessage + '\n');
            await appendLog(instance.instancePath, logMessage);
          }
        } catch {
          // Not JSON, just log raw output
          if (line.trim()) {
            onProgress(line + '\n');
            await appendLog(instance.instancePath, line.trim());
          }
        }
      }
    });

    ralph.stderr.on('data', async (data) => {
      const chunk = data.toString();
      stderrBuffer += chunk;
      appendDebugLog(`[stderr] ${chunk}`);
      appendLog(instance.instancePath, `[error] ${chunk.trim()}`);
      onProgress(`[stderr] ${chunk}`);
    });

    ralph.on('close', async (code) => {
      activeProcesses.delete(ticketId);

      if (code === 0 && report) {
        // Write report to file
        const reportPath = path.join(instance.instancePath, 'report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        // Write human-readable report
        const reportMdPath = path.join(instance.instancePath, 'report.md');
        const reportMd = `# Ralph Changes Report

## Summary
- **Status**: ${report.success ? '✅ Success' : '❌ Failed'}
- **Model**: ${report.model}
- **Duration**: ${Math.round(report.durationMs / 1000)}s
- **Cost**: $${report.totalCostUsd.toFixed(4)}
- **Turns**: ${report.numTurns}

## Token Usage
- **Input**: ${report.usage.inputTokens.toLocaleString()}
- **Output**: ${report.usage.outputTokens.toLocaleString()}
- **Cache Read**: ${report.usage.cacheReadTokens.toLocaleString()}
- **Cache Creation**: ${report.usage.cacheCreationTokens.toLocaleString()}
- **Total**: ${(report.usage.inputTokens + report.usage.outputTokens).toLocaleString()}

## Result
${report.summary}
`;
        await fs.writeFile(reportMdPath, reportMd);

        await updateProgress(instance.instancePath, {
          status: 'COMPLETED',
          phase: 'Done',
          message: 'Changes implemented successfully!',
          timestamp: new Date().toISOString(),
          logs: [],
        });
        resolve(report);
      } else {
        await updateProgress(instance.instancePath, {
          status: 'FAILED',
          phase: 'Error',
          message: `Ralph exited with code ${code}`,
          timestamp: new Date().toISOString(),
          logs: [],
        });
        reject(new Error(`Ralph exited with code ${code}`));
      }
    });

    ralph.on('error', async (error) => {
      activeProcesses.delete(ticketId);
      await updateProgress(instance.instancePath, {
        status: 'FAILED',
        phase: 'Error',
        message: `Failed to start Ralph: ${error.message}`,
        timestamp: new Date().toISOString(),
        logs: [],
      });
      reject(new Error(`Failed to start Ralph: ${error.message}`));
    });
  });
}

export async function getProgress(instancePath: string): Promise<RalphProgress | null> {
  try {
    const progressFile = path.join(instancePath, 'progress.json');
    const content = await fs.readFile(progressFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function getProgressLogs(instancePath: string): Promise<string> {
  try {
    const logsFile = path.join(instancePath, 'progress.md');
    return await fs.readFile(logsFile, 'utf-8');
  } catch {
    return '';
  }
}

async function updateProgress(instancePath: string, progress: Partial<RalphProgress>) {
  try {
    const progressFile = path.join(instancePath, 'progress.json');
    let existing: RalphProgress = {
      status: 'RUNNING',
      phase: '',
      message: '',
      timestamp: new Date().toISOString(),
      logs: [],
    };

    try {
      const content = await fs.readFile(progressFile, 'utf-8');
      existing = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    const updated = {
      ...existing,
      ...progress,
      logs: [...existing.logs, ...(progress.logs || [])],
    };

    await fs.writeFile(progressFile, JSON.stringify(updated, null, 2));
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

async function appendLog(instancePath: string, message: string) {
  if (!message.trim()) return;

  try {
    const logsFile = path.join(instancePath, 'progress.md');
    const timestamp = new Date().toISOString();
    await fs.appendFile(logsFile, `\n[${timestamp}] ${message}`);

    // Also update JSON logs
    const progressFile = path.join(instancePath, 'progress.json');
    try {
      const content = await fs.readFile(progressFile, 'utf-8');
      const progress = JSON.parse(content);
      progress.logs.push(`[${timestamp}] ${message}`);
      // Keep last 100 logs
      if (progress.logs.length > 100) {
        progress.logs = progress.logs.slice(-100);
      }
      await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
    } catch {
      // Ignore if progress.json doesn't exist
    }
  } catch (error) {
    console.error('Failed to append log:', error);
  }
}

export async function cleanupRalphInstance(
  instancePath: string,
  projectPath: string
): Promise<void> {
  try {
    // Check if there's a worktree to remove
    const worktreePath = path.join(instancePath, 'worktree');
    try {
      await fs.access(worktreePath);
      // Remove worktree from git
      await execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: projectPath });
    } catch {
      // No worktree or already removed
    }

    // Remove instance directory
    await fs.rm(instancePath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to cleanup Ralph instance: ${error}`);
  }
}
