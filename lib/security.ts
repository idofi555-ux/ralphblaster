import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from './prisma';

const execAsync = promisify(exec);

export interface SecurityTest {
  id: string;
  name: string;
  command: string;
  description: string | null;
  enabled: boolean;
  order: number;
}

export interface TestResult {
  testId: string;
  name: string;
  passed: boolean;
  output: string;
  duration: number;
}

export async function getSecurityTests(): Promise<SecurityTest[]> {
  return await prisma.securityTest.findMany({
    orderBy: { order: 'asc' },
  });
}

export async function createSecurityTest(data: {
  name: string;
  command: string;
  description?: string;
}): Promise<SecurityTest> {
  const maxOrder = await prisma.securityTest.aggregate({
    _max: { order: true },
  });

  return await prisma.securityTest.create({
    data: {
      name: data.name,
      command: data.command,
      description: data.description,
      order: (maxOrder._max.order || 0) + 1,
    },
  });
}

export async function updateSecurityTest(
  id: string,
  data: Partial<Omit<SecurityTest, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<SecurityTest> {
  return await prisma.securityTest.update({
    where: { id },
    data,
  });
}

export async function deleteSecurityTest(id: string): Promise<void> {
  await prisma.securityTest.delete({
    where: { id },
  });
}

export async function runSecurityTest(
  test: SecurityTest,
  projectPath: string
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(test.command, {
      cwd: projectPath,
      timeout: 300000, // 5 minute timeout
      maxBuffer: 1024 * 1024 * 10, // 10MB
    });

    return {
      testId: test.id,
      name: test.name,
      passed: true,
      output: stdout || stderr || 'Test passed with no output',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      testId: test.id,
      name: test.name,
      passed: false,
      output: err.stderr || err.stdout || err.message || 'Test failed',
      duration: Date.now() - startTime,
    };
  }
}

export async function runAllSecurityTests(
  projectPath: string
): Promise<TestResult[]> {
  const tests = await prisma.securityTest.findMany({
    where: { enabled: true },
    orderBy: { order: 'asc' },
  });

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await runSecurityTest(test, projectPath);
    results.push(result);

    // Stop on first failure if desired (optional)
    // if (!result.passed) break;
  }

  return results;
}

// Preset security tests
export const PRESET_TESTS = [
  {
    name: 'npm audit',
    command: 'npm audit --audit-level=moderate',
    description: 'Check for vulnerable dependencies',
  },
  {
    name: 'Secret Detection',
    command: 'npx gitleaks detect --source . --no-git',
    description: 'Scan for hardcoded secrets and API keys',
  },
  {
    name: 'ESLint Security',
    command: 'npx eslint . --ext .js,.jsx,.ts,.tsx',
    description: 'Run ESLint for code quality and security rules',
  },
  {
    name: 'TypeScript Check',
    command: 'npx tsc --noEmit',
    description: 'Ensure no TypeScript errors',
  },
];
