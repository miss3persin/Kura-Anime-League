import { logApiRateLimit } from '@/lib/apiRateLimit';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

export interface JikanAnimeResult {
  mal_id: number;
  title: string;
  url: string;
  synopsis?: string;
  episodes?: number;
}

export async function searchMalAnime(query: string): Promise<JikanAnimeResult | null> {
  if (!query) return null;
  const url = new URL(`${JIKAN_BASE_URL}/anime`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');

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
}
