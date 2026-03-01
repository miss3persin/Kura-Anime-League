import { logApiRateLimit } from '@/lib/apiRateLimit';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

export interface JikanAnimeResult {
  mal_id: number;
  title: string;
  url: string;
  synopsis?: string;
  episodes?: number;
}

export async function fetchMalAnime(query: string): Promise<JikanAnimeResult | null> {
  if (!query) return null;
  const url = new URL(`${JIKAN_BASE_URL}/anime`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json() as { data: JikanAnimeResult[]; message?: string };
      const duration = Date.now() - startTime;

      await logApiRateLimit({
        source: 'Jikan',
        endpoint: 'anime_search',
        status: response.status,
        success: response.ok,
        limit: undefined, // Jikan doesn't use standard headers for limit
        remaining: undefined,
        resetAt: null,
        metadata: {
          durationMs: duration,
          query,
        },
        message: response.ok ? 'ok' : payload?.message ?? 'error'
      });

      if (!response.ok || !payload?.data?.length) {
        return null;
      }

      const entry = payload.data[0];
      return {
        mal_id: entry.mal_id,
        title: entry.title,
        url: entry.url,
        synopsis: entry.synopsis,
        episodes: entry.episodes
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const isNetworkError = err.message?.includes('fetch failed') || (err as { code?: string }).code === 'EAI_AGAIN';
      if (isNetworkError && attempt < maxRetries) {
        const delay = attempt * 1000;
        console.warn(`Jikan fetch attempt ${attempt} failed (DNS/Network). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  return null;
}

export async function fetchMalAnimeById(id: number): Promise<JikanAnimeResult | null> {
  const url = `${JIKAN_BASE_URL}/anime/${id}`;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json() as { data: JikanAnimeResult; message?: string };

      if (!response.ok || !payload?.data) return null;
      return payload.data;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const isNetworkError = err.message?.includes('fetch failed') || (err as { code?: string }).code === 'EAI_AGAIN';
      if (isNetworkError && attempt < maxRetries) {
        const delay = attempt * 1000;
        console.warn(`Jikan fetch attempt ${attempt} failed (DNS/Network). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  return null;
}

export async function searchMalAnime(query: string): Promise<JikanAnimeResult | null> {
  return fetchMalAnime(query);
}
