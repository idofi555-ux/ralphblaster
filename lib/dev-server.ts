import { spawn, ChildProcess } from 'child_process';
import { prisma } from './prisma';
import * as net from 'net';
import * as fs from 'fs/promises';
import * as path from 'path';

// Track running processes in memory
const runningProcesses: Map<string, ChildProcess> = new Map();

// Port range for dev servers (3001-3099, avoiding 3000 which is RalphBlaster)
const PORT_RANGE_START = 3001;
const PORT_RANGE_END = 3099;

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function findAvailablePort(): Promise<number> {
  // Get ports already assigned to projects
  const projectsWithPorts = await prisma.project.findMany({
    where: { devServerPort: { not: null } },
    select: { devServerPort: true },
  });
  const usedPorts = new Set(projectsWithPorts.map((p) => p.devServerPort));

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (!usedPorts.has(port) && (await isPortAvailable(port))) {
      return port;
    }
  }

  throw new Error('No available ports in range');
}

async function detectPackageManager(projectPath: string): Promise<string> {
  try {
    await fs.access(path.join(projectPath, 'pnpm-lock.yaml'));
    return 'pnpm';
  } catch {}
  try {
    await fs.access(path.join(projectPath, 'yarn.lock'));
    return 'yarn';
  } catch {}
  try {
    await fs.access(path.join(projectPath, 'bun.lockb'));
    return 'bun';
  } catch {}
  return 'npm';
}

export async function startDevServer(projectId: string): Promise<{ port: number; url: string }> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  // Check if already running
  if (project.devServerStatus === 'RUNNING' && project.devServerPid) {
    const existingProcess = runningProcesses.get(projectId);
    if (existingProcess && !existingProcess.killed) {
      return {
        port: project.devServerPort!,
        url: `http://localhost:${project.devServerPort}`,
      };
    }
  }

  // Find available port (use existing if assigned and available)
  let port = project.devServerPort;
  if (!port || !(await isPortAvailable(port))) {
    port = await findAvailablePort();
  }

  // Update status to starting
  await prisma.project.update({
    where: { id: projectId },
    data: {
      devServerStatus: 'STARTING',
      devServerPort: port,
    },
  });

  // Detect package manager
  const pm = await detectPackageManager(project.codePath);

  // Check if dependencies are installed
  try {
    await fs.access(path.join(project.codePath, 'node_modules'));
  } catch {
    // Install dependencies first
    const installCmd = pm === 'npm' ? 'npm install' : `${pm} install`;
    await new Promise<void>((resolve, reject) => {
      const install = spawn(installCmd, [], {
        cwd: project.codePath,
        shell: true,
        stdio: 'ignore',
      });
      install.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Install failed with code ${code}`));
      });
      install.on('error', reject);
    });
  }

  // Start the dev server
  // Remove DATABASE_URL from parent env so child uses its own .env
  const childEnv = { ...process.env };
  delete childEnv.DATABASE_URL;
  delete childEnv.ANTHROPIC_API_KEY; // Don't leak API keys either

  const devCmd = pm === 'npm' ? 'npm run dev' : `${pm} run dev`;
  const child = spawn(devCmd, [], {
    cwd: project.codePath,
    shell: true,
    env: { ...childEnv, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  const pid = String(child.pid);
  runningProcesses.set(projectId, child);

  // Wait for server to be ready (check port)
  let ready = false;
  for (let i = 0; i < 60; i++) {
    // Wait up to 60 seconds
    await new Promise((r) => setTimeout(r, 1000));
    if (!(await isPortAvailable(port))) {
      ready = true;
      break;
    }
    // Check if process died
    if (child.killed || child.exitCode !== null) {
      break;
    }
  }

  if (ready) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        devServerStatus: 'RUNNING',
        devServerPid: pid,
      },
    });
    return { port, url: `http://localhost:${port}` };
  } else {
    // Failed to start
    child.kill();
    runningProcesses.delete(projectId);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        devServerStatus: 'ERROR',
        devServerPid: null,
      },
    });
    throw new Error('Failed to start dev server');
  }
}

export async function stopDevServer(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  // Kill the process from our map
  const child = runningProcesses.get(projectId);
  if (child && !child.killed) {
    child.kill('SIGTERM');
    // Give it time to cleanup
    await new Promise((r) => setTimeout(r, 1000));
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }
  runningProcesses.delete(projectId);

  // Also try to kill by PID if we have it
  if (project.devServerPid) {
    try {
      process.kill(parseInt(project.devServerPid), 'SIGTERM');
    } catch {
      // Process might already be dead
    }
  }

  // Also kill any process on the port
  if (project.devServerPort) {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      // Find and kill process on port (works on macOS/Linux)
      await execAsync(`lsof -ti:${project.devServerPort} | xargs kill -9 2>/dev/null || true`);
    } catch {
      // Ignore errors
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      devServerStatus: 'STOPPED',
      devServerPid: null,
    },
  });
}

export async function getDevServerStatus(
  projectId: string
): Promise<{ status: string; port: number | null; url: string | null }> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  // Verify the server is actually running by checking if port is in use
  if (project.devServerStatus === 'RUNNING' && project.devServerPort) {
    const portAvailable = await isPortAvailable(project.devServerPort);
    if (portAvailable) {
      // Server died, update status
      await prisma.project.update({
        where: { id: projectId },
        data: {
          devServerStatus: 'STOPPED',
          devServerPid: null,
        },
      });
      return { status: 'STOPPED', port: project.devServerPort, url: null };
    }
  }

  return {
    status: project.devServerStatus,
    port: project.devServerPort,
    url: project.devServerStatus === 'RUNNING' ? `http://localhost:${project.devServerPort}` : null,
  };
}

// Cleanup on process exit
process.on('exit', () => {
  runningProcesses.forEach((child) => {
    try {
      child.kill('SIGTERM');
    } catch {}
  });
});
