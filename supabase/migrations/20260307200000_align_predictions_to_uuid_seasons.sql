-- Align predictions with UUID-based seasons and refresh the prediction bet RPC.
BEGIN;

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS season_id_uuid UUID;

DO $$
DECLARE
  season_id_type TEXT;
BEGIN
  SELECT data_type
  INTO season_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'predictions'
    AND column_name = 'season_id';

  IF season_id_type = 'uuid' THEN
    EXECUTE $sql$
      UPDATE public.predictions
      SET season_id_uuid = season_id
      WHERE season_id_uuid IS NULL
    $sql$;
  ELSIF season_id_type IN ('smallint', 'integer', 'bigint') THEN
    EXECUTE $sql$
      UPDATE public.predictions p
      SET season_id_uuid = s.id
      FROM public.seasons s
      WHERE p.season_id_uuid IS NULL
        AND s.season_number = p.season_id
    $sql$;
  ELSE
    RAISE EXCEPTION 'Unsupported predictions.season_id type: %', season_id_type;
  END IF;
END;
$$;

DO $$
DECLARE
  missing_count INT;
BEGIN
  SELECT COUNT(*)
  INTO missing_count
  FROM public.predictions
  WHERE season_id IS NOT NULL
    AND season_id_uuid IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Could not map % prediction rows from legacy integer season_id values to UUID seasons.id values.', missing_count;
  END IF;
END;
$$;

ALTER TABLE public.predictions
  DROP CONSTRAINT IF EXISTS predictions_user_id_season_id_week_number_prediction_type_key,
  DROP CONSTRAINT IF EXISTS predictions_season_id_fkey;

DROP INDEX IF EXISTS idx_predictions_season;

ALTER TABLE public.predictions
  DROP COLUMN season_id;

ALTER TABLE public.predictions
  RENAME COLUMN season_id_uuid TO season_id;

ALTER TABLE public.predictions
  ALTER COLUMN season_id SET NOT NULL;

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_season_id_fkey
    FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_user_event_key
    UNIQUE (user_id, season_id, week_number, prediction_type, anime_id);

CREATE INDEX IF NOT EXISTS idx_predictions_season ON public.predictions(season_id);

CREATE OR REPLACE FUNCTION public.place_prediction_bet(
    p_user_id UUID,
    p_season_id UUID,
    p_week_number INT,
    p_prediction_type TEXT,
    p_anime_id INT,
    p_chosen_option_value TEXT,
    p_wager_amount INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_kp INT;
BEGIN
    SELECT total_kp INTO current_kp
    FROM public.profiles
    WHERE id = p_user_id;

    IF current_kp < p_wager_amount THEN
        RAISE EXCEPTION 'Insufficient KuraPoints for this wager.';
    END IF;

    UPDATE public.profiles
    SET total_kp = total_kp - p_wager_amount
    WHERE id = p_user_id;

    INSERT INTO public.predictions (
        user_id,
        season_id,
        week_number,
        prediction_type,
        anime_id,
        predicted_value,
        kp_wager
    )
    VALUES (
        p_user_id,
        p_season_id,
        p_week_number,
        p_prediction_type,
        p_anime_id,
        p_chosen_option_value,
        p_wager_amount
    );

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'You have already placed a prediction for this event.';
    WHEN others THEN
        RAISE EXCEPTION 'An unexpected error occurred during prediction placement: %', SQLERRM;
END;
$$;

COMMIT;
