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
  onProgress: (log: string) => void
): Promise<void> {
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
      ['--dangerously-skip-permissions', '--print', prompt],
      {
        cwd: workDir,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0' },
      }
    );

    // Store for potential cancellation
    activeProcesses.set(ticketId, { kill: () => ralph.kill('SIGTERM') });

    let stdoutBuffer = '';
    let stderrBuffer = '';

    ralph.stdout.on('data', async (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;
      onProgress(chunk);
      await appendLog(instance.instancePath, chunk.trim());
    });

    ralph.stderr.on('data', async (data) => {
      const chunk = data.toString();
      stderrBuffer += chunk;
      onProgress(`[stderr] ${chunk}`);
    });

    ralph.on('close', async (code) => {
      activeProcesses.delete(ticketId);

      if (code === 0) {
        await updateProgress(instance.instancePath, {
          status: 'COMPLETED',
          phase: 'Done',
          message: 'Implementation completed successfully!',
          timestamp: new Date().toISOString(),
          logs: [],
        });
        resolve();
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
