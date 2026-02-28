-- Add columns that let us associate AniList entries with Kitsu IDs for fallback fetches.

ALTER TABLE public.anime_cache
  ADD COLUMN IF NOT EXISTS kitsu_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_anime_cache_kitsu_id ON public.anime_cache(kitsu_id);
