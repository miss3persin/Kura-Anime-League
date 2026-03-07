ALTER TABLE public.character_cache
ADD COLUMN IF NOT EXISTS price_change NUMERIC(6,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_history JSONB DEFAULT '[]'::jsonb;
