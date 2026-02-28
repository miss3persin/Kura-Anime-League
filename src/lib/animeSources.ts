import { AniListRateLimitError, fetchAniList } from '@/lib/anilist';
import { logApiRateLimit } from '@/lib/apiRateLimit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchKitsuAnimeById, normalizeKitsuStatus, searchKitsuAnime } from '@/lib/kitsu';
import { findMappingsForIds, upsertIdentityMapping } from '@/lib/identityMapping';

interface AnimeCacheRow {
  id: number;
  status?: string | null;
  kitsu_id?: number | null;
  title_romaji?: string | null;
  title_english?: string | null;
  average_score?: number | null;
}

export interface AiringStatus {
  id: number;
  status: string;
  nextAiringEpisode?: { episode?: number; airingAt?: number };
  trending?: number;
  averageScore?: number | null;
  popularity?: number | null;
  source: 'AniList' | 'Kitsu' | 'Cache' | 'LiveChart';
}

interface KitsuAnimePayload {
  id: string;
  attributes: {
    status: string;
    averageRating: string | null;
    userCount: number;
    canonicalTitle: string;
  };
}

interface AniListAiringMedia {
  id: number;
  status: string;
  nextAiringEpisode: {
    episode: number;
    airingAt: number;
  } | null;
  trending: number;
  averageScore: number | null;
  popularity: number | null;
}

interface AniListAiringResponse {
  Page: {
    media: AniListAiringMedia[];
  };
}

const GET_AIRING_STATUS = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      status
      nextAiringEpisode {
        episode
        airingAt
      }
      trending
      averageScore
      popularity
    }
  }
}
`;

const SEARCH_DELAY_MS = 220;

export async function fetchAiringStatuses(ids: number[]): Promise<Record<number, AiringStatus>> {
  if (!ids?.length) return {};
  let statuses: Record<number, AiringStatus> = {};

  try {
    const { data } = await fetchAniList<AniListAiringResponse>(
      GET_AIRING_STATUS,
      { ids },
      { endpoint: 'score-week-airing-status', metadata: { idsCount: ids.length } }
    );

    for (const media of data.Page.media) {
      statuses[media.id] = {
        id: media.id,
        status: media.status,
        nextAiringEpisode: media.nextAiringEpisode ?? undefined,
        trending: media.trending ?? 0,
        averageScore: media.averageScore ?? null,
        popularity: media.popularity ?? null,
        source: 'AniList'
      };
    }

    void logApiRateLimit({
      source: 'AniList',
      endpoint: 'score-week-airing-status',
      status: 200,
      success: true,
      message: 'AniList primary path used',
      metadata: { idsCount: ids.length, source: 'AniList' }
    }).catch(() => undefined);
    } catch (error) {
      if (error instanceof AniListRateLimitError) {
        console.warn('AniList rate limit reached, falling back to Kitsu/cache', error);
        statuses = await fetchFallbackStatuses(ids);
      } else {
        throw error;
      }
    }

    const missingIds = ids.filter(id => !statuses[id]);
    if (missingIds.length) {
      const fallback = await fetchFallbackStatuses(missingIds);
      statuses = { ...statuses, ...fallback };
    }

  await applyLiveChartOverrides(ids, statuses);
  return statuses;
}

async function fetchFallbackStatuses(ids: number[]): Promise<Record<number, AiringStatus>> {
  const statuses: Record<number, AiringStatus> = {};
  const { data: rows } = await supabaseAdmin
    .from('anime_cache')
    .select('id, status, kitsu_id, title_romaji, title_english, average_score')
    .in('id', ids);

  if (!rows || rows.length === 0) return statuses;

  const mappingMap = await findMappingsForIds(rows.map((row) => row.id));

  const kitsuCache = new Map<number, KitsuAnimePayload>();

  for (const row of rows) {
    const mapping = mappingMap[row.id];
    if (mapping?.kitsu_id) {
      row.kitsu_id = mapping.kitsu_id;
    }

    const cacheStatus = buildCacheStatus(row);

    const withMapping = await ensureKitsuId(row);
    if (withMapping.kitsu_id) {
      let kitsuPayload = kitsuCache.get(withMapping.kitsu_id);
      if (!kitsuPayload) {
        try {
          kitsuPayload = await fetchKitsuAnimeById(withMapping.kitsu_id) as KitsuAnimePayload;
          kitsuCache.set(withMapping.kitsu_id, kitsuPayload);
        } catch (err) {
          console.warn(`Failed to fetch Kitsu anime ${withMapping.kitsu_id}`, err);
        }
      }

      if (kitsuPayload) {
        const normalized = normalizeKitsuStatus(kitsuPayload, row.id);
        if (normalized) {
          statuses[row.id] = normalized;
          continue;
        }
      }
    }

    statuses[row.id] = cacheStatus;
  }

  return statuses;
}

async function applyLiveChartOverrides(ids: number[], statuses: Record<number, AiringStatus>) {
  if (!ids?.length) return;

  const { data: overrides } = await supabaseAdmin
    .from('livechart_breaks')
    .select('anime_id, status, next_airing_at, source')
    .in('anime_id', ids);

  if (!overrides?.length) return;

  for (const entry of overrides) {
    const animeId = entry.anime_id;
    const existing = statuses[animeId];
    const nextAiringSeconds = entry.next_airing_at ? Math.floor(new Date(entry.next_airing_at).getTime() / 1000) : undefined;

    statuses[animeId] = {
      id: animeId,
      status: entry.status ?? existing?.status ?? 'HIATUS',
      nextAiringEpisode: nextAiringSeconds ? { airingAt: nextAiringSeconds } : existing?.nextAiringEpisode,
      trending: existing?.trending ?? 0,
      averageScore: existing?.averageScore ?? null,
      popularity: existing?.popularity ?? null,
      source: entry.source ?? 'LiveChart'
    };
  }
}

function buildCacheStatus(row: AnimeCacheRow): AiringStatus {
  return {
    id: row.id,
    status: row.status ?? 'FINISHED',
    averageScore: row.average_score ?? null,
    trending: 0,
    popularity: null,
    source: 'Cache'
  };
}

async function ensureKitsuId(row: AnimeCacheRow): Promise<AnimeCacheRow> {
  if (row.kitsu_id) return row;
  const query = row.title_romaji || row.title_english;
  if (!query) return row;

  const result = await searchKitsuAnime(query);
  if (result) {
    const kitsuId = Number(result.id);
    if (!Number.isNaN(kitsuId)) {
      await supabaseAdmin
        .from('anime_cache')
        .update({ kitsu_id: kitsuId })
        .eq('id', row.id);
      await upsertIdentityMapping({
        anilist_id: row.id,
        kitsu_id: kitsuId,
        title: row.title_romaji ?? row.title_english ?? result.attributes?.canonicalTitle ?? null
      });
      row.kitsu_id = kitsuId;
    }
  }

  await sleep(SEARCH_DELAY_MS);
  return row;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
