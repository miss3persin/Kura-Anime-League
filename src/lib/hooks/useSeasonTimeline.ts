import { useMemo, useCallback } from "react";
import { useSeasonContext, type SeasonInfoPayload } from "@/components/season-provider";

export interface SeasonTimeline {
  loading: boolean;
  seasonInfo: SeasonInfoPayload | null;
  timelineEntries: { label: string; value: string | null; field: string }[];
  refresh: () => Promise<void>;
}

export function useSeasonTimeline(): SeasonTimeline {
  const { loading, seasonInfo, refresh } = useSeasonContext();

  const getFieldValue = useCallback((field: string) => {
    const activeVal = seasonInfo?.activeSeason?.[field];
    const upcomingVal = seasonInfo?.upcomingSeason?.[field];
    const val = activeVal ?? upcomingVal;
    return typeof val === 'string' ? val : null;
  }, [seasonInfo]);

  const timelineEntries = useMemo(
    () => [
      { label: "Draft Opens", field: "draft_opens_at", value: getFieldValue("draft_opens_at") },
      { label: "Draft Closes", field: "draft_closes_at", value: getFieldValue("draft_closes_at") },
      { label: "Season Ends", field: "end_date", value: getFieldValue("end_date") },
      { label: "Transfer Review Ends", field: "transfer_review_ends_at", value: getFieldValue("transfer_review_ends_at") }
    ],
    [getFieldValue]
  );

  return {
    loading,
    seasonInfo,
    timelineEntries,
    refresh
  };
}
