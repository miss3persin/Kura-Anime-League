-- Reset character locks and picks for all teams.
-- This keeps anime locks intact but clears character state so users can re-pick.

BEGIN;

-- Clear character lock timestamps; preserve overall lock if anime is locked.
UPDATE teams
SET
  locked_characters_at = NULL,
  locked_at = CASE
                WHEN locked_anime_at IS NOT NULL THEN locked_anime_at
                ELSE NULL
              END;

-- Remove all character picks so users start fresh.
DELETE FROM character_picks;

COMMIT;
