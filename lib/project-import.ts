import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { prisma } from './prisma';

const execAsync = promisify(exec);

export interface ProjectInfo {
  name: string;
  path: string;
  type: ProjectType;
  gitUrl?: string;
  hasPackageJson: boolean;
  hasTsConfig: boolean;
  framework?: string;
}

export type ProjectType = 'nextjs' | 'react' | 'node' | 'unknown';

export async function detectProjectType(projectPath: string): Promise<ProjectInfo> {
  const info: ProjectInfo = {
    name: path.basename(projectPath),
    path: projectPath,
    type: 'unknown',
    hasPackageJson: false,
    hasTsConfig: false,
  };

  try {
    // Check for package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      info.hasPackageJson = true;
      info.name = packageJson.name || info.name;

      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Detect framework
      if (deps['next']) {
        info.type = 'nextjs';
        info.framework = 'Next.js';
      } else if (deps['react']) {
        info.type = 'react';
        info.framework = 'React';
      } else if (packageJson.main || deps['express'] || deps['fastify']) {
        info.type = 'node';
        info.framework = 'Node.js';
      }
    } catch {
      // No package.json
    }

    // Check for tsconfig
    try {
      await fs.access(path.join(projectPath, 'tsconfig.json'));
      info.hasTsConfig = true;
    } catch {
      // No tsconfig
    }

    // Check for git remote
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: projectPath });
      info.gitUrl = stdout.trim();
    } catch {
      // Not a git repo or no remote
    }

    return info;
  } catch (error) {
    console.error('Error detecting project type:', error);
    return info;
  }
}

export async function importFromLocal(localPath: string): Promise<ProjectInfo> {
  // Validate path exists
  try {
    const stats = await fs.stat(localPath);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }
  } catch (error) {
    throw new Error(`Invalid path: ${localPath}`);
  }

  return await detectProjectType(localPath);
}

export async function importFromGit(
  gitUrl: string,
  targetPath: string,
  branch?: string
): Promise<ProjectInfo> {
  // Extract repo name from URL
  const repoName = gitUrl.split('/').pop()?.replace('.git', '') || 'project';
  const clonePath = path.join(targetPath, repoName);

  // Check if directory already exists
  try {
    await fs.access(clonePath);
    // Directory exists - check if it's a valid git repo with the same remote
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: clonePath });
      if (stdout.trim() === gitUrl || stdout.trim() === gitUrl.replace(/\.git$/, '')) {
        // Same repo, just use existing directory
        const info = await detectProjectType(clonePath);
        info.gitUrl = gitUrl;
        return info;
      }
    } catch {
      // Not a git repo or different remote
    }
    throw new Error(`Directory already exists: ${clonePath}. Remove it first or import as local folder.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  // Clone the repository
  // Only specify branch if explicitly provided, otherwise use repo's default
  const branchArg = branch && branch !== 'default' ? `--branch ${branch}` : '';
  await execAsync(`git clone ${branchArg} ${gitUrl} "${clonePath}"`, {
    timeout: 300000, // 5 minute timeout
  });

  const info = await detectProjectType(clonePath);
  info.gitUrl = gitUrl;

  return info;
}

export async function createProjectFromImport(
  info: ProjectInfo,
  color?: string
): Promise<{ id: string; name: string }> {
  const project = await prisma.project.create({
    data: {
      name: info.name,
      codePath: info.path,
      gitUrl: info.gitUrl,
      color: color || '#3B82F6',
      importedAt: new Date(),
    },
  });

  return { id: project.id, name: project.name };
}

export async function getBranches(gitUrl: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`git ls-remote --heads ${gitUrl}`, {
      timeout: 30000,
    });

    const branches = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/refs\/heads\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    return branches;
  } catch {
    return ['main', 'master']; // Default branches if ls-remote fails
  }
}
