-- Phase 2 schema additions: leagues, transfers, weekly scores, predictions, and related RLS.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS captain_anime_id BIGINT REFERENCES public.anime_cache(id),
  ADD COLUMN IF NOT EXISTS vice_captain_anime_id BIGINT REFERENCES public.anime_cache(id),
  ADD COLUMN IF NOT EXISTS transfers_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_transfers INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.leagues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE,
  max_members INTEGER DEFAULT 12,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.league_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  anime_out_id BIGINT REFERENCES public.anime_cache(id),
  anime_in_id BIGINT REFERENCES public.anime_cache(id),
  kp_cost INTEGER DEFAULT 0,
  week_number INTEGER NOT NULL,
  transferred_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.weekly_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  score INTEGER DEFAULT 0,
  breakdown JSONB,
  calculated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(team_id, week_number)
);

CREATE TABLE IF NOT EXISTS public.matchups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  winner_team_id UUID REFERENCES public.teams(id),
  is_final BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(league_id, week_number, home_team_id, away_team_id)
);

CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL,
  prediction_type TEXT NOT NULL,
  anime_id BIGINT REFERENCES public.anime_cache(id),
  predicted_value TEXT,
  kp_wager INTEGER DEFAULT 100,
  is_resolved BOOLEAN DEFAULT FALSE,
  is_correct BOOLEAN,
  kp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, season_id, week_number, prediction_type)
);

CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_team ON public.weekly_scores(team_id);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_week ON public.weekly_scores(week_number);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_team ON public.transfers(team_id);
CREATE INDEX IF NOT EXISTS idx_matchups_league ON public.matchups(league_id, week_number);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leagues are viewable by everyone" ON public.leagues;
DROP POLICY IF EXISTS "Authenticated users can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Owners can update their leagues" ON public.leagues;

DROP POLICY IF EXISTS "League members are viewable by everyone" ON public.league_members;
DROP POLICY IF EXISTS "Users can join leagues" ON public.league_members;
DROP POLICY IF EXISTS "Users can leave leagues" ON public.league_members;

DROP POLICY IF EXISTS "Users can view all transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can manage their team transfers" ON public.transfers;

DROP POLICY IF EXISTS "Weekly scores are public" ON public.weekly_scores;
DROP POLICY IF EXISTS "Service can insert scores" ON public.weekly_scores;
DROP POLICY IF EXISTS "Service can update scores" ON public.weekly_scores;

DROP POLICY IF EXISTS "Matchups are public" ON public.matchups;
DROP POLICY IF EXISTS "Service can manage matchups" ON public.matchups;

DROP POLICY IF EXISTS "Predictions are viewable by everyone" ON public.predictions;
DROP POLICY IF EXISTS "Users can manage their own predictions" ON public.predictions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Leagues are viewable by everyone' AND schemaname = 'public' AND tablename = 'leagues') THEN
    CREATE POLICY "Leagues are viewable by everyone" ON public.leagues FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can create leagues' AND schemaname = 'public' AND tablename = 'leagues') THEN
    CREATE POLICY "Authenticated users can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update their leagues' AND schemaname = 'public' AND tablename = 'leagues') THEN
    CREATE POLICY "Owners can update their leagues" ON public.leagues FOR UPDATE USING (auth.uid() = owner_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'League members are viewable by everyone' AND schemaname = 'public' AND tablename = 'league_members') THEN
    CREATE POLICY "League members are viewable by everyone" ON public.league_members FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can join leagues' AND schemaname = 'public' AND tablename = 'league_members') THEN
    CREATE POLICY "Users can join leagues" ON public.league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can leave leagues' AND schemaname = 'public' AND tablename = 'league_members') THEN
    CREATE POLICY "Users can leave leagues" ON public.league_members FOR DELETE USING (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all transfers' AND schemaname = 'public' AND tablename = 'transfers') THEN
    CREATE POLICY "Users can view all transfers" ON public.transfers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their team transfers' AND schemaname = 'public' AND tablename = 'transfers') THEN
    CREATE POLICY "Users can manage their team transfers" ON public.transfers FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.teams WHERE id = transfers.team_id AND user_id = auth.uid())
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Weekly scores are public' AND schemaname = 'public' AND tablename = 'weekly_scores') THEN
    CREATE POLICY "Weekly scores are public" ON public.weekly_scores FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service can insert scores' AND schemaname = 'public' AND tablename = 'weekly_scores') THEN
    CREATE POLICY "Service can insert scores" ON public.weekly_scores FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service can update scores' AND schemaname = 'public' AND tablename = 'weekly_scores') THEN
    CREATE POLICY "Service can update scores" ON public.weekly_scores FOR UPDATE USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Matchups are public' AND schemaname = 'public' AND tablename = 'matchups') THEN
    CREATE POLICY "Matchups are public" ON public.matchups FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service can manage matchups' AND schemaname = 'public' AND tablename = 'matchups') THEN
    CREATE POLICY "Service can manage matchups" ON public.matchups FOR ALL USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Predictions are viewable by everyone' AND schemaname = 'public' AND tablename = 'predictions') THEN
    CREATE POLICY "Predictions are viewable by everyone" ON public.predictions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own predictions' AND schemaname = 'public' AND tablename = 'predictions') THEN
    CREATE POLICY "Users can manage their own predictions" ON public.predictions FOR ALL USING (auth.uid() = user_id);
  END IF;
END;
$$;
