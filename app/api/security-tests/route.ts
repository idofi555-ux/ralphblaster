import { NextRequest, NextResponse } from 'next/server';
import {
  getSecurityTests,
  createSecurityTest,
  updateSecurityTest,
  deleteSecurityTest,
  PRESET_TESTS,
} from '@/lib/security';

export async function GET() {
  try {
    const tests = await getSecurityTests();
    return NextResponse.json({ tests, presets: PRESET_TESTS });
  } catch (error) {
    console.error('Failed to fetch security tests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security tests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.command) {
      return NextResponse.json(
        { error: 'Name and command are required' },
        { status: 400 }
      );
    }

    const test = await createSecurityTest({
      name: body.name,
      command: body.command,
      description: body.description,
    });

    return NextResponse.json(test);
  } catch (error) {
    console.error('Failed to create security test:', error);
    return NextResponse.json(
      { error: 'Failed to create security test' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Test ID is required' },
        { status: 400 }
      );
    }

    const { id, ...data } = body;
    const test = await updateSecurityTest(id, data);

    return NextResponse.json(test);
  } catch (error) {
    console.error('Failed to update security test:', error);
    return NextResponse.json(
      { error: 'Failed to update security test' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Test ID is required' },
        { status: 400 }
      );
    }

    await deleteSecurityTest(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete security test:', error);
    return NextResponse.json(
      { error: 'Failed to delete security test' },
      { status: 500 }
    );
  }
}
