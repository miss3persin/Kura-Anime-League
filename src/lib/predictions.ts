import type { PredictionEvent, PredictionOption } from "@/lib/types/predictions";

type PredictionEventIdInput = {
  seasonId: string;
  weekNumber: number;
  predictionType: string;
  animeId: number | null;
};

export function buildPredictionEventId({
  seasonId,
  weekNumber,
  predictionType,
  animeId,
}: PredictionEventIdInput): string {
  return [
    "prediction",
    seasonId,
    String(weekNumber),
    predictionType,
    animeId ?? "none",
  ].join(":");
}

export function getPredictionOptions(
  predictionType: string,
  hypeScore?: number | null
): PredictionOption[] {
  if (predictionType === "HYPE_SCORE_TARGET" && typeof hypeScore === "number") {
    const targetHype = (hypeScore * 1.1).toFixed(1);
    return [
      { label: `Yes (>= ${targetHype})`, value: "true", odds: 2.2 },
      { label: `No (< ${targetHype})`, value: "false", odds: 1.7 },
    ];
  }

  return [
    { label: "Option 1", value: "option1", odds: 1.8 },
    { label: "Option 2", value: "option2", odds: 2.0 },
  ];
}

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
  is_resolved: boolean;
  is_active?: boolean | null;
  correct_option_value: string | null;
  created_at?: string;
  updated_at?: string;
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

const isPredictionOption = (value: unknown): value is PredictionOption => {
  if (!value || typeof value !== "object") return false;
  const option = value as Record<string, unknown>;
  return (
    typeof option.label === "string" &&
    typeof option.value === "string" &&
    typeof option.odds === "number"
  );
};

export function normalizePredictionOptions(
  value: unknown,
  predictionType: string,
  hypeScore?: number | null
): PredictionOption[] {
  if (Array.isArray(value)) {
    const normalized = value.filter(isPredictionOption).map((option) => ({
      label: option.label.trim(),
      value: option.value.trim(),
      odds: option.odds,
    }));
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return getPredictionOptions(predictionType, hypeScore);
}

export function mapPredictionEventRow(row: PredictionEventRow): PredictionEvent {
  const anime = Array.isArray(row.anime) ? row.anime[0] : row.anime;
  return {
    id: row.id,
    season_id: row.season_id,
    week_number: row.week_number,
    anime_id: row.anime_id,
    title: row.title,
    description: row.description ?? "",
    prediction_type: row.prediction_type,
    options: normalizePredictionOptions(row.options, row.prediction_type),
    deadline: row.deadline,
    is_resolved: row.is_resolved,
    correct_option_value: row.correct_option_value,
    anime_cover_image: anime?.cover_image ?? null,
    anime_title_english: anime?.title_english ?? anime?.title_romaji ?? null,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
