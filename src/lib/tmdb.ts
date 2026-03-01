import { logApiRateLimit } from '@/lib/apiRateLimit';

const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

export interface TmdbSearchResult {
  id: number;
  original_name: string;
  name: string;
  backdrop_path: string | null;
  poster_path: string | null;
  overview: string;
  first_air_date: string;
}

export async function searchTmdbSeries(query: string, year?: number): Promise<TmdbSearchResult | null> {
  if (!TMDB_API_KEY) {
    console.warn('TMDB_API_KEY not found');
    return null;
  }

  const url = new URL(`${TMDB_API_URL}/search/tv`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('query', query);
  if (year) {
    url.searchParams.set('first_air_date_year', year.toString());
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    await logApiRateLimit({
      source: 'TMDB',
      endpoint: 'search-tv',
      status: response.status,
      success: response.ok,
      message: response.ok ? 'ok' : 'error',
      metadata: { query, year }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    // Prefer exact matches or high popularity
    return data.results[0] as TmdbSearchResult;
  } catch (e) {
    console.error('TMDB Search Error:', e);
    return null;
  }
}

export function getTmdbImageUrl(path: string | null, size: 'original' | 'w1280' | 'w500' = 'original') {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
