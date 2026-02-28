-- Mirrors AniList/MAL/Kitsu IDs with metadata so we can resolve fallbacks without re-querying the offline database on every run.

CREATE TABLE IF NOT EXISTS public.anime_identity_map (
  anilist_id BIGINT PRIMARY KEY,
  kitsu_id BIGINT,
  mal_id BIGINT,
  title TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anime_identity_map_kitsu ON public.anime_identity_map(kitsu_id);
CREATE INDEX IF NOT EXISTS idx_anime_identity_map_mal ON public.anime_identity_map(mal_id);
