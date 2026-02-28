-- Utility helpers shared by sync jobs: increment_kp and default enforcement.

CREATE OR REPLACE FUNCTION public.increment_kp(user_id UUID, amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET total_kp = total_kp + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.profiles ALTER COLUMN total_kp SET DEFAULT 20000;
