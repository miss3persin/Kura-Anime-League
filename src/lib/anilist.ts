import { logApiRateLimit } from '@/lib/apiRateLimit';

const ANILIST_API_URL = 'https://graphql.anilist.co';

export interface AniListRateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
  bucket?: string;
}

export interface AniListCharacter {
  id: number;
  name: {
    full: string;
  };
  image: {
    large: string;
  };
  gender?: string;
  favourites?: number;
  description?: string;
}

export interface AniListMedia {
  id: number;
  title: {
    romaji: string;
    english: string | null;
  };
  coverImage: {
    extraLarge: string;
    large: string;
  };
  bannerImage: string | null;
  description: string | null;
  format: string;
  episodes: number | null;
  status: string;
  averageScore: number | null;
  genres: string[];
  characters: {
    nodes: AniListCharacter[];
  };
}

export interface AniListPageInfo {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface AniListSeasonalResponse {
  Page: {
    pageInfo: AniListPageInfo;
    media: AniListMedia[];
  };
}

export interface AniListFetchResult<T = unknown> {
  data: T;
  rateLimit: AniListRateLimitInfo;
}

export class AniListRateLimitError extends Error {
  constructor(message: string, public rateLimit: AniListRateLimitInfo, public statusCode: number) {
    super(message);
    this.name = 'AniListRateLimitError';
  }
}

export const GET_SEASONAL_ANIME = `
query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      perPage
      currentPage
      lastPage
      hasNextPage
    }
    media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      id
      title {
        romaji
        english
      }
      coverImage {
        extraLarge
        large
      }
      bannerImage
      description
      format
      episodes
      status
      averageScore
      popularity
      isAdult
      genres
      characters(role: MAIN, sort: [FAVOURITES_DESC]) {
        nodes {
          id
          name {
            full
          }
          image {
            large
          }
          gender
          favourites
          description
        }
      }
    }
  }
}
`;

export async function fetchAniList<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
  options?: { endpoint?: string; metadata?: Record<string, unknown> }
): Promise<AniListFetchResult<T>> {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      const data = await response.json();
      const duration = Date.now() - startTime;
      const rateLimit = parseRateLimitInfo(response.headers);

      const endpointName = options?.endpoint ?? 'default';
      await logApiRateLimit({
        source: 'AniList',
        endpoint: endpointName,
        status: response.status,
        success: response.ok,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.reset ? new Date(rateLimit.reset * 1000).toISOString() : null,
        bucket: rateLimit.bucket,
        message: response.ok ? 'ok' : data.errors?.[0]?.message,
        metadata: {
          durationMs: duration,
          querySnippet: query.slice(0, 160),
          variables: scrubVariables(variables),
          ...options?.metadata
        }
      });

      if (!response.ok) {
        const message = data.errors?.[0]?.message || 'Failed to fetch from AniList';
        if (response.status === 429) {
          throw new AniListRateLimitError(message, rateLimit, response.status);
        }
        throw new Error(message);
      }

      return { data: data.data as T, rateLimit };
    } catch (error: any) {
      lastError = error;
      const isNetworkError = error.message?.includes('fetch failed') || error.code === 'EAI_AGAIN';
      if (isNetworkError && attempt < maxRetries) {
        const delay = attempt * 1000;
        console.warn(`AniList fetch attempt ${attempt} failed (DNS/Network). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function parseRateLimitInfo(headers: Headers): AniListRateLimitInfo {
  const limit = Number(headers.get('x-ratelimit-limit'));
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  const reset = Number(headers.get('x-ratelimit-reset'));
  const bucket = headers.get('x-ratelimit-bucket') || undefined;

  return {
    limit: Number.isNaN(limit) ? undefined : limit,
    remaining: Number.isNaN(remaining) ? undefined : remaining,
    reset: Number.isNaN(reset) ? undefined : reset,
    bucket
  };
}

function scrubVariables(values: Record<string, unknown>) {
  if (!values) return {};
  // We keep the shape intact for observability; redact here if you store secrets.
  return values;
}

