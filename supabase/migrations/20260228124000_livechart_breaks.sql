-- Stores LiveChart/scraped schedule statuses so scoring can see manual break/highatus info without hitting AniList.

CREATE TABLE IF NOT EXISTS public.livechart_breaks (
  anime_id BIGINT PRIMARY KEY REFERENCES public.anime_cache(id) ON DELETE CASCADE,
  status TEXT,
  next_airing_at TIMESTAMPTZ,
  source TEXT,
  note TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_livechart_breaks_updated_at ON public.livechart_breaks(updated_at DESC);
