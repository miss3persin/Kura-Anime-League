-- Migration: Add Arc Tracker and Achievement System

-- 1. Add Arc tracking to anime_cache
ALTER TABLE public.anime_cache
  ADD COLUMN IF NOT EXISTS current_arc TEXT,
  ADD COLUMN IF NOT EXISTS is_finale_week BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS arc_hype_multiplier DECIMAL(3,2) DEFAULT 1.0;

-- 2. Create achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Lucide icon name or URL
  requirement_type TEXT NOT NULL, -- e.g., 'score_threshold', 'streak', 'rare_pick'
  requirement_value INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Link achievements to users
CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

-- 4. Add score breakdown/modifiers to weekly_scores for audit
ALTER TABLE public.weekly_scores
  ADD COLUMN IF NOT EXISTS score_modifiers JSONB DEFAULT '[]'::jsonb;

-- 5. RLS Policies
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Achievements are viewable by everyone' AND tablename = 'achievements') THEN
    CREATE POLICY "Achievements are viewable by everyone" ON public.achievements FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own achievements' AND tablename = 'user_achievements') THEN
    CREATE POLICY "Users can view their own achievements" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Initial Seed for Achievements
INSERT INTO public.achievements (name, description, icon, requirement_type, requirement_value)
VALUES 
  ('Hipster', 'Drafted a show before it hit the Top 10 Trending list.', 'Zap', 'rare_pick', 1),
  ('GOAT Picker', 'Averaged 90+ score across your entire squad in a single week.', 'Trophy', 'score_threshold', 90),
  ('Diamond Hands', 'Held the same anime for 10 consecutive weeks.', 'Shield', 'streak', 10),
  ('Oracle', 'Correctly predicted a SCORE_OVER with a 1000+ KP wager.', 'Target', 'prediction', 1000)
ON CONFLICT DO NOTHING;
