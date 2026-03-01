import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchAiringStatuses } from '@/lib/animeSources';
import { buildAnimeCachePayload, buildCharacterPayloads, determineSeasonContexts, fetchSeasonalAnimeList, SeasonalAnimeEntry } from '@/lib/sync';
import { ensureIdentityMappingForAnime } from '@/lib/identityMapping';
import { recordLiveChartStatuses } from '@/lib/livechart';
import { getTmdbImageUrl, searchTmdbSeries } from '@/lib/tmdb';

const JOB_NAME = 'anime_cache_refresh';

interface RefreshStep {
  step: string;
  result: Record<string, unknown>;
}

export interface RefreshCycleResult {
  success: boolean;
  jobId?: string;
  steps: RefreshStep[];
}

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

    const allSeasonalAnime: { anime: SeasonalAnimeEntry; context: any }[] = [];

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
      const { error: charErr } = await supabaseAdmin.from('character_cache').upsert(uniqueCharacters, { onConflict: 'id' });
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
          if (tmdbResult?.backdrop_path) {
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
