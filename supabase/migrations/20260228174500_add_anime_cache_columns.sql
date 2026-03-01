-- Migration to add columns for eligibility, adult content, popularity, and correct season references in anime_cache.
ALTER TABLE anime_cache
ADD COLUMN IF NOT EXISTS is_eligible BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_adult BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS popularity INT DEFAULT 0;

-- Ensure season_uuid exists and is indexed if not already present (it might have been added in a previous migration but let's be sure).
ALTER TABLE anime_cache
ADD COLUMN IF NOT EXISTS season_uuid UUID REFERENCES seasons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS anime_cache_season_uuid_idx ON anime_cache(season_uuid);

-- Update draft page query logic relies on season_uuid if season_id is int.
-- Also, the `season_id` column is confusing because it's an INT but seasons.id is UUID now.
-- Ideally, we should rename `season_id` to `season_ani_id` or similar if it refers to AniList season ID,
-- OR remove it if it's meant to be a foreign key to `seasons`.
-- For now, adding season_uuid is safer and we can use that for joins.

-- Update hype_history to reference season_uuid correctly?
-- hype_history already uses season_id UUID REFERENCES seasons(id). So that's fine.

-- Re-enable RLS if needed, but for now just schema changes.
