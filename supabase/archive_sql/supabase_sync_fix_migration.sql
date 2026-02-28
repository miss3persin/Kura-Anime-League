-- Unified Migration: Adding missing columns to anime_cache for Hype & Seasonal Logic
-- This adds the columns required by /api/hype and /lib/sync to track market fluctuations.

ALTER TABLE public.anime_cache 
ADD COLUMN IF NOT EXISTS hype_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hype_change INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'FINISHED',
ADD COLUMN IF NOT EXISTS hype_history JSONB DEFAULT '[]'::jsonb;

-- Ensure RLS allows the sync job to work (if not using service role)
-- But we are using supabaseAdmin in lib/sync.ts now, so this is just additional safety.

-- Update indexes for faster hype sorting
CREATE INDEX IF NOT EXISTS idx_anime_cache_hype_score ON public.anime_cache(hype_score DESC);
CREATE INDEX IF NOT EXISTS idx_anime_cache_season_id ON public.anime_cache(season_id);
