import { prisma } from './prisma';

export interface Settings {
  id: string;
  claudeModel: string;
  maxTokens: number;
  claudeCliPath: string;
  logRetentionCount: number;
  statusPollInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_SETTINGS = {
  id: 'global',
  claudeModel: 'claude-sonnet-4-5-20250514',
  maxTokens: 4096,
  claudeCliPath: '/usr/local/bin/claude',
  logRetentionCount: 100,
  statusPollInterval: 1500,
};

export async function getSettings(): Promise<Settings> {
  const settings = await prisma.settings.findUnique({
    where: { id: 'global' },
  });

  if (settings) {
    return settings;
  }

  // Create default settings if none exist
  return await prisma.settings.create({
    data: DEFAULT_SETTINGS,
  });
}

export async function updateSettings(
  data: Partial<Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Settings> {
  return await prisma.settings.upsert({
    where: { id: 'global' },
    update: data,
    create: {
      ...DEFAULT_SETTINGS,
      ...data,
    },
  });
}
