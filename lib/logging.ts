import { prisma } from './prisma';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type LogCategory = 'API' | 'RALPH' | 'SYSTEM';

export interface ApiUsageLogInput {
  type: 'PRD_GENERATION' | 'RALPH_EXECUTION';
  ticketId?: string;
  ticketTitle?: string;
  projectId?: string;
  projectName?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  logSize?: number;
  duration?: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

// Pricing per 1K tokens (approximate as of Jan 2025)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250514': { input: 0.003, output: 0.015 },
  'claude-opus-4-5-20251101': { input: 0.015, output: 0.075 },
  'claude-haiku-3-5-20241022': { input: 0.0008, output: 0.004 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model] || PRICING['claude-sonnet-4-5-20250514'];
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

export async function logSystem(
  level: LogLevel,
  category: LogCategory,
  message: string,
  details?: string
): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        category,
        message,
        details,
      },
    });
  } catch (error) {
    console.error('Failed to write system log:', error);
  }
}

export async function logApiUsage(data: ApiUsageLogInput): Promise<void> {
  try {
    await prisma.apiUsageLog.create({
      data: {
        type: data.type,
        ticketId: data.ticketId,
        ticketTitle: data.ticketTitle,
        projectId: data.projectId,
        projectName: data.projectName,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        estimatedCost: data.estimatedCost,
        logSize: data.logSize,
        duration: data.duration,
        status: data.status,
        errorMessage: data.errorMessage,
      },
    });
  } catch (error) {
    console.error('Failed to write API usage log:', error);
  }
}

export async function getSystemLogs(options?: {
  level?: LogLevel;
  category?: LogCategory;
  limit?: number;
  offset?: number;
}) {
  const { level, category, limit = 100, offset = 0 } = options || {};

  return await prisma.systemLog.findMany({
    where: {
      ...(level && { level }),
      ...(category && { category }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getApiUsageLogs(options?: {
  type?: 'PRD_GENERATION' | 'RALPH_EXECUTION';
  limit?: number;
  offset?: number;
}) {
  const { type, limit = 100, offset = 0 } = options || {};

  return await prisma.apiUsageLog.findMany({
    where: {
      ...(type && { type }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

export async function getUsageSummary() {
  const logs = await prisma.apiUsageLog.findMany();

  const summary = {
    totalApiCalls: logs.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedTotalCost: 0,
    byType: {} as Record<string, { count: number; cost: number }>,
  };

  for (const log of logs) {
    summary.totalInputTokens += log.inputTokens || 0;
    summary.totalOutputTokens += log.outputTokens || 0;
    summary.estimatedTotalCost += log.estimatedCost || 0;

    if (!summary.byType[log.type]) {
      summary.byType[log.type] = { count: 0, cost: 0 };
    }
    summary.byType[log.type].count++;
    summary.byType[log.type].cost += log.estimatedCost || 0;
  }

  return summary;
}
