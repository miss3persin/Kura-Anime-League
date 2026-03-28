-- Adds separate lock timestamps for anime lineup and character picks
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS locked_anime_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_characters_at TIMESTAMPTZ;
