-- 🏮 Kura Anime League (KAL) - Database Schema Implementation

-- 1. Create Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  level INTEGER DEFAULT 1,
  total_kp INTEGER DEFAULT 20000,
  tier TEXT DEFAULT 'Bronze',
  role TEXT DEFAULT 'player',
  is_suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Seasons Table
CREATE TABLE IF NOT EXISTS public.seasons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., 'Winter 2024'
  status TEXT DEFAULT 'active', -- 'active', 'upcoming', 'finished'
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Anime Cache (To store AniList data)
CREATE TABLE IF NOT EXISTS public.anime_cache (
  id BIGINT PRIMARY KEY, -- AniList ID
  title_romaji TEXT NOT NULL,
  title_english TEXT,
  cover_image TEXT,
  banner_image TEXT,
  description TEXT,
  format TEXT,
  episodes INTEGER,
  h_points INTEGER DEFAULT 0, -- Weekly Hype Points
  cost_kp INTEGER DEFAULT 2500, -- KP Cost to draft
  average_score INTEGER,
  genres TEXT[],
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE,
  season_uuid UUID,
  season_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.1 Create Anime Points History (For Stock Market Chart)
CREATE TABLE IF NOT EXISTS public.anime_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anime_id BIGINT REFERENCES public.anime_cache(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL,
  change_percent DECIMAL(5,2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anime_history_anime_id ON public.anime_history(anime_id);
CREATE INDEX IF NOT EXISTS idx_anime_history_recorded_at ON public.anime_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_anime_cache_season_uuid ON public.anime_cache(season_uuid);

ALTER TABLE public.anime_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anime history is viewable by everyone." ON public.anime_history FOR SELECT USING (true);

-- 4. Create Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  team_name TEXT,
  remaining_kp INTEGER DEFAULT 20000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, season_id)
);

-- 5. Create Team Picks
CREATE TABLE IF NOT EXISTS public.team_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime_cache(id) ON DELETE CASCADE NOT NULL,
  drafted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Polls Table
CREATE TABLE IF NOT EXISTS public.polls (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  votes_a INTEGER DEFAULT 0,
  votes_b INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  season_id INTEGER REFERENCES public.seasons(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anime_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

-- 8. Policies
-- Profiles: Everyone can read, users can update their own
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Anime Cache: Everyone can read
CREATE POLICY "Anime cache is viewable by everyone." ON public.anime_cache FOR SELECT USING (true);

-- Teams: Everyone can read, users can manage their own
CREATE POLICY "Teams are viewable by everyone." ON public.teams FOR SELECT USING (true);
CREATE POLICY "Users can insert their own team." ON public.teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own team." ON public.teams FOR UPDATE USING (auth.uid() = user_id);

-- Team Picks: Everyone can read, users can manage their own team's picks
CREATE POLICY "Team picks are viewable by everyone." ON public.team_picks FOR SELECT USING (true);
CREATE POLICY "Users can manage their team picks." ON public.team_picks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.teams WHERE id = team_picks.team_id AND user_id = auth.uid())
);

-- Polls: Everyone can read and vote (simplified)
CREATE POLICY "Polls are viewable by everyone." ON public.polls FOR SELECT USING (true);

-- 9. Trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, total_kp)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url', 20000);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 10. Administrative helpers
CREATE TABLE IF NOT EXISTS public.admin_content (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.admin_content (key, value)
VALUES
  ('hero_banner', '{"visible": true, "headline": "KAL Spring 2026", "subtitle": "Next cour starts April 1, 2026", "cta": "Get hyped"}'),
  ('admin_display_config', '{"show_real_time_timeline": true}')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON public.admin_action_logs(created_at DESC);
