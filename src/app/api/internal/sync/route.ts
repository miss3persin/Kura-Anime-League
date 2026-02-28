import { NextResponse } from 'next/server';
import { serviceFetch } from '@/lib/service-client';

export async function POST() {
  try {
    const response = await serviceFetch('/api/sync', { method: 'GET' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Internal sync failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
