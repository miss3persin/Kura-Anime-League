-- Ensure transfers history tracks season linkage for new transfer RPC
ALTER TABLE transfers
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE CASCADE;

-- Optional helper index for season/team queries
CREATE INDEX IF NOT EXISTS transfers_season_team_idx ON transfers(season_id, team_id);
