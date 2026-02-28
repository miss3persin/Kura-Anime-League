import { logApiRateLimit } from '@/lib/apiRateLimit';

const KITSU_BASE_URL = 'https://kitsu.io/api/edge';

interface KitsuRateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
}

interface KitsuFetchOptions {
  endpoint: string;
  params?: Record<string, string>;
}

async function kitsuFetch(path: string, options: KitsuFetchOptions) {
  const url = new URL(`${KITSU_BASE_URL}/${path}`);
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.api+json',
    },
  });

  const body = await response.json();
  const rateLimit = parseKitsuRateLimit(response.headers);

  await logApiRateLimit({
    source: 'Kitsu',
    endpoint: options.endpoint,
    status: response.status,
    success: response.ok,
    limit: rateLimit.limit,
    remaining: rateLimit.remaining,
    resetAt: rateLimit.reset ? new Date(rateLimit.reset * 1000).toISOString() : null,
    message: response.ok ? 'ok' : body.errors?.[0]?.detail,
    metadata: {
      path,
      params: options.params ?? null,
    },
  });

  if (!response.ok) {
    throw new Error(body.errors?.[0]?.detail || 'Kitsu fetch failed');
  }

  return body;
}

function parseKitsuRateLimit(headers: Headers): KitsuRateLimitInfo {
  const limit = Number(headers.get('x-ratelimit-limit'));
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  const reset = Number(headers.get('x-ratelimit-reset'));

  return {
    limit: Number.isNaN(limit) ? undefined : limit,
    remaining: Number.isNaN(remaining) ? undefined : remaining,
    reset: Number.isNaN(reset) ? undefined : reset,
  };
}

export async function searchKitsuAnime(query: string) {
  if (!query) return null;
  const sanitized = query.replace(/[^a-zA-Z0-9\s:-]/g, ' ').trim();
  if (!sanitized) return null;

  const payload = await kitsuFetch('anime', {
    endpoint: 'kitsu-search',
    params: {
      'filter[text]': sanitized,
      'page[limit]': '1',
    },
  });

  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    return null;
  }

  return payload.data[0];
}

export async function fetchKitsuAnimeById(kitsuId: number) {
  const payload = await kitsuFetch(`anime/${kitsuId}`, {
    endpoint: 'kitsu-anime-detail',
  });
  return payload.data;
}

export function mapKitsuStatus(raw: string | null | undefined) {
  switch (raw?.toLowerCase()) {
    case 'current':
    case 'airing':
      return 'RELEASING';
    case 'upcoming':
    case 'tba':
      return 'NOT_YET_RELEASED';
    case 'hiatus':
      return 'HIATUS';
    case 'finished':
      return 'FINISHED';
    default:
      return 'FINISHED';
  }
}

interface KitsuAnimeRecord {
  id: string;
  attributes: {
    averageRating: string | null;
    popularityRank: number | null;
    nextRelease: string | null;
    status: string | null;
  };
}

export function normalizeKitsuStatus(record: KitsuAnimeRecord, id: number) {
  const attributes = record?.attributes;
  if (!attributes) return null;

  const averageRating = attributes.averageRating ? Math.round(Number(attributes.averageRating)) : null;
  const popularity = attributes.popularityRank ? Math.max(0, 1000 - Number(attributes.popularityRank)) : null;
  const nextRelease = attributes.nextRelease ? Math.floor(new Date(attributes.nextRelease).getTime() / 1000) : undefined;

  const status = mapKitsuStatus(attributes.status);

  return {
    id,
    status,
    averageScore: averageRating,
    popularity,
    trending: 0,
    nextAiringEpisode: nextRelease ? { airingAt: nextRelease } : undefined,
    source: 'Kitsu' as const,
  };
}
