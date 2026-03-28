"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface SeasonInfoPayload {
  phase: "pre_draft" | "draft_open" | "season_live" | "transfer_review" | "off_season" | "ended";
  deadline: string | null;
  deadlineLabel: string | null;
  activeSeason: { id?: string | number | null; name?: string | null; [key: string]: unknown } | null;
  upcomingSeason: { id?: string | number | null; name?: string | null; [key: string]: unknown } | null;
  draftSeason: { id?: string | number | null; name?: string | null; [key: string]: unknown } | null;
  currentWeek: number;
  totalWeeks: number;
}

type SeasonContextValue = {
  loading: boolean;
  seasonInfo: SeasonInfoPayload | null;
  refresh: () => Promise<void>;
};

const SeasonContext = createContext<SeasonContextValue | null>(null);

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfoPayload | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seasons/current", { cache: "no-store" });
      const data = await res.json();
      setSeasonInfo({
        phase: data.phase,
        deadline: data.deadline,
        deadlineLabel: data.deadlineLabel,
        activeSeason: data.activeSeason ?? null,
        upcomingSeason: data.upcomingSeason ?? null,
        draftSeason: data.draftSeason ?? null,
        currentWeek: data.currentWeek ?? 0,
        totalWeeks: data.totalWeeks ?? 12,
      });
    } catch (error) {
      console.error("Failed to load season context", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", onFocus);
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(intervalId);
    };
  }, []);

  const value = useMemo(
    () => ({
      loading,
      seasonInfo,
      refresh,
    }),
    [loading, seasonInfo]
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeasonContext() {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error("useSeasonContext must be used within SeasonProvider");
  }
  return context;
}
