#!/usr/bin/env node
"use strict";

const SECRET = process.env.SERVICE_ROUTE_SECRET;
const BASE_URL = (process.env.DEV_REFRESH_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const INTERVAL_MS = Number(process.env.DEV_REFRESH_INTERVAL_MS || 15 * 60 * 1000);
const RUN_ONCE = process.env.DEV_REFRESH_ONCE === 'true';

if (!SECRET) {
  console.error('SERVICE_ROUTE_SECRET is required to call /api/sync/refresh');
  process.exit(1);
}

const REFRESH_ENDPOINT = `${BASE_URL}/api/sync/refresh`;

async function triggerRefresh() {
  const start = Date.now();
  try {
    console.log(`[dev-refresh] calling ${REFRESH_ENDPOINT}`);
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-secret': SECRET
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[dev-refresh] refresh failed:', response.status, payload);
    } else {
      console.log('[dev-refresh] refresh completed in', Date.now() - start, 'ms');
    }
  } catch (error) {
    console.error('[dev-refresh] request error', error);
  }
}

async function main() {
  await triggerRefresh();

  if (RUN_ONCE) return;

  console.log(`[dev-refresh] scheduling next refresh in ${INTERVAL_MS / 1000}s`);
  const timer = setInterval(() => {
    triggerRefresh().catch(() => {});
  }, INTERVAL_MS);

  process.on('SIGINT', () => {
    clearInterval(timer);
    console.log('[dev-refresh] stopped');
    process.exit(0);
  });
}

main();
