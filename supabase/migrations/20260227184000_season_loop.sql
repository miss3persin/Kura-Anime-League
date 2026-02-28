-- Season loop overhaul: switches to UUID seasons + adds hype history, season scoring, payouts, carry-over picks, and badge helpers.
-- WARNING: this migration drops and recreates the season-related tables so that they can switch to UUIDs and the new column set.
-- Make sure production data is exported/migrated before running this against a live database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS carry_over_picks CASCADE;
DROP TABLE IF EXISTS season_scores CASCADE;
DROP TABLE IF EXISTS hype_history CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season_number INT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','active','completed','archived')),
  draft_opens_at TIMESTAMPTZ,
  draft_closes_at TIMESTAMPTZ,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  transfer_review_ends_at TIMESTAMPTZ,
  week_number INT NOT NULL DEFAULT 0 CHECK (week_number >= 0),
  total_weeks INT NOT NULL DEFAULT 12 CHECK (total_weeks > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS only_one_active_season ON seasons ((status)) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS seasons_status_idx ON seasons(status);

CREATE TABLE IF NOT EXISTS hype_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id INT NOT NULL,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number >= 0),
  hype_score NUMERIC(6,2) DEFAULT 0 CHECK (hype_score >= 0),
  cost_kp INT DEFAULT 0 CHECK (cost_kp >= 0),
  trending INT DEFAULT 0,
  change_pct NUMERIC(5,2) DEFAULT 0,
  scored_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(anime_id, season_id, week_number)
);

CREATE INDEX IF NOT EXISTS hype_history_season_week_idx ON hype_history(season_id, week_number);

CREATE TABLE IF NOT EXISTS season_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  total_season_kp INT DEFAULT 0 CHECK (total_season_kp >= 0),
  final_rank INT,
  badge_tier TEXT DEFAULT 'bronze',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, season_id)
);

CREATE INDEX IF NOT EXISTS season_scores_leaderboard_idx ON season_scores(season_id, total_season_kp DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS season_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INT DEFAULT 0 CHECK (amount >= 0),
  badge_tier TEXT,
  final_rank INT,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, user_id)
);

CREATE INDEX IF NOT EXISTS season_payouts_season_idx ON season_payouts(season_id);

ALTER TABLE teams
  DROP COLUMN IF EXISTS season_id,
  DROP COLUMN IF EXISTS locked_at,
  DROP COLUMN IF EXISTS season_budget_kp,
  DROP COLUMN IF EXISTS season_kp;

ALTER TABLE teams
  ADD COLUMN season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN season_budget_kp INT DEFAULT 5000 CHECK (season_budget_kp >= 0),
  ADD COLUMN season_kp INT DEFAULT 0 CHECK (season_kp >= 0);

CREATE INDEX teams_season_idx ON teams(season_id);

ALTER TABLE weekly_scores
  DROP COLUMN IF EXISTS season_id,
  DROP COLUMN IF EXISTS breakdown,
  DROP COLUMN IF EXISTS season_kp_running_total;

ALTER TABLE weekly_scores
  ADD COLUMN season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  ADD COLUMN breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN season_kp_running_total INT DEFAULT 0 CHECK (season_kp_running_total >= 0);

CREATE INDEX weekly_scores_season_idx ON weekly_scores(season_id);

CREATE TABLE IF NOT EXISTS carry_over_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  to_season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  anime_id INT NOT NULL,
  decision TEXT DEFAULT 'keep'
    CHECK (decision IN ('keep','drop')),
  decided_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, to_season_id, anime_id)
);

CREATE INDEX IF NOT EXISTS carry_over_user_idx ON carry_over_picks(user_id);

ALTER TABLE hype_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_over_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hype_history_public_read ON hype_history;
DROP POLICY IF EXISTS season_scores_public_read ON season_scores;
DROP POLICY IF EXISTS carry_over_own ON carry_over_picks;

CREATE POLICY hype_history_public_read ON hype_history FOR SELECT USING (true);
CREATE POLICY season_scores_public_read ON season_scores FOR SELECT USING (true);
CREATE POLICY carry_over_own ON carry_over_picks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION upsert_season_kp(
  p_user_id UUID,
  p_season_id UUID,
  p_amount INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO season_scores (user_id, season_id, total_season_kp)
  VALUES (p_user_id, p_season_id, GREATEST(0, p_amount))
  ON CONFLICT (user_id, season_id)
  DO UPDATE
  SET total_season_kp =
    GREATEST(0, season_scores.total_season_kp + p_amount);
END;
$$;

CREATE OR REPLACE FUNCTION award_season_badges(p_season_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  rank_num INT := 0;
  badge TEXT;
BEGIN
  FOR rec IN
    SELECT user_id, total_season_kp
    FROM season_scores
    WHERE season_id = p_season_id
    ORDER BY total_season_kp DESC, created_at ASC
  LOOP
    rank_num := rank_num + 1;

    badge := CASE
      WHEN rank_num = 1 THEN 'shogun'
      WHEN rank_num <= 3 THEN 'platinum'
      WHEN rank_num <= 10 THEN 'gold'
      WHEN rank_num <= 25 THEN 'silver'
      ELSE 'bronze'
    END;

    UPDATE season_scores
    SET final_rank = rank_num,
        badge_tier = badge,
        completed_at = now()
    WHERE user_id = rec.user_id
      AND season_id = p_season_id;

    UPDATE profiles
    SET tier = badge
    WHERE id = rec.user_id;
  END LOOP;
END;
$$;
