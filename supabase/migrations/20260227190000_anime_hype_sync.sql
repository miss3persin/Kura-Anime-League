-- Adds hype tracking columns to anime_cache and indexes required by /api/hype and sync jobs.

ALTER TABLE public.anime_cache 
  ADD COLUMN IF NOT EXISTS hype_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hype_change INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'FINISHED',
  ADD COLUMN IF NOT EXISTS hype_history JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_anime_cache_hype_score ON public.anime_cache(hype_score DESC);
CREATE INDEX IF NOT EXISTS idx_anime_cache_season_id ON public.anime_cache(season_id);
CREATE INDEX IF NOT EXISTS idx_anime_cache_season_uuid ON public.anime_cache(season_uuid);
