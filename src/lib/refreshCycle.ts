import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchAiringStatuses } from '@/lib/animeSources';
import { buildAnimeCachePayload, buildCharacterPayloads, determineSeasonContext, fetchSeasonalAnimeList } from '@/lib/sync';
import { ensureIdentityMappingForAnime } from '@/lib/identityMapping';
import { recordLiveChartStatuses } from '@/lib/livechart';

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
    throw new Error('Failed to create refresh cycle record');
  }

  const jobId = job.id;
  const steps: RefreshStep[] = [];

  try {
    const seasonContext = await determineSeasonContext();
    const seasonalList = await fetchSeasonalAnimeList(seasonContext);
    const animeIds = seasonalList.map((anime) => anime.id);

    const animePayloads = seasonalList.map((anime) => buildAnimeCachePayload(anime, seasonContext));
    if (animePayloads.length) {
      await supabaseAdmin.from('anime_cache').upsert(animePayloads, { onConflict: 'id' });
    }

    const characterPayloads = seasonalList.flatMap((anime) => buildCharacterPayloads(anime));
    if (characterPayloads.length) {
      await supabaseAdmin.from('character_cache').upsert(characterPayloads, { onConflict: 'id' });
    }

    steps.push({
      step: 'seasonal_sync',
      result: {
        season: seasonContext.seasonName,
        count: seasonalList.length
      }
    });

    const mappingResults = [];
    for (const anime of seasonalList) {
      const mapping = await ensureIdentityMappingForAnime(anime);
      mappingResults.push(mapping ? 1 : 0);
    }

    steps.push({
      step: 'identity_map',
      result: {
        mapped: mappingResults.filter(Boolean).length,
        total: seasonalList.length
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
