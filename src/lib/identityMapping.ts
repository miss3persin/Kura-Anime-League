import { supabaseAdmin } from '@/lib/supabase/admin';
import type { SeasonalAnimeEntry } from '@/lib/sync';
import { searchKitsuAnime } from '@/lib/kitsu';
import { searchMalAnime } from '@/lib/jikan';
import offlineMapping from '../../supabase/seed/anime-offline-mapping.json';

export interface IdentityMap {
  anilist_id: number;
  kitsu_id: number | null;
  mal_id: number | null;
  tmdb_id?: number | null;
  title?: string | null;
  metadata?: any;
  updated_at: string;
}

export async function findIdentityMapping(anilistId: number): Promise<IdentityMap | null> {
  const { data, error } = await supabaseAdmin
    .from('anime_identity_map')
    .select('*')
    .eq('anilist_id', anilistId)
    .maybeSingle();

  if (error || !data) return null;
  return data as IdentityMap;
}

export async function findMappingsForIds(anilistIds: number[]): Promise<Record<number, IdentityMap>> {
  if (!anilistIds.length) return {};
  
  const { data, error } = await supabaseAdmin
    .from('anime_identity_map')
    .select('*')
    .in('anilist_id', anilistIds);

  if (error || !data) return {};
  
  return Object.fromEntries(data.map(m => [m.anilist_id, m as IdentityMap]));
}

export async function upsertIdentityMapping(mapping: Partial<IdentityMap>) {
  const { error } = await supabaseAdmin
    .from('anime_identity_map')
    .upsert(mapping, { onConflict: 'anilist_id' });

  if (error) {
    console.error('Failed to upsert identity mapping:', error);
  }
}

export async function ensureIdentityMappingForAnime(anime: SeasonalAnimeEntry): Promise<IdentityMap | null> {
  const existing = await findIdentityMapping(anime.id);
  
  // 1. Local Fallback (Point 1)
  const localMatch = (offlineMapping as any[]).find(m => m.anilist_id === anime.id);
  if (localMatch) {
    if (!existing || (localMatch.kitsu_id && !existing.kitsu_id) || (localMatch.mal_id && !existing.mal_id)) {
      await upsertIdentityMapping({
        anilist_id: anime.id,
        kitsu_id: localMatch.kitsu_id ?? existing?.kitsu_id ?? null,
        mal_id: localMatch.mal_id ?? existing?.mal_id ?? null,
        updated_at: new Date().toISOString()
      });
      return findIdentityMapping(anime.id);
    }
    return existing;
  }

  // 2. Already fully mapped?
  if (existing && existing.kitsu_id && existing.mal_id) {
    return existing;
  }

  const title = buildTitle(anime);
  if (!title) return existing;

  let kitsuId = existing?.kitsu_id ?? null;
  if (!kitsuId) {
    try {
      const kitsuResult = await searchKitsuAnime(title);
      if (kitsuResult) {
        const parsed = Number(kitsuResult.id);
        if (!Number.isNaN(parsed)) {
          kitsuId = parsed;
        }
      }
    } catch (e) {
      console.warn(`Identity Map: Kitsu search failed for "${title}":`, (e as Error).message);
    }
  }

  let malId = existing?.mal_id ?? null;
  if (!malId) {
    try {
      const malResult = await searchMalAnime(title);
      if (malResult?.mal_id) {
        malId = malResult.mal_id;
      }
    } catch (e) {
      console.warn(`Identity Map: MAL search failed for "${title}":`, (e as Error).message);
    }
  }

  if (kitsuId || malId) {
    await upsertIdentityMapping({
      anilist_id: anime.id,
      kitsu_id: kitsuId,
      mal_id: malId,
      updated_at: new Date().toISOString()
    });
  }

  return findIdentityMapping(anime.id);
}

function buildTitle(anime: SeasonalAnimeEntry) {
  if (!anime) return null;
  return (
    anime.title?.english ??
    anime.title?.romaji ??
    anime.title?.native ??
    null
  );
}
