import { useEffect, useMemo, useState } from "react";

export interface SeasonInfoPayload {
  phase: "pre_draft" | "draft_open" | "season_live" | "transfer_review" | "off_season" | "ended";
  deadline: string | null;
  deadlineLabel: string | null;
  activeSeason: Record<string, any> | null;
  upcomingSeason: Record<string, any> | null;
  currentWeek: number;
  totalWeeks: number;
}

export interface SeasonTimeline {
  loading: boolean;
  seasonInfo: SeasonInfoPayload | null;
  timelineEntries: { label: string; value: string | null; field: string }[];
}

export function useSeasonTimeline(): SeasonTimeline {
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const fetchSeason = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/seasons/current");
        if (!active) return;
        const data = await res.json();
        setSeasonInfo({
          phase: data.phase,
          deadline: data.deadline,
          deadlineLabel: data.deadlineLabel,
          activeSeason: data.activeSeason ?? null,
          upcomingSeason: data.upcomingSeason ?? null,
          currentWeek: data.currentWeek ?? 1,
          totalWeeks: data.totalWeeks ?? 12
        });
      } catch (error) {
        console.error("Failed to load season info", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSeason();
    return () => {
      active = false;
    };
  }, []);

  const getFieldValue = (field: string) => {
    return (
      seasonInfo?.activeSeason?.[field] ??
      seasonInfo?.upcomingSeason?.[field] ??
      null
    );
  };

  const timelineEntries = useMemo(
    () => [
      { label: "Draft Opens", field: "draft_opens_at", value: getFieldValue("draft_opens_at") },
      { label: "Draft Closes", field: "draft_closes_at", value: getFieldValue("draft_closes_at") },
      { label: "Season Ends", field: "end_date", value: getFieldValue("end_date") },
      { label: "Transfer Review Ends", field: "transfer_review_ends_at", value: getFieldValue("transfer_review_ends_at") }
    ],
    [seasonInfo]
  );

  return {
    loading,
    seasonInfo,
    timelineEntries
  };
}
