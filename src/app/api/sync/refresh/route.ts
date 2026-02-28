import { NextResponse } from 'next/server';
import { requireServiceSecret } from '@/lib/service-auth';
import { runRefreshCycle } from '@/lib/refreshCycle';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const unauthorized = requireServiceSecret(request);
  if (unauthorized) {
    return unauthorized;
  }

  const initiator = request.headers.get('x-refresh-initiator') ?? 'service';
  try {
    const result = await runRefreshCycle(initiator);
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    console.error('Refresh cycle failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to /api/sync/refresh with the service secret to trigger the cache refresh.' });
}
