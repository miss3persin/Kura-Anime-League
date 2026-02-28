import { NextResponse } from 'next/server';

const SERVICE_SECRET = process.env.SERVICE_ROUTE_SECRET;

export function requireServiceSecret(request: Request) {
  if (!SERVICE_SECRET) {
    console.error('SERVICE_ROUTE_SECRET is not configured; service endpoints are offline.');
    return NextResponse.json({ error: 'Service secret is not configured' }, { status: 500 });
  }

  const headerSecret =
    request.headers.get('x-kal-service-secret') ??
    request.headers.get('x-service-secret');

  if (headerSecret !== SERVICE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
