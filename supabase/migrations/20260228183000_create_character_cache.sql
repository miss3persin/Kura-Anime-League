-- Migration to create the character_cache table.
CREATE TABLE IF NOT EXISTS public.character_cache (
  id BIGINT PRIMARY KEY,
  anime_id BIGINT REFERENCES public.anime_cache(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image TEXT,
  role TEXT DEFAULT 'MAIN',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.character_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Characters are viewable by everyone." ON public.character_cache FOR SELECT USING (true);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_character_cache_anime_id ON public.character_cache(anime_id);
