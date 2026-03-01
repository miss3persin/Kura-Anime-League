-- Migration to add age column to character_cache.
ALTER TABLE public.character_cache
ADD COLUMN IF NOT EXISTS age INT;
