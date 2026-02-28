import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireServiceSecret } from "@/lib/service-auth";

const DRAFT_WINDOW_DAYS = Number(process.env.SEASON_DRAFT_WINDOW_DAYS ?? "5");
const SEASON_WEEKS = Number(process.env.SEASON_TOTAL_WEEKS ?? "12");
const TRANSFER_REVIEW_DAYS = Number(process.env.SEASON_TRANSFER_REVIEW_DAYS ?? "7");
const OFFSEASON_BUFFER_DAYS = Number(process.env.SEASON_OFFSEASON_DAYS ?? "14");

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addWeeks(date: Date, weeks: number) {
  return addDays(date, weeks * 7);
}

function toISO(date: Date) {
  return date.toISOString();
}

async function activateSeason(season: any) {
  return supabaseAdmin
    .from("seasons")
    .update({
      status: "active",
      week_number: 1,
      updated_at: toISO(new Date())
    })
    .eq("id", season.id);
}

async function endSeason(season: any) {
  return supabaseAdmin
    .from("seasons")
    .update({
      status: "ended",
      week_number: season.total_weeks ?? season.week_number,
      updated_at: toISO(new Date())
    })
    .eq("id", season.id);
}

async function getNextSeasonNumber() {
  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select("season_number")
    .order("season_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const current = data?.season_number;
  if (typeof current === "number" && !Number.isNaN(current)) {
    return current + 1;
  }

  return 1;
}

async function createUpcomingSeason(name: string, baseDate: Date, seasonNumber: number) {
  const draftOpens = addDays(baseDate, OFFSEASON_BUFFER_DAYS);
  const draftCloses = addDays(draftOpens, DRAFT_WINDOW_DAYS);
  const seasonStart = draftCloses;
  const seasonEnd = addWeeks(seasonStart, SEASON_WEEKS);
  const transferReviewEnds = addDays(seasonEnd, TRANSFER_REVIEW_DAYS);

  const { data, error } = await supabaseAdmin
    .from("seasons")
    .insert({
      name,
      status: "upcoming",
      draft_opens_at: toISO(draftOpens),
      draft_closes_at: toISO(draftCloses),
      start_date: toISO(seasonStart),
      end_date: toISO(seasonEnd),
      transfer_review_ends_at: toISO(transferReviewEnds),
      season_number: seasonNumber,
      total_weeks: SEASON_WEEKS,
      week_number: 0,
      created_at: toISO(new Date()),
      updated_at: toISO(new Date())
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function POST(request: Request) {
  const unauthorized = requireServiceSecret(request);
  if (unauthorized) return unauthorized;

  const payload = await request.json().catch(() => ({}));
  const now = new Date();
  const results: string[] = [];

  try {
    const { data: activeSeason } = await supabaseAdmin
      .from("seasons")
      .select("*")
      .eq("status", "active")
      .single();

    const { data: upcomingSeason } = await supabaseAdmin
      .from("seasons")
      .select("*")
      .eq("status", "upcoming")
      .order("draft_opens_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (activeSeason) {
      const seasonEnd = activeSeason.end_date ? new Date(activeSeason.end_date) : null;
      if (seasonEnd && now >= seasonEnd) {
        await endSeason(activeSeason);
        results.push("ended active season");
      }
    }

    if (upcomingSeason) {
      const draftOpens = upcomingSeason.draft_opens_at
        ? new Date(upcomingSeason.draft_opens_at)
        : upcomingSeason.start_date
          ? new Date(upcomingSeason.start_date)
          : now;

      if (now >= draftOpens) {
        await activateSeason(upcomingSeason);
        results.push("activated upcoming season");
      }
    } else if (!upcomingSeason && (!activeSeason || (activeSeason.end_date && now >= new Date(activeSeason.end_date)))) {
      const templateName =
        payload.nextSeasonName ??
        `Season ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const baseDate =
        activeSeason && activeSeason.end_date
          ? new Date(activeSeason.end_date)
          : now;
      const seasonNumber = await getNextSeasonNumber();
      const season = await createUpcomingSeason(templateName, baseDate, seasonNumber);
      results.push(`created upcoming season ${season.name}`);
    }

    return NextResponse.json({
      success: true,
      actions: results.length ? results : ["no changes required"]
    });
  } catch (error: any) {
    console.error("Season automation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to /api/season/manage with the service secret whenever you want to advance or seed a season; automation is manual now."
  });
}
