import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'catamaker-api',
    ts: new Date().toISOString(),
  });
}
