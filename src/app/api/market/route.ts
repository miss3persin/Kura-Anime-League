import { NextRequest, NextResponse } from "next/server";
import { getHistoryChange, type AnimeHypeHistoryEntry } from "@/lib/hype";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type MarketAnime = {
  id: number;
  title_romaji: string;
  title_english: string | null;
  cover_image: string | null;
  banner_image?: string | null;
  external_banner_url?: string | null;
  description?: string | null;
  hype_score: number | null;
  hype_change: number | null;
  cost_kp: number | null;
  average_score?: number | null;
  status?: string | null;
  is_eligible?: boolean | null;
  season_uuid?: string | null;
  hype_history?: AnimeHypeHistoryEntry[] | null;
};

function parseNumberParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") ?? "change";
    const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";
    const limit = parseNumberParam(searchParams.get("limit"), 100);
    const rangeMs = parseNumberParam(searchParams.get("rangeMs"), 1000 * 60 * 60 * 24);

    const seasonsResponse = await fetch(new URL("/api/seasons/current", request.url), {
      cache: "no-store"
    });
    const seasonsPayload = await seasonsResponse.json().catch(() => ({}));
    if (!seasonsResponse.ok) {
      throw new Error(seasonsPayload.error ?? "Failed to resolve current market season");
    }

    const marketSeasonId =
      seasonsPayload?.draftSeason?.id ??
      seasonsPayload?.activeSeason?.id ??
      seasonsPayload?.upcomingSeason?.id ??
      null;

    let query = supabaseAdmin
      .from("anime_cache")
      .select("id, title_romaji, title_english, cover_image, banner_image, external_banner_url, description, hype_score, hype_change, cost_kp, average_score, status, is_eligible, season_uuid, hype_history");

    if (marketSeasonId) {
      query = query.eq("season_uuid", marketSeasonId);
    }

    const { data, error } = await query.limit(limit);
    if (error) {
      throw error;
    }

    const market = ((data as MarketAnime[] | null) ?? []).map((anime) => {
      const currentPrice = anime.cost_kp ?? 2500;
      const change = getHistoryChange(anime.hype_history ?? [], rangeMs, currentPrice);

      return {
        ...anime,
        hype_score: anime.hype_score ?? 0,
        hype_change: anime.hype_change ?? 0,
        cost_kp: currentPrice,
        market_change_percent: change.percent,
        market_change_delta: change.delta
      };
    });

    const sorted = [...market].sort((left, right) => {
      const multiplier = direction === "asc" ? 1 : -1;

      if (sort === "hype") {
        return ((left.hype_score ?? 0) - (right.hype_score ?? 0)) * multiplier;
      }

      if (sort === "price") {
        return ((left.cost_kp ?? 0) - (right.cost_kp ?? 0)) * multiplier;
      }

      return ((left.market_change_percent ?? 0) - (right.market_change_percent ?? 0)) * multiplier;
    });

    return NextResponse.json({
      seasonId: marketSeasonId,
      rangeMs,
      items: sorted
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
