import { NextRequest, NextResponse } from 'next/server';
import {
  getHostingConfig,
  updateHostingConfig,
  checkHostingConnection,
  HOSTING_PROVIDERS,
} from '@/lib/hosting';

export async function GET() {
  try {
    const config = await getHostingConfig();
    return NextResponse.json({ config, providers: HOSTING_PROVIDERS });
  } catch (error) {
    console.error('Failed to fetch hosting config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hosting config' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const config = await updateHostingConfig(body);

    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to update hosting config:', error);
    return NextResponse.json(
      { error: 'Failed to update hosting config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Test connection
  try {
    const config = await getHostingConfig();
    const result = await checkHostingConnection(config);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to test hosting connection:', error);
    return NextResponse.json(
      { connected: false, message: 'Connection test failed' },
      { status: 500 }
    );
  }
}
