import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const { teamId, animeId, role, userId } = await request.json();

    if (!teamId || !userId || !role) {
        return NextResponse.json(
            { error: "Missing required fields: teamId, userId, role." },
            { status: 400 }
        );
    }

    if (role !== 'captain' && role !== 'vice_captain' && role !== 'clear_captain' && role !== 'clear_vice_captain') {
        return NextResponse.json(
            { error: "Invalid role specified. Must be 'captain', 'vice_captain', 'clear_captain', or 'clear_vice_captain'." },
            { status: 400 }
        );
    }

    try {
        const supabase = getSupabaseAdmin();

        // Fetch the current team data to check existing assignments
        const { data: team, error: fetchError } = await supabase
            .from('teams')
            .select('captain_anime_id, vice_captain_anime_id')
            .eq('id', teamId)
            .eq('user_id', userId)
            .single();

        if (fetchError || !team) {
            return NextResponse.json({ error: "Team not found or unauthorized.", details: fetchError?.message }, { status: 404 });
        }

        let updatePayload: { captain_anime_id?: number | null; vice_captain_anime_id?: number | null } = {};
        let successMessage = "Tactical role updated successfully.";

        // Logic for assigning/unassigning roles
        if (role === 'captain') {
            if (animeId === team.vice_captain_anime_id) {
                return NextResponse.json({ error: "Cannot assign as Captain, already Vice-Captain." }, { status: 400 });
            }
            updatePayload = { captain_anime_id: animeId };
            successMessage = "Anime assigned as Captain.";
        } else if (role === 'vice_captain') {
            if (animeId === team.captain_anime_id) {
                return NextResponse.json({ error: "Cannot assign as Vice-Captain, already Captain." }, { status: 400 });
            }
            updatePayload = { vice_captain_anime_id: animeId };
            successMessage = "Anime assigned as Vice-Captain.";
        } else if (role === 'clear_captain') {
            updatePayload = { captain_anime_id: null };
            successMessage = "Captain role cleared.";
        } else if (role === 'clear_vice_captain') {
            updatePayload = { vice_captain_anime_id: null };
            successMessage = "Vice-Captain role cleared.";
        } else {
             // If animeId is null for 'captain' or 'vice_captain' it implies clearing
             if (role === 'captain' && animeId === null) {
                updatePayload = { captain_anime_id: null };
                successMessage = "Captain role cleared.";
             } else if (role === 'vice_captain' && animeId === null) {
                updatePayload = { vice_captain_anime_id: null };
                successMessage = "Vice-Captain role cleared.";
             } else {
                return NextResponse.json({ error: "Invalid role or missing animeId for assignment." }, { status: 400 });
             }
        }


        const { error: updateError } = await supabase
            .from('teams')
            .update(updatePayload)
            .eq('id', teamId);

        if (updateError) {
            return NextResponse.json({ error: "Failed to update team roles.", details: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ message: successMessage }, { status: 200 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Error assigning role:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred.", details: message },
            { status: 500 }
        );
    }
}
