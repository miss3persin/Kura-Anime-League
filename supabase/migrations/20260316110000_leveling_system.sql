-- Leveling system: lifetime KP tracking + derived levels.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS lifetime_kp INTEGER DEFAULT 0;

INSERT INTO public.admin_content (key, value)
VALUES (
  'leveling_config',
  '{"base_kp":1500,"growth_rate":1.18}'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.calculate_level(total_lifetime_kp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  base_kp INTEGER := 1500;
  growth_rate NUMERIC := 1.18;
  config JSONB;
  remaining NUMERIC := GREATEST(COALESCE(total_lifetime_kp, 0), 0);
  lvl INTEGER := 1;
  requirement NUMERIC;
BEGIN
  SELECT value INTO config FROM public.admin_content WHERE key = 'leveling_config';

  IF config ? 'base_kp' AND (config->>'base_kp') ~ '^[0-9]+$' THEN
    base_kp := GREATEST((config->>'base_kp')::INTEGER, 100);
  END IF;

  IF config ? 'growth_rate' AND (config->>'growth_rate') ~ '^[0-9]+([.][0-9]+)?$' THEN
    growth_rate := GREATEST((config->>'growth_rate')::NUMERIC, 1.01);
  END IF;

  LOOP
    requirement := base_kp * POWER(growth_rate, lvl - 1);
    EXIT WHEN remaining < requirement;
    remaining := remaining - requirement;
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.recalculate_levels()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET level = public.calculate_level(lifetime_kp);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.apply_profile_leveling()
RETURNS trigger AS $$
DECLARE
  delta INTEGER := 0;
  base_start INTEGER := 20000;
  new_lifetime INTEGER := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_lifetime := GREATEST(COALESCE(NEW.total_kp, 0) - base_start, 0);
    NEW.lifetime_kp := new_lifetime;
    NEW.level := public.calculate_level(new_lifetime);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    delta := COALESCE(NEW.total_kp, 0) - COALESCE(OLD.total_kp, 0);
    new_lifetime := COALESCE(OLD.lifetime_kp, 0) + GREATEST(delta, 0);
    NEW.lifetime_kp := new_lifetime;
    NEW.level := public.calculate_level(new_lifetime);
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_leveling_before_insert ON public.profiles;
CREATE TRIGGER profile_leveling_before_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.apply_profile_leveling();

DROP TRIGGER IF EXISTS profile_leveling_before_update ON public.profiles;
CREATE TRIGGER profile_leveling_before_update
BEFORE UPDATE OF total_kp ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.apply_profile_leveling();

UPDATE public.profiles
SET lifetime_kp = GREATEST(COALESCE(total_kp, 0) - 20000, 0),
    level = public.calculate_level(GREATEST(COALESCE(total_kp, 0) - 20000, 0));
