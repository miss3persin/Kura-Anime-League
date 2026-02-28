import { supabaseAdmin } from '@/lib/supabase/admin';
import type { SeasonalAnimeEntry } from '@/lib/sync';
import { searchKitsuAnime } from '@/lib/kitsu';
import { searchMalAnime } from '@/lib/jikan';

export interface IdentityMappingRecord {
  anilist_id: number;
  kitsu_id?: number | null;
  mal_id?: number | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function findIdentityMapping(anilistId: number) {
  if (!anilistId) return null;
  const { data } = await supabaseAdmin
    .from('anime_identity_map')
    .select('*')
    .eq('anilist_id', anilistId)
    .maybeSingle();
  return data;
}

export async function findMappingsForIds(anilistIds: number[]) {
  if (!anilistIds?.length) return {};
  const { data } = await supabaseAdmin
    .from('anime_identity_map')
    .select('anilist_id, kitsu_id, mal_id')
    .in('anilist_id', anilistIds);

  const map: Record<number, { kitsu_id?: number | null; mal_id?: number | null }> = {};
  for (const row of data ?? []) {
    map[row.anilist_id] = {
      kitsu_id: row.kitsu_id,
      mal_id: row.mal_id
    };
  }
  return map;
}

export async function upsertIdentityMapping(record: IdentityMappingRecord) {
  if (!record?.anilist_id) return;
  await supabaseAdmin.from('anime_identity_map').upsert({
    anilist_id: record.anilist_id,
    kitsu_id: record.kitsu_id ?? null,
    mal_id: record.mal_id ?? null,
    title: record.title ?? null,
    metadata: record.metadata ?? null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'anilist_id' });
}

export async function ensureIdentityMappingForAnime(anime: SeasonalAnimeEntry) {
  if (!anime?.id) return null;

  const existing = await findIdentityMapping(anime.id);
  if (existing?.kitsu_id && existing?.mal_id) {
    return existing;
  }

  const title = buildTitle(anime);
  if (!title) return existing;

  let kitsuId = existing?.kitsu_id ?? null;
  if (!kitsuId) {
    const kitsuResult = await searchKitsuAnime(title);
    if (kitsuResult) {
      const parsed = Number(kitsuResult.id);
      if (!Number.isNaN(parsed)) {
        kitsuId = parsed;
      }
    }
  }

  let malId = existing?.mal_id ?? null;
  if (!malId) {
    const malResult = await searchMalAnime(title);
    if (malResult?.mal_id) {
      malId = malResult.mal_id;
    }
  }

  if (kitsuId || malId) {
    await upsertIdentityMapping({
      anilist_id: anime.id,
      kitsu_id: kitsuId ?? null,
      mal_id: malId ?? null,
      title,
      metadata: { refreshed_at: new Date().toISOString() }
    });
  }

  return findIdentityMapping(anime.id);
}

function buildTitle(anime: SeasonalAnimeEntry) {
  if (!anime) return null;
  return (
    anime.title?.romaji ??
    anime.title?.english ??
    anime.title?.native ??
    null
  );
}
