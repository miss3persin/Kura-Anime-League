CREATE OR REPLACE FUNCTION award_season_badges(p_season_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  rank_num INT := 0;
  badge TEXT;
BEGIN
  FOR rec IN
    SELECT user_id, total_season_kp
    FROM season_scores
    WHERE season_id = p_season_id
    ORDER BY total_season_kp DESC, created_at ASC
  LOOP
    rank_num := rank_num + 1;

    badge := CASE
      WHEN rank_num = 1 THEN 'adamantite'
      WHEN rank_num <= 10 THEN 'mythril'
      WHEN rank_num <= 50 THEN 'diamond'
      WHEN rank_num <= 200 THEN 'platinum'
      WHEN rank_num <= 500 THEN 'gold'
      WHEN rank_num <= 1000 THEN 'silver'
      ELSE 'bronze'
    END;

    UPDATE season_scores
    SET final_rank = rank_num,
        badge_tier = badge,
        completed_at = now()
    WHERE user_id = rec.user_id
      AND season_id = p_season_id;

    UPDATE profiles
    SET tier = badge
    WHERE id = rec.user_id;
  END LOOP;
END;
$$;
