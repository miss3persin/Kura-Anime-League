import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-data";
import { normalizePredictionOptions, mapPredictionEventRow } from "@/lib/predictions";
import { createNotification } from "@/lib/notifications";
import type { AdminPredictionEventInput, PredictionOption } from "@/lib/types/predictions";

type PredictionEventRow = {
  id: string;
  season_id: string;
  week_number: number;
  anime_id: number | null;
  title: string;
  description: string | null;
  prediction_type: string;
  options: unknown;
  deadline: string;
  is_active: boolean;
  is_resolved: boolean;
  correct_option_value: string | null;
  created_at: string;
  updated_at: string;
  anime?:
    | {
        title_romaji?: string | null;
        title_english?: string | null;
        cover_image?: string | null;
      }
    | Array<{
        title_romaji?: string | null;
        title_english?: string | null;
        cover_image?: string | null;
      }>
    | null;
};

const toIso = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const sanitizeOptions = (value: unknown, predictionType: string) => {
  const normalized = normalizePredictionOptions(value, predictionType);
  return normalized.map((option) => ({
    label: option.label.trim(),
    value: option.value.trim(),
    odds: option.odds,
  }));
};

const parsePayload = (payload: Record<string, unknown>): AdminPredictionEventInput | null => {
  const seasonId = typeof payload.seasonId === "string" ? payload.seasonId : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const predictionType = typeof payload.predictionType === "string" ? payload.predictionType.trim() : "";
  const deadline = toIso(payload.deadline);
  const rawWeekNumber = Number(payload.weekNumber);
  const rawAnimeId = payload.animeId === "" || payload.animeId === null || payload.animeId === undefined ? null : Number(payload.animeId);
  const options = sanitizeOptions(payload.options, predictionType);
  const correctOptionValue =
    typeof payload.correctOptionValue === "string" && payload.correctOptionValue.trim()
      ? payload.correctOptionValue.trim()
      : null;

  if (!seasonId || !title || !predictionType || !deadline || !Number.isInteger(rawWeekNumber) || rawWeekNumber < 1 || options.length < 2) {
    return null;
  }

  const validOptionValues = new Set(options.map((option) => option.value));
  if (correctOptionValue && !validOptionValues.has(correctOptionValue)) {
    return null;
  }

  return {
    seasonId,
    weekNumber: rawWeekNumber,
    animeId: rawAnimeId !== null && Number.isFinite(rawAnimeId) ? rawAnimeId : null,
    title,
    description,
    predictionType,
    options,
    deadline,
    isActive: Boolean(payload.isActive ?? true),
    isResolved: Boolean(payload.isResolved ?? false),
    correctOptionValue,
  };
};

const syncPredictionResolution = async (
  eventId: string,
  options: PredictionOption[],
  correctOptionValue: string | null,
  isResolved: boolean,
) => {
  if (!isResolved || !correctOptionValue) {
    await supabaseAdmin
      .from("predictions")
      .update({
        is_resolved: isResolved,
        is_correct: null,
        kp_earned: 0,
      })
      .eq("event_id", eventId);
    return;
  }

  const matchedOption = options.find((option) => option.value === correctOptionValue);
  const payoutMultiplier = matchedOption?.odds ?? 1;
  const { data: predictions, error } = await supabaseAdmin
    .from("predictions")
    .select("id, user_id, predicted_value, kp_wager")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }

  for (const prediction of predictions ?? []) {
    const isCorrect = prediction.predicted_value === correctOptionValue;
    const kpEarned = isCorrect ? Math.round(prediction.kp_wager * payoutMultiplier) : 0;

    const { error: updateError } = await supabaseAdmin
      .from("predictions")
      .update({
        is_resolved: true,
        is_correct: isCorrect,
        kp_earned: kpEarned,
      })
      .eq("id", prediction.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (isCorrect && kpEarned > 0) {
      const { error: kpError } = await supabaseAdmin.rpc("increment_kp", {
        user_id: prediction.user_id,
        amount: kpEarned,
      });
      if (kpError) {
        throw new Error(kpError.message);
      }
    }

    await createNotification({
      user_id: prediction.user_id,
      channel: "push",
      title: isCorrect ? "Prediction won" : "Prediction missed",
      body: isCorrect
        ? `Nice! You earned ${kpEarned.toLocaleString()} KP from a prediction.`
        : "Your prediction did not hit this time.",
      kp_delta: isCorrect ? kpEarned : 0,
      metadata: { event_id: eventId }
    });
  }
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { data, error } = await supabaseAdmin
    .from("prediction_events")
    .select(
      [
        "id",
        "season_id",
        "week_number",
        "anime_id",
        "title",
        "description",
        "prediction_type",
        "options",
        "deadline",
        "is_active",
        "is_resolved",
        "correct_option_value",
        "created_at",
        "updated_at",
        "anime:anime_cache(title_romaji, title_english, cover_image)",
      ].join(","),
    )
    .order("deadline", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    predictionEvents: ((data ?? []) as unknown as PredictionEventRow[]).map(mapPredictionEventRow),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const payload = await request.json().catch(() => ({}));
  const parsed = parsePayload(payload as Record<string, unknown>);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid prediction event payload" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("prediction_events")
    .insert({
      season_id: parsed.seasonId,
      week_number: parsed.weekNumber,
      anime_id: parsed.animeId,
      title: parsed.title,
      description: parsed.description,
      prediction_type: parsed.predictionType,
      options: parsed.options,
      deadline: parsed.deadline,
      is_active: parsed.isActive,
      is_resolved: parsed.isResolved,
      correct_option_value: parsed.correctOptionValue,
    })
    .select(
      [
        "id",
        "season_id",
        "week_number",
        "anime_id",
        "title",
        "description",
        "prediction_type",
        "options",
        "deadline",
        "is_active",
        "is_resolved",
        "correct_option_value",
        "created_at",
        "updated_at",
        "anime:anime_cache(title_romaji, title_english, cover_image)",
      ].join(","),
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create prediction event" }, { status: 500 });
  }

  const createdEvent = data as unknown as PredictionEventRow;

  if (parsed.isResolved) {
    await syncPredictionResolution(createdEvent.id, parsed.options, parsed.correctOptionValue, parsed.isResolved);
  }

  await logAdminAction({
    actionType: "prediction_event_create",
    description: `Prediction event "${parsed.title}" created by ${admin.user.email}`,
    createdBy: admin.user.id,
    details: { predictionEventId: createdEvent.id, seasonId: parsed.seasonId, weekNumber: parsed.weekNumber },
  });

  return NextResponse.json({ predictionEvent: mapPredictionEventRow(createdEvent) });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const payload = await request.json().catch(() => ({}));
  const eventId = typeof payload.eventId === "string" ? payload.eventId : "";
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const parsed = parsePayload(payload as Record<string, unknown>);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid prediction event payload" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("prediction_events")
    .update({
      season_id: parsed.seasonId,
      week_number: parsed.weekNumber,
      anime_id: parsed.animeId,
      title: parsed.title,
      description: parsed.description,
      prediction_type: parsed.predictionType,
      options: parsed.options,
      deadline: parsed.deadline,
      is_active: parsed.isActive,
      is_resolved: parsed.isResolved,
      correct_option_value: parsed.correctOptionValue,
    })
    .eq("id", eventId)
    .select(
      [
        "id",
        "season_id",
        "week_number",
        "anime_id",
        "title",
        "description",
        "prediction_type",
        "options",
        "deadline",
        "is_active",
        "is_resolved",
        "correct_option_value",
        "created_at",
        "updated_at",
        "anime:anime_cache(title_romaji, title_english, cover_image)",
      ].join(","),
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to update prediction event" }, { status: 500 });
  }

  const updatedEvent = data as unknown as PredictionEventRow;

  await syncPredictionResolution(eventId, parsed.options, parsed.correctOptionValue, parsed.isResolved);

  await logAdminAction({
    actionType: "prediction_event_update",
    description: `Prediction event ${eventId} updated by ${admin.user.email}`,
    createdBy: admin.user.id,
    details: { predictionEventId: eventId, seasonId: parsed.seasonId, weekNumber: parsed.weekNumber },
  });

  return NextResponse.json({ predictionEvent: mapPredictionEventRow(updatedEvent) });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId") ?? "";
  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const { count, error: countError } = await supabaseAdmin
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "This prediction event already has wagers. Set it inactive instead of deleting it." },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin.from("prediction_events").delete().eq("id", eventId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actionType: "prediction_event_delete",
    description: `Prediction event ${eventId} deleted by ${admin.user.email}`,
    createdBy: admin.user.id,
    details: { predictionEventId: eventId },
  });

  return NextResponse.json({ ok: true });
}
