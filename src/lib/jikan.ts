import { logApiRateLimit } from '@/lib/apiRateLimit';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

export interface JikanAnimeResult {
  mal_id: number;
  title: string;
  url: string;
  synopsis?: string;
  episodes?: number;
  score?: number;
  members?: number;
  favorites?: number;
  status?: string;
}

export async function fetchMalAnimeById(id: number): Promise<JikanAnimeResult | null> {
  const url = `${JIKAN_BASE_URL}/anime/${id}`;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      const payload = await response.json().catch(() => null);
      await logApiRateLimit({
        source: 'Jikan',
        endpoint: 'fetch-anime-by-id',
        status: response.status,
        success: response.ok,
        metadata: { mal_id: id },
        message: response.ok ? 'ok' : payload?.message ?? 'error'
      });

      if (!response.ok || !payload?.data) return null;
      return payload.data;
    } catch (error: unknown) {
      const isNetworkError = (error as Error).message?.includes('fetch failed') || (error as { code?: string }).code === 'EAI_AGAIN';
      if (isNetworkError && attempt < maxRetries) {
        const delay = attempt * 1000;
        console.warn(`Jikan fetch attempt ${attempt} failed (DNS/Network). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  return null;
}

export function normalizeJikanStatus(record: JikanAnimeResult, anilistId: number) {
  const status = mapJikanStatus(record.status);
  return {
    id: anilistId,
    status,
    averageScore: record.score ? Math.round(record.score * 10) : null,
    popularity: record.members ?? null,
    trending: record.favorites ?? 0,
    source: 'Jikan' as const,
  };
}

function mapJikanStatus(status?: string): string {
  if (!status) return 'FINISHED';
  const s = status.toLowerCase();
  if (s.includes('currently airing')) return 'RELEASING';
  if (s.includes('not yet aired')) return 'NOT_YET_RELEASED';
  if (s.includes('on hiatus')) return 'HIATUS';
  return 'FINISHED';
}

export async function searchMalAnime(query: string): Promise<JikanAnimeResult | null> {
  if (!query) return null;
  const url = new URL(`${JIKAN_BASE_URL}/anime`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      const payload = await response.json().catch(() => null);
      await logApiRateLimit({
        source: 'Jikan',
        endpoint: 'search-anime',
        status: response.status,
        success: response.ok,
        metadata: { query },
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
    } catch (error: any) {
      lastError = error;
      const isNetworkError = error.message?.includes('fetch failed') || error.code === 'EAI_AGAIN';
      if (isNetworkError && attempt < maxRetries) {
        const delay = attempt * 1000;
        console.warn(`Jikan search attempt ${attempt} failed (DNS/Network). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  return null;
}
