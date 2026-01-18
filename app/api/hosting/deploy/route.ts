import { NextRequest, NextResponse } from 'next/server';
import { getHostingConfig, deployProject } from '@/lib/hosting';
import { logSystem } from '@/lib/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.projectPath) {
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    const config = await getHostingConfig();

    await logSystem('INFO', 'SYSTEM', `Deploying project: ${body.projectPath} to ${config.provider}`);

    const result = await deployProject(body.projectPath, config);

    if (result.success) {
      await logSystem('INFO', 'SYSTEM', `Deployment successful${result.url ? `: ${result.url}` : ''}`);
    } else {
      await logSystem('ERROR', 'SYSTEM', 'Deployment failed', result.error);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to deploy:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    await logSystem('ERROR', 'SYSTEM', 'Deployment failed', errorMessage);

    return NextResponse.json(
      { success: false, logs: '', error: errorMessage },
      { status: 500 }
    );
  }
}
