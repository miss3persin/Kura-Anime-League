import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AiringStatus } from '@/lib/animeSources';

export interface LiveChartWriteResult {
  count: number;
}

export async function recordLiveChartStatuses(statuses: Record<number, AiringStatus>): Promise<LiveChartWriteResult> {
  const rows = Object.values(statuses).map((status) => ({
    anime_id: status.id,
    status: status.status,
    next_airing_at: status.nextAiringEpisode
      ? new Date(status.nextAiringEpisode.airingAt * 1000).toISOString()
      : null,
    source: status.source,
    note: status.source === 'LiveChart' ? 'overridden by manual break' : null,
    raw_payload: status,
    updated_at: new Date().toISOString()
  }));

  if (!rows.length) return { count: 0 };

  await supabaseAdmin
    .from('livechart_breaks')
    .upsert(rows, { onConflict: 'anime_id' });

  return { count: rows.length };
}
