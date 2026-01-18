import { NextRequest, NextResponse } from 'next/server';
import { runAllSecurityTests } from '@/lib/security';
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

    await logSystem('INFO', 'SYSTEM', `Running security tests for: ${body.projectPath}`);

    const results = await runAllSecurityTests(body.projectPath);

    const allPassed = results.every((r) => r.passed);
    const passedCount = results.filter((r) => r.passed).length;

    await logSystem(
      allPassed ? 'INFO' : 'WARN',
      'SYSTEM',
      `Security tests completed: ${passedCount}/${results.length} passed`,
      JSON.stringify(results.map((r) => ({ name: r.name, passed: r.passed })))
    );

    return NextResponse.json({
      success: allPassed,
      results,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: results.length - passedCount,
      },
    });
  } catch (error) {
    console.error('Failed to run security tests:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    await logSystem('ERROR', 'SYSTEM', 'Security tests failed', errorMessage);

    return NextResponse.json(
      { error: 'Failed to run security tests', details: errorMessage },
      { status: 500 }
    );
  }
}
