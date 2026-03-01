import { NextResponse } from 'next/server';
import { fetchAniList } from '@/lib/anilist';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calcCostKp } from '@/lib/hype';
import { requireServiceSecret } from '@/lib/service-auth';

const CACHE_HEADERS = { 'Cache-Control': 'no-store, no-cache, max-age=0' };
export const dynamic = 'force-dynamic';

const GET_TRENDING = `
query {
  Page(page: 1, perPage: 100) {
    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
      id
      title { romaji }
      trending
      averageScore
      popularity
      coverImage { large }
      status
    }
  }
}
`;

interface HypeHistoryEntry {
    timestamp: string;
    price: number;
    hype: number;
}

interface TrendingMedia {
    id: number;
    title: { romaji: string };
    trending: number;
    averageScore: number | null;
    popularity: number;
    coverImage: { large: string };
    status: string;
}

interface AniListTrendingResponse {
    Page: {
        media: TrendingMedia[];
    }
}

import { fetchMalAnimeById } from '@/lib/jikan';

interface CachedHypeRow {
    id: number;
    mal_id: number | null;
    hype_score: number | null;
    cost_kp: number;
    title_romaji?: string;
    hype_history: HypeHistoryEntry[];
    average_score?: number | null;
    status?: string;
}

export async function GET(request: Request) {
    const unauthorized = requireServiceSecret(request);

    if (unauthorized) {
        return unauthorized;
    }
    try {
        // 1. Fetch trending from AniList
        const { data: aniData } = await fetchAniList<AniListTrendingResponse>(GET_TRENDING, {}, { endpoint: 'hype-trending', metadata: { limit: 50 } });
        const trending = aniData.Page.media;

        // 2. Get existing anime_cache records
        const ids = trending.map((m) => m.id);
        const { data: rawCachedAnime } = await supabaseAdmin
            .from('anime_cache')
            .select('id, mal_id, hype_score, cost_kp, title_romaji, hype_history')
            .in('id', ids);

        const cachedAnime = (rawCachedAnime as unknown as CachedHypeRow[]) ?? [];
        const cacheMap: Record<number, CachedHypeRow> = {};
        if (cachedAnime) {
            for (const a of cachedAnime) cacheMap[a.id] = a;
        }

        const nowDate = new Date().toISOString();

        // 3. Build hype index — normalize signals into 0-1000 score
        const maxTrending = Math.max(...trending.map((m) => m.trending ?? 0), 1);
        const maxPopularity = Math.max(...trending.map((m) => m.popularity ?? 0), 1);

        const hypeIndex = await Promise.all(trending.map(async (media) => {
            // Signal A: AniList Trending (0-1000)
            const aniTrendingNorm = Math.round(((media.trending ?? 0) / maxTrending) * 1000);
            
            // Signal B: AniList Popularity (0-1000)
            const aniPopularityNorm = Math.round(((media.popularity ?? 0) / maxPopularity) * 1000);

            // Signal C: AniList Score (0-1000)
            const aniScoreNorm = media.averageScore ? Math.round((media.averageScore / 100) * 1000) : 500;

            // Signal D: Jikan Social Buzz (Members + Favorites)
            let socialBuzzNorm = 500;
            const malId = cacheMap[media.id]?.mal_id;
            if (malId) {
                const malData = await fetchMalAnimeById(malId).catch(() => null);
                if (malData) {
                    const membersScore = malData.members ? Math.min(1000, Math.round(Math.log10(malData.members) * 150)) : 500;
                    const favoritesScore = malData.favorites ? Math.min(1000, Math.round(Math.log10(malData.favorites) * 200)) : 500;
                    socialBuzzNorm = Math.round(membersScore * 0.6 + favoritesScore * 0.4);
                }
            }

            // Composite Hype Score:
            let rawHype;
            if (media.status === 'NOT_YET_RELEASED') {
                // For upcoming: 40% Trending + 40% Popularity + 20% Social Buzz
                rawHype = Math.round(aniTrendingNorm * 0.4 + aniPopularityNorm * 0.4 + socialBuzzNorm * 0.2);
            } else {
                // For released: 40% Trending + 30% Score + 20% Popularity + 10% Social Buzz
                rawHype = Math.round(aniTrendingNorm * 0.4 + aniScoreNorm * 0.3 + aniPopularityNorm * 0.2 + socialBuzzNorm * 0.1);
            }

            const prevHype = cacheMap[media.id]?.hype_score ?? 500;
            const change = rawHype - prevHype;
            const newCost = calcCostKp(media, rawHype);

            // Price History Logic
            let history = (cacheMap[media.id]?.hype_history) || [];
            if (!Array.isArray(history)) history = [];
            history.unshift({ timestamp: nowDate, price: newCost, hype: rawHype });
            history = history.slice(0, 100);

            return {
                id: media.id,
                hype_score: rawHype,
                hype_change: change,
                cost_kp: newCost,
                status: media.status,
                average_score: media.averageScore,
                hype_history: history
            };
        }));

        // 4. Update hype scores and cost_kp in DB
        for (const item of hypeIndex) {
            await supabaseAdmin
                .from('anime_cache')
                .update({
                    hype_score: item.hype_score,
                    hype_change: item.hype_change,
                    cost_kp: item.cost_kp,
                    status: item.status ?? 'FINISHED',
                    average_score: item.average_score,
                    hype_history: item.hype_history,
                    updated_at: nowDate
                })
                .eq('id', item.id);
        }

        // 5. Drift for non-trending anime
        const { data: rawAllAnime } = await supabaseAdmin
            .from('anime_cache')
            .select('id, hype_score, average_score, status, cost_kp, hype_history')
            .not('id', 'in', `(${ids.length > 0 ? ids.join(',') : '0'})`);

        const allAnime = (rawAllAnime as unknown as CachedHypeRow[]) ?? [];

        if (allAnime && allAnime.length > 0) {
            for (const anime of allAnime) {
                // Decay if not trending. Upcoming shows decay much slower (-1 to -3) than airing shows (-5 to -15)
                const decayAmount = anime.status === 'NOT_YET_RELEASED' 
                    ? Math.floor(Math.random() * 3 + 1)
                    : Math.floor(Math.random() * 10 + 5);
                
                const decayedHype = Math.max(100, (anime.hype_score ?? 500) - decayAmount);
                const newCost = calcCostKp(anime, decayedHype);

                let history = (anime.hype_history) || [];
                if (!Array.isArray(history)) history = [];
                history.unshift({ timestamp: nowDate, price: newCost, hype: decayedHype });
                history = history.slice(0, 100);

                await supabaseAdmin
                    .from('anime_cache')
                    .update({
                        hype_score: decayedHype,
                        hype_change: decayedHype - (anime.hype_score ?? 500),
                        cost_kp: newCost,
                        hype_history: history,
                        updated_at: nowDate
                    })
                    .eq('id', anime.id);
            }
        }

        return NextResponse.json(
            { success: true, updated: hypeIndex.length + (allAnime?.length || 0) },
            { headers: CACHE_HEADERS }
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500, headers: CACHE_HEADERS });
    }
}
