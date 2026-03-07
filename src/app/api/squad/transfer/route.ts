import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const { teamId, userId, animeOutId, animeInId, currentWeekNumber } = await request.json();

    if (!teamId || !userId || !animeOutId || !animeInId || currentWeekNumber === undefined) {
        return NextResponse.json(
            { error: "Missing required fields: teamId, userId, animeOutId, animeInId, currentWeekNumber." },
            { status: 400 }
        );
    }

    try {
        const supabase = getSupabaseAdmin();

        // 1. Fetch current team data
        const { data: team, error: teamFetchError } = await supabase
            .from('teams')
            .select('remaining_kp, transfers_used, free_transfers, captain_anime_id, vice_captain_anime_id, season_id')
            .eq('id', teamId)
            .eq('user_id', userId)
            .single();

        if (teamFetchError || !team) {
            return NextResponse.json({ error: "Team not found or unauthorized.", details: teamFetchError?.message }, { status: 404 });
        }

        // 2. Fetch anime details for cost calculation
        const { data: animeDetails, error: animeFetchError } = await supabase
            .from('anime_cache')
            .select('id, cost_kp')
            .in('id', [animeOutId, animeInId]);

        if (animeFetchError || !animeDetails || animeDetails.length !== 2) {
            return NextResponse.json({ error: "Could not retrieve anime details for transfer.", details: animeFetchError?.message }, { status: 404 });
        }

        const animeOut = animeDetails.find(a => a.id === animeOutId);
        const animeIn = animeDetails.find(a => a.id === animeInId);

        if (!animeOut || !animeIn) {
            return NextResponse.json({ error: "Anime details for transfer not found." }, { status: 404 });
        }

        // Calculate KP difference and transfer penalty
        const kpDiff = animeOut.cost_kp - animeIn.cost_kp; // Positive if selling more expensive anime
        const freeLeft = team.free_transfers - team.transfers_used;
        const penalty = freeLeft <= 0 ? 300 : 0; // Assuming 300 KP penalty for paid transfers

        const newRemainingKp = team.remaining_kp + kpDiff - penalty;
        if (newRemainingKp < 0) {
            return NextResponse.json({ error: "Insufficient KuraPoints for this transfer." }, { status: 400 });
        }

        // Update payload for the teams table
        let updateTeamPayload: {
            remaining_kp: number;
            transfers_used: number;
            captain_anime_id?: number | null;
            vice_captain_anime_id?: number | null;
        } = {
            remaining_kp: newRemainingKp,
            transfers_used: team.transfers_used + 1
        };

        // Clear captain/vice-captain if the transferred-out anime held a role
        if (team.captain_anime_id === animeOutId) {
            updateTeamPayload.captain_anime_id = null;
        }
        if (team.vice_captain_anime_id === animeOutId) {
            updateTeamPayload.vice_captain_anime_id = null;
        }

        // Perform transaction
        const { error: transferError } = await supabase.rpc('perform_transfer', {
            p_team_id: teamId,
            p_anime_out_id: animeOutId,
            p_anime_in_id: animeInId,
            p_new_remaining_kp: newRemainingKp,
            p_new_transfers_used: team.transfers_used + 1,
            p_captain_anime_id: updateTeamPayload.captain_anime_id !== undefined ? updateTeamPayload.captain_anime_id : team.captain_anime_id,
            p_vice_captain_anime_id: updateTeamPayload.vice_captain_anime_id !== undefined ? updateTeamPayload.vice_captain_anime_id : team.vice_captain_anime_id,
            p_kp_cost: penalty,
            p_week_number: currentWeekNumber,
            p_season_id: team.season_id,
        });
        
        if (transferError) {
            return NextResponse.json({ error: "Failed to perform transfer.", details: transferError.message }, { status: 500 });
        }

        return NextResponse.json({ message: "Transfer completed successfully." }, { status: 200 });

    } catch (error: any) {
        console.error("Error performing transfer:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred.", details: error.message },
            { status: 500 }
        );
    }
}
