-- Migration to add tmdb_id to the identity map.
ALTER TABLE public.anime_identity_map
ADD COLUMN IF NOT EXISTS tmdb_id INTEGER;

-- Also add a column for external high-res banners in anime_cache
ALTER TABLE public.anime_cache
ADD COLUMN IF NOT EXISTS external_banner_url TEXT;
