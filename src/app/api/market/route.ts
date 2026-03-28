import { NextRequest, NextResponse } from "next/server";
import { getHistoryChange, type AnimeHypeHistoryEntry } from "@/lib/hype";
import { fetchAiringStatuses } from "@/lib/animeSources";
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

function normalizeStatus(raw?: string | null) {
  if (!raw) return "FINISHED";
  const upper = raw.toString().trim().toUpperCase();
  if (!upper) return "FINISHED";
  if (upper.includes("HIATUS")) return "HIATUS";
  if (upper.includes("CANCEL")) return "CANCELLED";
  if (upper.includes("RELEASING") || upper.includes("AIRING") || upper.includes("CURRENT")) return "RELEASING";
  if (upper.includes("FINISHED") || upper.includes("COMPLETE")) return "FINISHED";
  if (upper.includes("NOT_YET") || upper.includes("NOT_RELEASED") || upper.includes("UNRELEASED") || upper.includes("UPCOMING")) {
    return "UNRELEASED";
  }
  return upper;
}

function deriveDisplayStatus(anime: MarketAnime) {
  const normalized = normalizeStatus(anime.status);
  if (normalized === "UNRELEASED" && (anime.average_score ?? 0) > 0) {
    return "RELEASING";
  }
  return normalized;
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

    const activeSeasonId = seasonsPayload?.activeSeason?.id ?? null;
    const upcomingSeasonId = seasonsPayload?.upcomingSeason?.id ?? null;
    const currentWeek = Number(seasonsPayload?.currentWeek ?? 0);
    const totalWeeks = Number(seasonsPayload?.totalWeeks ?? 0);
    const halfway = totalWeeks > 0 ? currentWeek / totalWeeks >= 0.5 : false;
    const seasonIds = new Set<string | number>();

    if (activeSeasonId) {
      seasonIds.add(activeSeasonId);
      if (upcomingSeasonId && halfway) {
        seasonIds.add(upcomingSeasonId);
      }
    } else if (upcomingSeasonId) {
      seasonIds.add(upcomingSeasonId);
    }

    let query = supabaseAdmin
      .from("anime_cache")
      .select("id, title_romaji, title_english, cover_image, banner_image, external_banner_url, description, hype_score, hype_change, cost_kp, average_score, status, is_eligible, season_uuid, hype_history");

    if (seasonIds.size === 1) {
      const [seasonId] = Array.from(seasonIds);
      query = query.eq("season_uuid", seasonId);
    } else if (seasonIds.size > 1) {
      query = query.in("season_uuid", Array.from(seasonIds));
    }

    const { data, error } = await query.limit(limit);
    if (error) {
      throw error;
    }

    const baseMarket = (data as MarketAnime[] | null) ?? [];
    const liveStatusEnabled = process.env.MARKET_LIVE_STATUS === "true" || process.env.NODE_ENV !== "production";
    let liveStatusMap: Record<number, { status?: string; averageScore?: number | null }> = {};

    if (liveStatusEnabled && baseMarket.length > 0) {
      try {
        const liveStatuses = await fetchAiringStatuses(baseMarket.map((anime) => anime.id));
        liveStatusMap = Object.fromEntries(
          Object.entries(liveStatuses).map(([id, entry]) => [
            Number(id),
            { status: entry.status, averageScore: entry.averageScore ?? null }
          ])
        );
      } catch (err) {
        console.warn("Market live status fetch failed, falling back to cached status", err);
      }
    }

    const market = baseMarket.map((anime) => {
      const currentPrice = anime.cost_kp ?? 2500;
      const change = getHistoryChange(anime.hype_history ?? [], rangeMs, currentPrice);
      const live = liveStatusMap[anime.id];
      const mergedStatus = live?.status ?? anime.status;
      const mergedAverage = live?.averageScore ?? anime.average_score;

      return {
        ...anime,
        hype_score: anime.hype_score ?? 0,
        hype_change: anime.hype_change ?? 0,
        cost_kp: currentPrice,
        average_score: mergedAverage ?? null,
        status: deriveDisplayStatus({ ...anime, status: mergedStatus ?? anime.status, average_score: mergedAverage }),
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
      seasonId: Array.from(seasonIds)[0] ?? null,
      seasonIds: Array.from(seasonIds),
      rangeMs,
      items: sorted
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
