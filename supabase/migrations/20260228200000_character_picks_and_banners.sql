-- Migration to create the character_picks table, update metadata columns, and enforce team uniqueness.

-- 1. Create character_picks table for Hero/Waifu tracking
CREATE TABLE IF NOT EXISTS public.character_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  character_id BIGINT REFERENCES public.character_cache(id) ON DELETE CASCADE NOT NULL,
  pick_type TEXT CHECK (pick_type IN ('STAR_CHAR', 'WAIFU_HUSBANDO')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, pick_type) -- Ensures only one Hero and one Waifu per team
);

-- RLS for character_picks
ALTER TABLE public.character_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Character picks are viewable by everyone." ON public.character_picks FOR SELECT USING (true);

CREATE POLICY "Users can manage their character picks." ON public.character_picks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.teams WHERE id = character_picks.team_id AND user_id = auth.uid())
);

-- 2. Add TMDB and high-res banner support to existing tables
ALTER TABLE public.anime_identity_map ADD COLUMN IF NOT EXISTS tmdb_id INTEGER;
ALTER TABLE public.anime_cache ADD COLUMN IF NOT EXISTS external_banner_url TEXT;

-- 3. Enforce team uniqueness per season (might have been dropped in earlier migrations)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_user_id_season_id_key'
  ) THEN
    ALTER TABLE public.teams ADD CONSTRAINT teams_user_id_season_id_key UNIQUE (user_id, season_id);
  END IF;
END $$;

-- 4. Add indexing for performance
CREATE INDEX IF NOT EXISTS idx_character_picks_team_id ON public.character_picks(team_id);
