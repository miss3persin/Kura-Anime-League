-- ============================================================
-- 🏮 KAL Utility Functions — Run this in Supabase SQL Editor
-- =================================───────────────────────────

-- Function to safely increment/decrement user KuraPoints
CREATE OR REPLACE FUNCTION public.increment_kp(user_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET total_kp = total_kp + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle league joining counts (if using nested selects)
-- Optional: ensure profiles have default KP for new users
ALTER TABLE public.profiles ALTER COLUMN total_kp SET DEFAULT 20000;
-- UPDATE public.profiles SET total_kp = 20000 WHERE total_kp = 5000;
