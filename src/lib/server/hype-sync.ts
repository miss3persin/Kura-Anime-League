import { fetchAniList } from "@/lib/anilist";
import { fetchMalAnimeById } from "@/lib/jikan";
import { appendHypeHistory, calcCostKp, getLatestPriceChange, type AnimeHypeHistoryEntry } from "@/lib/hype";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

type TrendingMedia = {
  id: number;
  title: { romaji: string };
  trending: number;
  averageScore: number | null;
  popularity: number;
  coverImage: { large: string };
  status: string;
};

type AniListTrendingResponse = {
  Page: {
    media: TrendingMedia[];
  };
};

type CachedHypeRow = {
  id: number;
  mal_id: number | null;
  hype_score: number | null;
  cost_kp: number | null;
  title_romaji?: string;
  hype_history: AnimeHypeHistoryEntry[] | null;
  average_score?: number | null;
  status?: string | null;
  popularity?: number | null;
};

function computeCompositeHype(
  media: TrendingMedia,
  maxTrending: number,
  maxPopularity: number,
  socialBuzzNorm: number
) {
  const aniTrendingNorm = Math.round(((media.trending ?? 0) / maxTrending) * 1000);
  const aniPopularityNorm = Math.round(((media.popularity ?? 0) / maxPopularity) * 1000);
  const aniScoreNorm = media.averageScore ? Math.round((media.averageScore / 100) * 1000) : 500;

  if (media.status === "NOT_YET_RELEASED") {
    return Math.round(aniTrendingNorm * 0.4 + aniPopularityNorm * 0.4 + socialBuzzNorm * 0.2);
  }

  return Math.round(
    aniTrendingNorm * 0.4 +
    aniScoreNorm * 0.3 +
    aniPopularityNorm * 0.2 +
    socialBuzzNorm * 0.1
  );
}

async function getSocialBuzzNorm(malId: number | null) {
  if (!malId) {
    return 500;
  }

  const malData = await fetchMalAnimeById(malId).catch(() => null);
  if (!malData) {
    return 500;
  }

  const membersScore = malData.members ? Math.min(1000, Math.round(Math.log10(malData.members) * 150)) : 500;
  const favoritesScore = malData.favorites ? Math.min(1000, Math.round(Math.log10(malData.favorites) * 200)) : 500;
  return Math.round(membersScore * 0.6 + favoritesScore * 0.4);
}

export async function syncHypeMarket() {
  const { data: aniData } = await fetchAniList<AniListTrendingResponse>(
    GET_TRENDING,
    {},
    { endpoint: "hype-trending", metadata: { limit: 50 } }
  );

  const trending = aniData.Page.media;
  const ids = trending.map((media) => media.id);

  const { data: rawCachedAnime } = await supabaseAdmin
    .from("anime_cache")
    .select("id, mal_id, hype_score, cost_kp, title_romaji, hype_history, average_score, status, popularity")
    .in("id", ids);

  const cachedAnime = (rawCachedAnime as unknown as CachedHypeRow[]) ?? [];
  const cacheMap = new Map<number, CachedHypeRow>(cachedAnime.map((row) => [row.id, row]));
  const nowDate = new Date().toISOString();
  const maxTrending = Math.max(...trending.map((media) => media.trending ?? 0), 1);
  const maxPopularity = Math.max(...trending.map((media) => media.popularity ?? 0), 1);

  const hypeIndex = await Promise.all(trending.map(async (media) => {
    const existing = cacheMap.get(media.id);
    const previousHype = existing?.hype_score ?? 500;
    const previousCost = existing?.cost_kp ?? 2500;
    const history = Array.isArray(existing?.hype_history) ? existing?.hype_history : [];
    const socialBuzzNorm = await getSocialBuzzNorm(existing?.mal_id ?? null);
    const rawHype = computeCompositeHype(media, maxTrending, maxPopularity, socialBuzzNorm);
    const newCost = calcCostKp(media, rawHype, Math.random, {
      previousCost,
      previousHype
    });
    const nextHistory = appendHypeHistory(history, {
      timestamp: nowDate,
      price: newCost,
      hype: rawHype
    });
    const priceChange = getLatestPriceChange(nextHistory, newCost);

    return {
      id: media.id,
      hype_score: rawHype,
      hype_change: priceChange.percent,
      cost_kp: newCost,
      status: media.status,
      average_score: media.averageScore,
      hype_history: nextHistory
    };
  }));

  for (const item of hypeIndex) {
    await supabaseAdmin
      .from("anime_cache")
      .update({
        hype_score: item.hype_score,
        hype_change: item.hype_change,
        cost_kp: item.cost_kp,
        status: item.status ?? "FINISHED",
        average_score: item.average_score,
        hype_history: item.hype_history,
        updated_at: nowDate
      })
      .eq("id", item.id);
  }

  const { data: rawAllAnime } = await supabaseAdmin
    .from("anime_cache")
    .select("id, hype_score, average_score, status, cost_kp, hype_history, popularity")
    .not("id", "in", `(${ids.length > 0 ? ids.join(",") : "0"})`);

  const allAnime = (rawAllAnime as unknown as CachedHypeRow[]) ?? [];

  for (const anime of allAnime) {
    const decayAmount = anime.status === "NOT_YET_RELEASED"
      ? Math.floor(Math.random() * 6 + 2)
      : Math.floor(Math.random() * 18 + 6);
    const decayedHype = Math.max(100, (anime.hype_score ?? 500) - decayAmount);
    const newCost = calcCostKp(
      {
        average_score: anime.average_score,
        popularity: anime.popularity ?? 0,
        status: anime.status ?? undefined,
        trending: 0
      },
      decayedHype,
      Math.random,
      {
        previousCost: anime.cost_kp ?? 2500,
        previousHype: anime.hype_score ?? 500
      }
    );
    const nextHistory = appendHypeHistory(anime.hype_history ?? [], {
      timestamp: nowDate,
      price: newCost,
      hype: decayedHype
    });
    const priceChange = getLatestPriceChange(nextHistory, newCost);

    await supabaseAdmin
      .from("anime_cache")
      .update({
        hype_score: decayedHype,
        hype_change: priceChange.percent,
        cost_kp: newCost,
        hype_history: nextHistory,
        updated_at: nowDate
      })
      .eq("id", anime.id);
  }

  return {
    updated: hypeIndex.length + allAnime.length,
    updatedAt: nowDate
  };
}
