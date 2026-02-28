-- Initial schema for Kura Anime League
-- Captures the core profiles, seasons, anime cache, teams, and polling tables plus RLS/policies/triggers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  level INTEGER DEFAULT 1,
  total_kp INTEGER DEFAULT 20000,
  tier TEXT DEFAULT 'Bronze',
  role TEXT DEFAULT 'player',
  is_suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.seasons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.anime_cache (
  id BIGINT PRIMARY KEY,
  title_romaji TEXT NOT NULL,
  title_english TEXT,
  cover_image TEXT,
  banner_image TEXT,
  description TEXT,
  format TEXT,
  episodes INTEGER,
  h_points INTEGER DEFAULT 0,
  cost_kp INTEGER DEFAULT 2500,
  average_score INTEGER,
  genres TEXT[],
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE,
  season_uuid UUID,
  season_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.anime_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anime_id BIGINT REFERENCES public.anime_cache(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL,
  change_percent DECIMAL(5,2),
  recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anime_history_anime_id ON public.anime_history(anime_id);
CREATE INDEX IF NOT EXISTS idx_anime_history_recorded_at ON public.anime_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_anime_cache_season_uuid ON public.anime_cache(season_uuid);

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  team_name TEXT,
  remaining_kp INTEGER DEFAULT 20000,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, season_id)
);

CREATE TABLE IF NOT EXISTS public.team_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime_cache(id) ON DELETE CASCADE NOT NULL,
  drafted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.polls (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  votes_a INTEGER DEFAULT 0,
  votes_b INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_content (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON public.admin_action_logs(created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anime_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profiles are viewable by everyone.' AND schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile.' AND schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anime cache is viewable by everyone.' AND schemaname = 'public' AND tablename = 'anime_cache') THEN
    CREATE POLICY "Anime cache is viewable by everyone." ON public.anime_cache FOR SELECT USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Teams are viewable by everyone.' AND schemaname = 'public' AND tablename = 'teams') THEN
    CREATE POLICY "Teams are viewable by everyone." ON public.teams FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own team.' AND schemaname = 'public' AND tablename = 'teams') THEN
    CREATE POLICY "Users can insert their own team." ON public.teams FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own team.' AND schemaname = 'public' AND tablename = 'teams') THEN
    CREATE POLICY "Users can update their own team." ON public.teams FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team picks are viewable by everyone.' AND schemaname = 'public' AND tablename = 'team_picks') THEN
    CREATE POLICY "Team picks are viewable by everyone." ON public.team_picks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their team picks.' AND schemaname = 'public' AND tablename = 'team_picks') THEN
    CREATE POLICY "Users can manage their team picks." ON public.team_picks FOR ALL USING (
      EXISTS (SELECT 1 FROM public.teams WHERE id = team_picks.team_id AND user_id = auth.uid())
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Polls are viewable by everyone.' AND schemaname = 'public' AND tablename = 'polls') THEN
    CREATE POLICY "Polls are viewable by everyone." ON public.polls FOR SELECT USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin content is viewable by everyone.' AND schemaname = 'public' AND tablename = 'admin_content') THEN
    CREATE POLICY "Admin content is viewable by everyone." ON public.admin_content FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin logs are viewable by admins.' AND schemaname = 'public' AND tablename = 'admin_action_logs') THEN
    CREATE POLICY "Admin logs are viewable by admins." ON public.admin_action_logs FOR SELECT USING (
      array_position(string_to_array(coalesce(current_setting('supabase.role', true), ''), ','), 'admin') IS NOT NULL
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, total_kp)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'avatar_url', 20000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
