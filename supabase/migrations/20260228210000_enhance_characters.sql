-- Migration to enhance character_cache with gender, price, and stats.
ALTER TABLE public.character_cache
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS price INT DEFAULT 1000,
ADD COLUMN IF NOT EXISTS favorites INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS about TEXT;

-- Update ONA eligibility in existing cache (hotfix)
UPDATE public.anime_cache
SET is_eligible = false
WHERE format = 'ONA';
