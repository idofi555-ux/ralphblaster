import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from './prisma';

const execAsync = promisify(exec);

export interface HostingConfig {
  id: string;
  provider: string;
  cliPath: string | null;
  projectToken: string | null;
  autoDeployBranch: string | null;
}

export interface DeployResult {
  success: boolean;
  url?: string;
  logs: string;
  error?: string;
}

const DEFAULT_CONFIG: Omit<HostingConfig, 'id'> = {
  provider: 'railway',
  cliPath: null,
  projectToken: null,
  autoDeployBranch: 'main',
};

export async function getHostingConfig(): Promise<HostingConfig> {
  const config = await prisma.hostingConfig.findUnique({
    where: { id: 'global' },
  });

  if (config) {
    return config;
  }

  return await prisma.hostingConfig.create({
    data: {
      id: 'global',
      ...DEFAULT_CONFIG,
    },
  });
}

export async function updateHostingConfig(
  data: Partial<Omit<HostingConfig, 'id'>>
): Promise<HostingConfig> {
  return await prisma.hostingConfig.upsert({
    where: { id: 'global' },
    update: data,
    create: {
      id: 'global',
      ...DEFAULT_CONFIG,
      ...data,
    },
  });
}

export async function checkHostingConnection(
  config: HostingConfig
): Promise<{ connected: boolean; message: string }> {
  if (!config.cliPath) {
    return { connected: false, message: 'CLI path not configured' };
  }

  try {
    switch (config.provider) {
      case 'railway': {
        await execAsync(`${config.cliPath} whoami`, { timeout: 10000 });
        return { connected: true, message: 'Connected to Railway' };
      }
      case 'vercel': {
        await execAsync(`${config.cliPath} whoami`, { timeout: 10000 });
        return { connected: true, message: 'Connected to Vercel' };
      }
      default:
        return { connected: true, message: 'Manual deployment configured' };
    }
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return {
      connected: false,
      message: err.stderr || err.message || 'Connection failed',
    };
  }
}

export async function deployProject(
  projectPath: string,
  config: HostingConfig
): Promise<DeployResult> {
  if (!config.cliPath) {
    return {
      success: false,
      logs: '',
      error: 'CLI path not configured',
    };
  }

  try {
    let command: string;
    const env = { ...process.env };

    switch (config.provider) {
      case 'railway': {
        if (config.projectToken) {
          env.RAILWAY_TOKEN = config.projectToken;
        }
        command = `${config.cliPath} up --detach`;
        break;
      }
      case 'vercel': {
        if (config.projectToken) {
          env.VERCEL_TOKEN = config.projectToken;
        }
        command = `${config.cliPath} --prod --yes`;
        break;
      }
      default:
        return {
          success: false,
          logs: '',
          error: `Unknown provider: ${config.provider}`,
        };
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: projectPath,
      env,
      timeout: 600000, // 10 minute timeout
      maxBuffer: 1024 * 1024 * 50, // 50MB
    });

    const logs = stdout + (stderr ? `\n${stderr}` : '');

    // Try to extract deployment URL from output
    const urlMatch = logs.match(/https:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : undefined;

    return {
      success: true,
      url,
      logs,
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      logs: err.stdout || '',
      error: err.stderr || err.message || 'Deployment failed',
    };
  }
}

export const HOSTING_PROVIDERS = [
  { id: 'railway', name: 'Railway', cliName: 'railway' },
  { id: 'vercel', name: 'Vercel', cliName: 'vercel' },
  { id: 'manual', name: 'Manual', cliName: null },
];
