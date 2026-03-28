import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { teamId, userId, characterOutId, characterInId, pickType } = await request.json();

  if (!teamId || !userId || !characterOutId || !characterInId || !pickType) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('remaining_kp, transfers_used, free_transfers, season_id')
      .eq('id', teamId)
      .eq('user_id', userId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found or unauthorized.", details: teamError?.message }, { status: 404 });
    }

    const { data: characters, error: charError } = await supabase
      .from('character_cache')
      .select('id, price')
      .in('id', [characterOutId, characterInId]);

    if (charError || !characters || characters.length !== 2) {
      return NextResponse.json({ error: "Character details not found.", details: charError?.message }, { status: 404 });
    }

    const charOut = characters.find(c => c.id === characterOutId);
    const charIn = characters.find(c => c.id === characterInId);
    if (!charOut || !charIn) {
      return NextResponse.json({ error: "Character details missing." }, { status: 404 });
    }

    const kpDiff = charOut.price - charIn.price;
    const freeAllowance = Math.max(team.free_transfers ?? 0, 3);
    const freeLeft = freeAllowance - team.transfers_used;
    const penalty = freeLeft <= 0 ? 300 : 0;
    const newRemainingKp = team.remaining_kp + kpDiff - penalty;

    if (newRemainingKp < 0) {
      return NextResponse.json({ error: "Insufficient KP for this character transfer." }, { status: 400 });
    }

    // Replace character pick
    await supabase.from('character_picks')
      .delete()
      .eq('team_id', teamId)
      .eq('character_id', characterOutId);

    await supabase.from('character_picks').upsert({
      team_id: teamId,
      character_id: characterInId,
      pick_type: pickType
    }, { onConflict: 'team_id,character_id,pick_type' });

    await supabase.from('teams')
      .update({
        remaining_kp: newRemainingKp,
        transfers_used: team.transfers_used + 1
      })
      .eq('id', teamId);

    return NextResponse.json({ message: "Character transfer completed." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("Character transfer error:", error);
    return NextResponse.json({ error: "Unexpected error", details: message }, { status: 500 });
  }
}
