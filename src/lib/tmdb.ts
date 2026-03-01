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
  genre_ids: number[];
  original_language: string;
  popularity: number;
}

export async function searchTmdbSeries(query: string, year?: number): Promise<TmdbSearchResult | null> {
  if (!process.env.TMDB_API_KEY) {
    return null;
  }

  const url = new URL(`${TMDB_API_URL}/search/tv`);
  url.searchParams.set('api_key', process.env.TMDB_API_KEY);
  url.searchParams.set('query', query);
  if (year) {
    url.searchParams.set('first_air_date_year', year.toString());
  }

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) return null;

    // Filter for Animation (16) and ideally Japanese origin to avoid K-Dramas
    const animeResult = data.results.find((r: any) => 
      r.genre_ids.includes(16) && 
      (r.original_language === 'ja' || r.name.toLowerCase() === query.toLowerCase())
    );

    return (animeResult || data.results[0]) as TmdbSearchResult;
  } catch (e) {
    console.error('TMDB Search Error:', e);
    return null;
  }
}

export function getTmdbImageUrl(path: string | null, size: 'original' | 'w1280' | 'w500' = 'original') {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
