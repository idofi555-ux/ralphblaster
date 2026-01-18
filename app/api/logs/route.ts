import { NextRequest, NextResponse } from 'next/server';
import { getSystemLogs, LogLevel, LogCategory } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const level = searchParams.get('level') as LogLevel | null;
    const category = searchParams.get('category') as LogCategory | null;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const logs = await getSystemLogs({
      level: level || undefined,
      category: category || undefined,
      limit,
      offset,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch system logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system logs' },
      { status: 500 }
    );
  }
}
