import { NextRequest, NextResponse } from 'next/server';
import { getApiUsageLogs, getUsageSummary } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const summary = searchParams.get('summary') === 'true';
    const type = searchParams.get('type') as 'PRD_GENERATION' | 'RALPH_EXECUTION' | null;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (summary) {
      const usageSummary = await getUsageSummary();
      return NextResponse.json(usageSummary);
    }

    const logs = await getApiUsageLogs({
      type: type || undefined,
      limit,
      offset,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch usage logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage logs' },
      { status: 500 }
    );
  }
}
