import { NextResponse } from 'next/server';
import { fetchAniList } from '@/lib/anilist';
import { createClient } from '@supabase/supabase-js';
import { calcCostKp } from '@/lib/hype';
import { requireServiceSecret } from '@/lib/service-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CACHE_HEADERS = { 'Cache-Control': 'no-store, no-cache, max-age=0' };
export const dynamic = 'force-dynamic';

const GET_TRENDING = `
query {
  Page(page: 1, perPage: 50) {
    media(type: ANIME, sort: TRENDING_DESC) {
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

interface CachedHypeRow {
    id: number;
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
            .select('id, hype_score, cost_kp, title_romaji, hype_history')
            .in('id', ids);

        const cachedAnime = (rawCachedAnime as unknown as CachedHypeRow[]) ?? [];
        const cacheMap: Record<number, CachedHypeRow> = {};
        if (cachedAnime) {
            for (const a of cachedAnime) cacheMap[a.id] = a;
        }

        const nowDate = new Date().toISOString();

        // 3. Build hype index — normalize trending value into 0-1000 score
        const maxTrending = Math.max(...trending.map((m) => m.trending ?? 0), 1);
        const hypeIndex = trending.map((media) => {
            // Composite hype score: 70% trending rank + 30% average score
            // Normalized to 1000
            const trendingNorm = Math.round(((media.trending ?? 0) / maxTrending) * 1000);
            const scoreNorm = media.averageScore ? Math.round((media.averageScore / 100) * 1000) : 500;
            const rawHype = Math.round(trendingNorm * 0.7 + scoreNorm * 0.3);

            const prevHype = cacheMap[media.id]?.hype_score ?? 500;
            const change = rawHype - prevHype;
            const newCost = calcCostKp(media, rawHype);

            // Price History Logic for multi-range time range toggles
            let history = (cacheMap[media.id]?.hype_history) || [];
            if (!Array.isArray(history)) history = [];
            history.unshift({ timestamp: nowDate, price: newCost, hype: rawHype });
            history = history.slice(0, 100); // Keep last 100 snapshots

            return {
                id: media.id,
                hype_score: rawHype,
                hype_change: change,
                cost_kp: newCost,
                status: media.status,
                average_score: media.averageScore,
                hype_history: history
            };
        });

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
                // Decay if not trending (-5 to -15 hype drift on 1000 scale)
                const decayedHype = Math.max(100, (anime.hype_score ?? 500) - Math.floor(Math.random() * 10 + 5));
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
