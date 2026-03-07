CREATE TABLE IF NOT EXISTS public.prediction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  anime_id BIGINT REFERENCES public.anime_cache(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prediction_type TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  deadline TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  correct_option_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS event_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'predictions'
      AND constraint_name = 'predictions_event_id_fkey'
  ) THEN
    ALTER TABLE public.predictions
      ADD CONSTRAINT predictions_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.prediction_events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prediction_events_season_week
  ON public.prediction_events(season_id, week_number, deadline);

CREATE INDEX IF NOT EXISTS idx_prediction_events_active
  ON public.prediction_events(is_active, is_resolved, deadline);

CREATE INDEX IF NOT EXISTS idx_predictions_event_id
  ON public.predictions(event_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'predictions'
      AND constraint_name = 'predictions_user_event_id_key'
  ) THEN
    ALTER TABLE public.predictions
      ADD CONSTRAINT predictions_user_event_id_key UNIQUE (user_id, event_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_prediction_event_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_prediction_event_updated_at ON public.prediction_events;

CREATE TRIGGER set_prediction_event_updated_at
BEFORE UPDATE ON public.prediction_events
FOR EACH ROW
EXECUTE FUNCTION public.set_prediction_event_updated_at();

ALTER TABLE public.prediction_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prediction_events'
      AND policyname = 'Prediction events are viewable by everyone'
  ) THEN
    CREATE POLICY "Prediction events are viewable by everyone"
      ON public.prediction_events
      FOR SELECT
      USING (true);
  END IF;
END $$;
