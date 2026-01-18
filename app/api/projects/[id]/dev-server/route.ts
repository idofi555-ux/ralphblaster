import { NextRequest, NextResponse } from 'next/server';
import { startDevServer, stopDevServer, getDevServerStatus } from '@/lib/dev-server';

// GET - Get dev server status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await getDevServerStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get dev server status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

// POST - Start dev server
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await startDevServer(id);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to start dev server:', error);
    const message = error instanceof Error ? error.message : 'Failed to start';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// DELETE - Stop dev server
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await stopDevServer(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to stop dev server:', error);
    return NextResponse.json(
      { error: 'Failed to stop server' },
      { status: 500 }
    );
  }
}
