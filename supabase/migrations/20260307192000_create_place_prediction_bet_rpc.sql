CREATE OR REPLACE FUNCTION place_prediction_bet(
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
    -- Check current KP balance before deducting
    SELECT total_kp INTO current_kp
    FROM profiles
    WHERE id = p_user_id;

    IF current_kp < p_wager_amount THEN
        RAISE EXCEPTION 'Insufficient KuraPoints for this wager.';
    END IF;

    -- Deduct KP from user's profile
    UPDATE profiles
    SET total_kp = total_kp - p_wager_amount
    WHERE id = p_user_id;

    -- Insert the new prediction
    INSERT INTO predictions (user_id, season_id, week_number, prediction_type, anime_id, chosen_option_value, kp_wager, wager_date)
    VALUES (p_user_id, p_season_id, p_week_number, p_prediction_type, p_anime_id, p_chosen_option_value, p_wager_amount, now());

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'You have already placed a prediction for this event (Season, Week, Type, Anime).';
    WHEN others THEN
        RAISE EXCEPTION 'An unexpected error occurred during prediction placement: %', SQLERRM;
END;
$$;