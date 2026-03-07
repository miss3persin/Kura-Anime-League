CREATE OR REPLACE FUNCTION perform_transfer(
    p_team_id UUID,
    p_anime_out_id INT,
    p_anime_in_id INT,
    p_new_remaining_kp INT,
    p_new_transfers_used INT,
    p_captain_anime_id INT,
    p_vice_captain_anime_id INT,
    p_kp_cost INT,
    p_week_number INT,
    p_season_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Start a transaction
    BEGIN
        -- 1. Delete the outgoing anime pick
        DELETE FROM team_picks
        WHERE team_id = p_team_id AND anime_id = p_anime_out_id;

        -- 2. Insert the incoming anime pick
        INSERT INTO team_picks (team_id, anime_id)
        VALUES (p_team_id, p_anime_in_id);

        -- 3. Update the team's remaining KP, transfers used, and Captain/VC assignments
        UPDATE teams
        SET
            remaining_kp = p_new_remaining_kp,
            transfers_used = p_new_transfers_used,
            captain_anime_id = p_captain_anime_id,
            vice_captain_anime_id = p_vice_captain_anime_id
        WHERE id = p_team_id;

        -- 4. Insert a record into the transfers history table
        INSERT INTO transfers (team_id, anime_out_id, anime_in_id, kp_cost, week_number, season_id)
        VALUES (p_team_id, p_anime_out_id, p_anime_in_id, p_kp_cost, p_week_number, p_season_id);

    END; -- End of transaction block (implicitly committed if no errors, rolled back on error)
END;
$$;