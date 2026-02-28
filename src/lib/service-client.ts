const HOST = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SERVICE_SECRET = process.env.SERVICE_ROUTE_SECRET;

function buildHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  if (SERVICE_SECRET) {
    headers.set('x-kal-service-secret', SERVICE_SECRET);
  } else {
    console.warn('SERVICE_ROUTE_SECRET is missing; service calls will be rejected.');
  }
  return headers;
}

export async function serviceFetch(path: string, init?: RequestInit) {
  if (!SERVICE_SECRET) {
    throw new Error('SERVICE_ROUTE_SECRET is required to call service endpoints.');
  }

  const url = path.startsWith('http') ? path : `${HOST}${path}`;
  const headers = buildHeaders(init?.headers);
  return fetch(url, { ...init, headers, cache: init?.cache ?? 'no-store' });
}
