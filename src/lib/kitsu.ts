import { logApiRateLimit } from '@/lib/apiRateLimit';

const KITSU_BASE_URL = 'https://kitsu.io/api/edge';

interface KitsuRateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
}

interface KitsuFetchOptions {
  params?: Record<string, string>;
  endpoint: string;
}

async function kitsuFetch(path: string, options: KitsuFetchOptions) {
  const url = new URL(`${KITSU_BASE_URL}/${path}`);
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
        },
      });

      const body = await response.json() as { data?: unknown; errors?: { detail: string }[] };
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      const isNetworkError = err.message?.includes('fetch failed') || (err as { code?: string }).code === 'EAI_AGAIN';
      if (isNetworkError && attempt < maxRetries) {
        const delay = attempt * 1000;
        console.warn(`Kitsu fetch attempt ${attempt} failed (DNS/Network). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('Unknown Kitsu fetch error');
}

function parseKitsuRateLimit(headers: Headers): KitsuRateLimitInfo {
  const limit = Number(headers.get('x-ratelimit-limit'));
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  const reset = Number(headers.get('x-ratelimit-reset'));

  return {
    limit: isNaN(limit) ? undefined : limit,
    remaining: isNaN(remaining) ? undefined : remaining,
    reset: isNaN(reset) ? undefined : reset,
  };
}

export interface KitsuAnimeResult {
  id: string;
  status: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
  averageScore?: number;
  popularity?: number;
  trending?: number;
  nextAiringEpisode?: {
    airingAt: string;
  };
  source: 'Kitsu';
}

export async function searchKitsuAnime(query: string): Promise<KitsuAnimeResult | null> {
  if (!query) return null;

  try {
    const body = await kitsuFetch('anime', {
      params: {
        'filter[text]': query,
        'page[limit]': '1',
      },
      endpoint: 'anime_search',
    }) as { data?: { id: string; attributes: Record<string, unknown> }[] };

    if (!body.data || body.data.length === 0) return null;

    const entry = body.data[0];
    return mapKitsuAnime(entry.id, entry.attributes);
  } catch (error) {
    console.error('Kitsu search failed:', error);
    return null;
  }
}

export async function fetchKitsuAnimeById(id: string): Promise<KitsuAnimeResult | null> {
  try {
    const body = await kitsuFetch(`anime/${id}`, {
      endpoint: 'anime_by_id',
    }) as { data?: { id: string; attributes: Record<string, unknown> } };

    if (!body.data) return null;

    return mapKitsuAnime(body.data.id, body.data.attributes);
  } catch (error) {
    console.error('Kitsu fetch failed:', error);
    return null;
  }
}

function mapKitsuStatus(status: string): KitsuAnimeResult['status'] {
  switch (status) {
    case 'current':
      return 'RELEASING';
    case 'finished':
      return 'FINISHED';
    case 'upcoming':
      return 'NOT_YET_RELEASED';
    case 'unreleased':
      return 'NOT_YET_RELEASED';
    default:
      return 'FINISHED';
  }
}

function mapKitsuAnime(id: string, attributes: Record<string, unknown>): KitsuAnimeResult {
  const averageRating = attributes.averageRating ? parseFloat(attributes.averageRating) : undefined;
  const popularity = attributes.userCount;
  const nextRelease = attributes.nextRelease;
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
