import { NextResponse } from 'next/server';
import { serviceFetch } from '@/lib/service-client';

export async function GET() {
  try {
    const response = await serviceFetch('/api/hype', { method: 'GET', cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: payload?.error ?? 'Failed to refresh hype data' }, { status: response.status });
    }
    return NextResponse.json({ success: true, detail: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
