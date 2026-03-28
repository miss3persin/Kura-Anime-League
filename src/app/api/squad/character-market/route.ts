import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SeasonRow = {
  id: string;
  status: string;
  draft_opens_at: string | null;
  draft_closes_at: string | null;
};

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const overrideSeasonId = searchParams.get("seasonId");
    const supabase = getSupabaseAdmin();
    const now = new Date();

    // Fetch active + earliest upcoming season
    const [{ data: activeSeason }, { data: upcomingSeason }] = await Promise.all([
      supabase
        .from("seasons")
        .select("id,status,draft_opens_at,draft_closes_at")
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("seasons")
        .select("id,status,draft_opens_at,draft_closes_at")
        .eq("status", "upcoming")
        .order("draft_opens_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const draftOpens = parseDate(upcomingSeason?.draft_opens_at);
    const draftCloses = parseDate(upcomingSeason?.draft_closes_at);
    const upcomingDraftOpen =
      draftOpens && draftCloses && draftOpens <= now && now < draftCloses;

    // Use upcoming season if its draft window is open; otherwise fall back to active
    const targetSeason: SeasonRow | null =
      (overrideSeasonId && { id: overrideSeasonId, status: upcomingSeason?.status ?? activeSeason?.status ?? 'upcoming', draft_opens_at: null, draft_closes_at: null } as SeasonRow) ||
      (upcomingDraftOpen && upcomingSeason) || activeSeason || upcomingSeason || null;

    if (!targetSeason?.id) {
      return NextResponse.json({ items: [] });
    }

    // Get anime IDs for that season
    const isUuid = typeof targetSeason.id === "string" && targetSeason.id.includes("-");
    const numericSeasonId = Number(targetSeason.id);
    if (!isUuid && !Number.isFinite(numericSeasonId)) {
      return NextResponse.json({ items: [] });
    }

    const { data: animeRows, error: animeError } = await supabase
      .from("anime_cache")
      .select("id")
      .eq(isUuid ? "season_uuid" : "season_id", isUuid ? targetSeason.id : numericSeasonId);

    if (animeError) throw animeError;

    const animeIds = (animeRows ?? [])
      .map((r) => Number(r.id))
      .filter((n) => Number.isFinite(n));
    if (!animeIds.length) {
      return NextResponse.json({ items: [] });
    }

    // Match draft page filters: gender limited, age >=16, and seasonal filter
    const { data: characters, error: charError } = await supabase
      .from("character_cache")
      .select("id,name,image,role,favorites,price,anime_id,gender,age")
      .in("gender", ["Male", "Female"])
      .gte("age", 16)
      .in("anime_id", animeIds)
      .order("favorites", { ascending: false })
      .limit(50);

    if (charError) throw charError;

    return NextResponse.json({ items: characters ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load character market";
    console.error("character-market error", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
