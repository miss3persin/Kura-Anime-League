import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchAiringStatuses } from '@/lib/animeSources';
import { buildAnimeCachePayload, buildCharacterPayloads, determineSeasonContexts, fetchSeasonalAnimeList, SeasonalAnimeEntry } from '@/lib/sync';
import type { SeasonContext } from '@/lib/sync';
import { ensureIdentityMappingForAnime } from '@/lib/identityMapping';
import { recordLiveChartStatuses } from '@/lib/livechart';
import type { LiveChartWriteResult } from '@/lib/livechart';
import { getTmdbImageUrl, searchTmdbSeries } from '@/lib/tmdb';
import { appendCharacterPriceHistory, calcCharacterPrice, getCharacterPriceChange, type CharacterPriceHistoryEntry } from '@/lib/character-market';

const JOB_NAME = 'anime_cache_refresh';

interface RefreshStep {
  step: string;
  result: Record<string, unknown> | LiveChartWriteResult;
}

export interface RefreshCycleResult {
  success: boolean;
  jobId?: string;
  steps: RefreshStep[];
}

type ExistingCharacterRow = {
  id: number;
  price: number | null;
  favorites: number | null;
  price_history: CharacterPriceHistoryEntry[] | null;
};

export async function runRefreshCycle(initiatedBy?: string): Promise<RefreshCycleResult> {
  const { data: job, error: jobError } = await supabaseAdmin
    .from('refresh_cycles')
    .insert({
      name: JOB_NAME,
      status: 'running',
      initiated_by: initiatedBy ?? null,
      started_at: new Date().toISOString(),
      details: {}
    })
    .select('id')
    .single();

  if (jobError || !job?.id) {
    console.error('Failed to create refresh cycle record:', jobError);
    throw new Error('Failed to create refresh cycle record');
  }

  const jobId = job.id;
  const steps: RefreshStep[] = [];

  try {
    const contexts = await determineSeasonContexts();
    if (contexts.length === 0) {
      throw new Error('No active or upcoming seasons found to sync.');
    }

    const allSeasonalAnime: { anime: SeasonalAnimeEntry; context: SeasonContext }[] = [];

    for (const ctx of contexts) {
      const list = await fetchSeasonalAnimeList(ctx);
      for (const item of list) {
        allSeasonalAnime.push({ anime: item, context: ctx });
      }

      steps.push({
        step: `seasonal_sync_${ctx.seasonName}`,
        result: {
          season: ctx.seasonName,
          count: list.length
        }
      });
    }

    const animeIds = [...new Set(allSeasonalAnime.map((x) => x.anime.id))];

    const animePayloads = allSeasonalAnime.map(({ anime, context }) => buildAnimeCachePayload(anime, context));
    if (animePayloads.length) {
      await supabaseAdmin.from('anime_cache').upsert(animePayloads, { onConflict: 'id' });
    }

    const rawCharacterPayloads = allSeasonalAnime.flatMap(({ anime }) => buildCharacterPayloads(anime));
    // Deduplicate characters by ID to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueCharacters = Array.from(
      new Map(rawCharacterPayloads.map((char) => [char.id, char])).values()
    );

    console.log(`Generated ${uniqueCharacters.length} unique character payloads from ${allSeasonalAnime.length} anime.`);
    if (uniqueCharacters.length) {
      const { data: existingCharacterRows } = await supabaseAdmin
        .from('character_cache')
        .select('id, price, favorites, price_history')
        .in('id', uniqueCharacters.map((char) => char.id));

      const existingCharacterMap = new Map<number, ExistingCharacterRow>(
        ((existingCharacterRows as ExistingCharacterRow[] | null) ?? []).map((row) => [row.id, row])
      );
      const now = new Date().toISOString();
      const dynamicCharacterPayloads = uniqueCharacters.map((char) => {
        const existing = existingCharacterMap.get(char.id);
        const nextPrice = calcCharacterPrice(
          {
            favorites: char.favorites ?? 0,
            role: char.role,
            gender: char.gender
          },
          Math.random,
          {
            previousPrice: existing?.price ?? char.price,
            previousFavorites: existing?.favorites ?? char.favorites
          }
        );
        const priceHistory = appendCharacterPriceHistory(existing?.price_history ?? [], nextPrice, now);
        const priceChange = getCharacterPriceChange(priceHistory, nextPrice);

        return {
          ...char,
          price: nextPrice,
          price_change: priceChange.percent,
          price_history: priceHistory,
          updated_at: now
        };
      });

      const { error: charErr } = await supabaseAdmin.from('character_cache').upsert(dynamicCharacterPayloads, { onConflict: 'id' });
      if (charErr) console.error('Character upsert error:', charErr);
    }

    const mappingResults = [];
    for (const { anime } of allSeasonalAnime) {
      const mapping = await ensureIdentityMappingForAnime(anime);
      mappingResults.push(mapping ? 1 : 0);

      // TMDB Enhancement for Banners
      try {
        const query = anime.title?.english || anime.title?.romaji;
        if (query) {
          const tmdbResult = await searchTmdbSeries(query);
          // Strict filtering: must be an Animation (16) and preferably Japanese
          const isAnime = tmdbResult?.genre_ids?.includes(16);
          const isJapanese = tmdbResult?.original_language === 'ja';

          if (tmdbResult?.backdrop_path && (isAnime || isJapanese)) {
            const bannerUrl = getTmdbImageUrl(tmdbResult.backdrop_path, 'original');
            await supabaseAdmin.from('anime_cache')
              .update({ external_banner_url: bannerUrl })
              .eq('id', anime.id);
          }
        }
      } catch (err) {
        console.warn('TMDB Fetch Error:', err);
      }
    }

    steps.push({
      step: 'identity_map',
      result: {
        mapped: mappingResults.filter(Boolean).length,
        total: allSeasonalAnime.length
      }
    });

    const airingStatuses = await fetchAiringStatuses(animeIds);
    const livechartResult = await recordLiveChartStatuses(airingStatuses);

    steps.push({
      step: 'livechart_breaks',
      result: livechartResult
    });

    const statusUpdates = Object.values(airingStatuses).map((status) => ({
      id: status.id,
      status: status.status,
      updated_at: new Date().toISOString()
    }));

    if (statusUpdates.length) {
      await supabaseAdmin.from('anime_cache').upsert(statusUpdates, { onConflict: 'id' });
    }

    await supabaseAdmin
      .from('refresh_cycles')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        details: { steps }
      })
      .eq('id', jobId);

    return {
      success: true,
      jobId,
      steps
    };
  } catch (error) {
    await supabaseAdmin
      .from('refresh_cycles')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        details: { steps, error: (error as Error).message ?? 'unknown' }
      })
      .eq('id', jobId);
    throw error;
  }
}
