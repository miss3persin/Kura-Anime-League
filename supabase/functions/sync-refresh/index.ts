import { serve } from 'https://deno.land/std@0.216.0/http/server.ts';

const SERVICE_SECRET = Deno.env.get('SERVICE_ROUTE_SECRET');
const BASE_URL = (Deno.env.get('REFRESH_BASE_URL') ?? '').replace(/\/$/, '');

if (!SERVICE_SECRET) {
  console.error('SERVICE_ROUTE_SECRET is required');
}

const endpoint = `${BASE_URL || 'https://your-site.com'}/api/sync/refresh`;

serve(async () => {
  if (!SERVICE_SECRET) {
    return new Response('SERVICE_ROUTE_SECRET is not configured', { status: 500 });
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': SERVICE_SECRET
      }
    });

    const payload = await res.text();
    return new Response(payload, { status: res.status });
  } catch (error) {
    return new Response(`Refresh failed: ${(error as Error).message}`, { status: 500 });
  }
});
