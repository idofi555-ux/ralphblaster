import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Track running test servers: ticketId -> { port, pid, projectPath }
const runningServers = new Map<string, { port: number; pid: number; projectPath: string }>();

// Find an available port starting from base
async function findAvailablePort(basePort: number): Promise<number> {
  for (let port = basePort; port < basePort + 100; port++) {
    try {
      await execAsync(`lsof -i :${port}`);
      // Port is in use, try next
    } catch {
      // Port is available
      return port;
    }
  }
  throw new Error('No available ports found');
}

// Extract branch name from Ralph instance path
function getBranchName(ralphInstancePath: string): string {
  const instanceName = ralphInstancePath.split('/').pop() || '';
  // Match the pattern: name-YYYY-MM-DDTHH-MM-SS-SSSZ (remove only the milliseconds and Z)
  // Instance: design-change-2026-01-18T16-32-39-539Z
  // Branch:   ralph/design-change-2026-01-18T16-32-39
  return `ralph/${instanceName.replace(/-\d{3}Z$/, '')}`;
}

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
      return NextResponse.json({ error: 'No Ralph changes to test' }, { status: 400 });
    }

    const ticketId = ticket.id;
    const projectPath = ticket.project.codePath;
    const branchName = getBranchName(ticket.ralphInstancePath);

    // Check if server is already running for this ticket
    const existing = runningServers.get(ticketId);
    if (existing) {
      // Verify it's still running
      try {
        process.kill(existing.pid, 0);
        return NextResponse.json({
          url: `http://localhost:${existing.port}`,
          port: existing.port,
          branch: branchName,
          status: 'already_running',
        });
      } catch {
        // Process is dead, clean up
        runningServers.delete(ticketId);
      }
    }

    // Verify the project path exists
    try {
      await execAsync(`test -d "${projectPath}"`);
    } catch {
      return NextResponse.json(
        { error: 'Project not found', details: `Path does not exist: ${projectPath}` },
        { status: 400 }
      );
    }

    // Checkout the Ralph branch in the main project
    try {
      // First prune any stale worktrees
      await execAsync('git worktree prune', { cwd: projectPath });
      // Checkout the branch
      await execAsync(`git checkout "${branchName}"`, { cwd: projectPath });
    } catch (gitError) {
      console.error('Git checkout error:', gitError);
      return NextResponse.json(
        { error: 'Failed to checkout branch', details: String(gitError) },
        { status: 500 }
      );
    }

    // Find available port (start from 3001 to avoid conflict with RalphBlaster on 3000)
    const port = await findAvailablePort(3001);

    // Check if node_modules exists, if not run npm install
    try {
      await execAsync('test -d node_modules', { cwd: projectPath });
    } catch {
      console.log('Installing dependencies...');
      await execAsync('npm install', { cwd: projectPath, timeout: 120000 });
    }

    // Start the dev server
    const logPath = `/tmp/test-server-${ticketId}.log`;
    const fs = await import('fs');
    const logFd = fs.openSync(logPath, 'w');

    // Clear npm-related env vars that might cause issues
    const cleanEnv = { ...process.env };
    delete cleanEnv.npm_config_prefix;
    delete cleanEnv.npm_package_json;
    delete cleanEnv.npm_lifecycle_event;
    delete cleanEnv.npm_lifecycle_script;
    delete cleanEnv.INIT_CWD;

    const serverProcess = spawn('/bin/bash', ['-c', `cd "${projectPath}" && npm run dev -- --port ${port}`], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...cleanEnv, PORT: String(port) },
    });

    serverProcess.unref();

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Find the actual PID of the next process
    let pid: number | null = null;
    try {
      const { stdout } = await execAsync(`lsof -t -i :${port} -sTCP:LISTEN`);
      pid = parseInt(stdout.trim(), 10);
    } catch {
      // Process might not be running
    }

    // Verify the server actually started
    let serverReady = false;
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(`http://localhost:${port}`, {
          signal: AbortSignal.timeout(2000)
        });
        if (response.ok) {
          serverReady = true;
          break;
        }
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!serverReady) {
      // Check logs for error
      let logs = '';
      try {
        const { stdout } = await execAsync(`tail -20 /tmp/test-server-${ticketId}.log`);
        logs = stdout;
      } catch {}
      return NextResponse.json(
        { error: 'Server failed to start', details: logs || 'Check logs for details' },
        { status: 500 }
      );
    }

    // Store the running server info
    if (pid) {
      runningServers.set(ticketId, { port, pid, projectPath });
    }

    return NextResponse.json({
      url: `http://localhost:${port}`,
      port,
      pid,
      branch: branchName,
      status: 'started',
      message: `Dev server started on port ${port} with branch ${branchName}`,
    });
  } catch (error) {
    console.error('Test server error:', error);
    return NextResponse.json(
      { error: 'Failed to start test server', details: String(error) },
      { status: 500 }
    );
  }
}

// Stop server endpoint
export async function DELETE(
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

    const existing = runningServers.get(ticket.id);
    if (existing) {
      try {
        process.kill(existing.pid, 'SIGTERM');
      } catch {
        // Process might already be dead
      }
      runningServers.delete(ticket.id);

      // Checkout main branch after stopping
      try {
        await execAsync('git checkout main', { cwd: existing.projectPath });
      } catch {
        // Ignore checkout errors
      }
    }

    return NextResponse.json({ success: true, message: 'Server stopped' });
  } catch (error) {
    console.error('Stop server error:', error);
    return NextResponse.json({ error: 'Failed to stop server' }, { status: 500 });
  }
}
