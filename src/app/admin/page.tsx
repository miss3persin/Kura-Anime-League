"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { NeonButton } from "@/components/ui/neon-button";
import { supabase } from "@/lib/supabase/client";
import { Loader2, CalendarDays, Zap, Clock4, ShieldCheck, Vote, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AdminPoll, AnnouncementContent, DisplayConfig, HeroContent } from "@/types/content";

const SPRING_2026_WEEKS = [
  { label: "Week 1", range: "Apr 1-7", start: "2026-04-01", end: "2026-04-07", phase: "pre_draft" },
  { label: "Week 2", range: "Apr 8-14", start: "2026-04-08", end: "2026-04-14", phase: "draft_open" },
  { label: "Week 3", range: "Apr 15-21", start: "2026-04-15", end: "2026-04-21", phase: "season_live" },
  { label: "Week 4", range: "Apr 22-30", start: "2026-04-22", end: "2026-04-30", phase: "season_live" }
];

type SpringWeek = (typeof SPRING_2026_WEEKS)[number] & {
  startDate: Date;
  endDate: Date;
  status: "active" | "upcoming" | "past";
};

const TIMELINE_CHIP_CLASSES: Record<SpringWeek["status"], string> = {
  active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  upcoming: "bg-sky-500/10 border-sky-500/40 text-sky-400",
  past: "bg-white/5 border-white/10 text-white/70"
};

const SPRING_2026_START_DATE = new Date("2026-04-01T00:00:00Z");
const TODAY_FORMATTER = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

const formatPhaseLabel = (phase: string) =>
  phase
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const DAY_CALLOUT_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const formatDayCallout = (value?: string | null) => {
  if (!value) return "TBD";
  return DAY_CALLOUT_FORMATTER.format(new Date(value));
};

function WeekChip({ week, highlight }: { week: SpringWeek; highlight?: boolean }) {
  const phaseLabel = formatPhaseLabel(week.phase);
  const statusLabel = week.status.toUpperCase();
  return (
    <div
      className={`relative group rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all ${
        TIMELINE_CHIP_CLASSES[week.status]
      } ${highlight ? "scale-105 shadow-2xl border-white/40" : ""}`}
    >
      <p>{week.label}</p>
      <p className="text-[8px] text-[var(--muted)]">{phaseLabel}</p>
      <div className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 transform rounded-2xl border border-white/20 bg-black/80 px-3 py-2 text-[9px] text-white/80 shadow-xl group-hover:block">
        {week.range} · {statusLabel}
      </div>
    </div>
  );
}

function RefreshIcon({ loading, label = "Refresh" }: { loading?: boolean; label?: string }) {
  return (
    <span className="flex items-center justify-center">
      {loading ? (
        <Loader2 size={16} className="animate-spin text-[var(--muted)]" />
      ) : (
        <RefreshCw size={16} className="text-[var(--muted)]" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

type SeasonEntry = {
  id: number;
  name: string;
  status: string;
  draft_opens_at?: string | null;
  draft_closes_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  transfer_review_ends_at?: string | null;
  week_number?: number | null;
  total_weeks?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EditableFields = {
  draft_opens_at: string;
  draft_closes_at: string;
  start_date: string;
  end_date: string;
  transfer_review_ends_at: string;
};

const emptyEditableFields = (): EditableFields => ({
  draft_opens_at: "",
  draft_closes_at: "",
  start_date: "",
  end_date: "",
  transfer_review_ends_at: ""
});

const toLocalInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const buildEditableFields = (season: SeasonEntry | null): EditableFields => {
  if (!season) return emptyEditableFields();
  return {
    draft_opens_at: toLocalInputValue(season.draft_opens_at),
    draft_closes_at: toLocalInputValue(season.draft_closes_at),
    start_date: toLocalInputValue(season.start_date),
    end_date: toLocalInputValue(season.end_date),
    transfer_review_ends_at: toLocalInputValue(season.transfer_review_ends_at)
  };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
};

const getStatusStyles = (status: string) => {
  switch (status) {
    case "active":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
    case "upcoming":
      return "border-sky-500/40 bg-sky-500/10 text-sky-400";
    default:
      return "border-orange-500/40 bg-orange-500/10 text-orange-400";
  }
};

type AdminUser = {
  id: string;
  email?: string | null;
  role: string;
  isSuspended: boolean;
  createdAt?: string | null;
};

type AdminLog = {
  id: number;
  action_type: string;
  description: string;
  created_by: string | null;
  created_at: string;
  details?: Record<string, unknown>;
};

type PollFormState = {
  question: string;
  optionA: string;
  optionB: string;
  isActive: boolean;
};

const EMPTY_POLL_FORM: PollFormState = {
  question: "",
  optionA: "",
  optionB: "",
  isActive: true
};

const defaultHeroContent: HeroContent = {
  visible: true,
  headline: "KAL Spring 2026",
  subtitle: "Cour kicks off April 1, 2026 — ready for drafts",
  cta: "Get hyped",
  ctaLink: "/draft"
};

const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  showTrendingHighlights: true,
  showMarketPulse: true,
  showPlaybook: true,
  showLeaderboardPreview: true,
  showSeasonTimeline: true,
  disableWelcomeModal: false
};

const DEFAULT_ANNOUNCEMENT: AnnouncementContent = {
  visible: false,
  message: "",
  ctaLabel: "",
  ctaLink: "",
  tone: "default"
};

const CONFIG_TOGGLES: Array<{ label: string; key: keyof DisplayConfig }> = [
  { label: "Trending highlights", key: "showTrendingHighlights" },
  { label: "Market pulse card", key: "showMarketPulse" },
  { label: "Playbook card", key: "showPlaybook" },
  { label: "Leaderboard preview", key: "showLeaderboardPreview" },
  { label: "Season timeline entries", key: "showSeasonTimeline" },
  { label: "Hide welcome modal for guests", key: "disableWelcomeModal" }
];

export default function AdminPage() {
  const router = useRouter();
  const selectedSeasonIdRef = useRef<number | null>(null);
  const [seasons, setSeasons] = useState<SeasonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<SeasonEntry | null>(null);
  const [editingDates, setEditingDates] = useState<EditableFields>(emptyEditableFields());
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [savingSeason, setSavingSeason] = useState(false);
  const [nextSeasonName, setNextSeasonName] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [heroContent, setHeroContent] = useState<HeroContent>(defaultHeroContent);
  const [heroDraft, setHeroDraft] = useState<HeroContent>(defaultHeroContent);
  const [contentSaving, setContentSaving] = useState(false);
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
  const [configDraft, setConfigDraft] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
  const [announcement, setAnnouncement] = useState<AnnouncementContent>(DEFAULT_ANNOUNCEMENT);
  const [announcementDraft, setAnnouncementDraft] = useState<AnnouncementContent>(DEFAULT_ANNOUNCEMENT);
  const [configSaving, setConfigSaving] = useState(false);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [polls, setPolls] = useState<AdminPoll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [pollForm, setPollForm] = useState<PollFormState>({ ...EMPTY_POLL_FORM });
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [pollActionId, setPollActionId] = useState<number | null>(null);

  const updateSelection = useCallback((season: SeasonEntry | null) => {
    if (season) {
      selectedSeasonIdRef.current = season.id;
      setEditingDates(buildEditableFields(season));
    } else {
      selectedSeasonIdRef.current = null;
      setEditingDates(emptyEditableFields());
    }
    setSelectedSeason(season);
  }, []);

  const getAuthToken = useCallback(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.push("/login");
      throw new Error("Session required");
    }
    return session.access_token;
  }, [router]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setForbidden(false);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", message: data?.error ?? "Unable to load users" });
        return;
      }
      setUsers(
        (data?.users ?? []).map((user: AdminUser) => ({
          id: user.id,
          email: user.email,
          role: user.role ?? "player",
          isSuspended: Boolean(user.isSuspended),
          createdAt: user.createdAt
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load users";
      setFeedback({ type: "error", message });
    } finally {
      setUsersLoading(false);
    }
  }, [getAuthToken, router]);

  const loadContent = useCallback(async () => {
    setContentSaving(false);
    setConfigSaving(false);
    setForbidden(false);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/content", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const nextHero = { ...defaultHeroContent, ...(data?.hero ?? {}) };
      setHeroContent(nextHero);
      setHeroDraft(nextHero);
      const nextConfig = { ...DEFAULT_DISPLAY_CONFIG, ...(data?.config ?? {}) };
      setDisplayConfig(nextConfig);
      setConfigDraft(nextConfig);
      const nextAnnouncement = { ...DEFAULT_ANNOUNCEMENT, ...(data?.announcement ?? {}) };
      setAnnouncement(nextAnnouncement);
      setAnnouncementDraft(nextAnnouncement);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load content";
      setFeedback({ type: "error", message });
    }
  }, [getAuthToken, router]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setForbidden(false);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/logs", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setLogs(data?.logs ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load logs";
      setFeedback({ type: "error", message });
    } finally {
      setLogsLoading(false);
    }
  }, [getAuthToken, router]);

  const loadPolls = useCallback(async () => {
    setPollsLoading(true);
    setForbidden(false);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/polls", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", message: data?.error ?? "Unable to load polls" });
        return;
      }
      setPolls(data?.polls ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load polls";
      setFeedback({ type: "error", message });
    } finally {
      setPollsLoading(false);
    }
  }, [getAuthToken, router]);

  const refreshAdminWidgets = useCallback(() => {
    void loadUsers();
    void loadContent();
    void loadLogs();
    void loadPolls();
  }, [loadUsers, loadContent, loadLogs, loadPolls]);

  const loadSeasons = useCallback(async () => {
    setForbidden(false);
    setLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/seasons", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        router.push("/login");
        return null;
      }
      if (res.status === 403) {
        setForbidden(true);
        return null;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", message: data?.error ?? "Unable to load seasons" });
        return null;
      }
      return data?.seasons ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      setFeedback({ type: "error", message });
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, router]);

  const syncSeasons = useCallback(
    (items: SeasonEntry[]) => {
      setSeasons(items);
      if (!selectedSeasonIdRef.current) return;
      const pick = items.find((season) => season.id === selectedSeasonIdRef.current) ?? null;
      updateSelection(pick);
    },
    [updateSelection]
  );

  const refreshSeasons = useCallback(async () => {
    const refreshed = await loadSeasons();
    if (refreshed) {
      syncSeasons(refreshed);
    }
  }, [loadSeasons, syncSeasons]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const result = await loadSeasons();
      if (canceled || !result) return;
      syncSeasons(result);
    })();
    return () => {
      canceled = true;
    };
  }, [loadSeasons, syncSeasons]);

  useEffect(() => {
    refreshAdminWidgets();
  }, [refreshAdminWidgets]);

  const automationSegments = useMemo(() => {
    return seasons.slice(0, 3).map((season) => {
      const progress =
        season.week_number && season.total_weeks
          ? Math.min(100, (Number(season.week_number) / Number(season.total_weeks)) * 100)
          : 0;
      return {
        id: season.id,
        label: season.name,
        progress,
        status: season.status ?? "unknown",
        weekLabel: `Week ${season.week_number ?? 0}/${season.total_weeks ?? "?"}`
      };
    });
  }, [seasons]);

  const now = new Date();
  const springTimeline = useMemo(() => {
    return SPRING_2026_WEEKS.map((week) => {
      const startDate = new Date(week.start);
      const endDate = new Date(week.end);
      let status: SpringWeek["status"] = "past";
      if (now >= startDate && now <= endDate) {
        status = "active";
      } else if (now < startDate) {
        status = "upcoming";
      }
      return { ...week, startDate, endDate, status } as SpringWeek;
    });
  }, [now]);

  const currentSpringWeek = springTimeline.find((week) => week.status === "active");

  const handleAutomation = useCallback(async () => {
    setRunningAutomation(true);
    const payload: Record<string, unknown> = { action: "manage" };
    if (nextSeasonName.trim()) {
      payload.nextSeasonName = nextSeasonName.trim();
    }
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", message: data?.error ?? "Season automation failed" });
        return;
      }
      const summary =
        Array.isArray(data?.result?.actions) && data.result.actions.length
          ? data.result.actions.join(" • ")
          : "Season automation executed";
      setFeedback({ type: "success", message: summary });
      setNextSeasonName("");
      await refreshSeasons();
      refreshAdminWidgets();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Season automation failed";
      setFeedback({ type: "error", message });
    } finally {
      setRunningAutomation(false);
    }
  }, [nextSeasonName, getAuthToken, refreshSeasons, refreshAdminWidgets]);

  const handleSaveSeason = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedSeason) return;
      const updates: Record<string, string> = {};
      for (const key of Object.keys(editingDates) as Array<keyof EditableFields>) {
        const value = editingDates[key];
        if (!value) continue;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) continue;
        updates[key] = parsed.toISOString();
      }
      if (!Object.keys(updates).length) {
        setFeedback({ type: "error", message: "Provide at least one valid date" });
        return;
      }
      setSavingSeason(true);
      try {
        const token = await getAuthToken();
        const res = await fetch("/api/admin/seasons", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            action: "update",
            seasonId: selectedSeason.id,
            fields: updates
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFeedback({ type: "error", message: data?.error ?? "Season save failed" });
          return;
        }
        setFeedback({ type: "success", message: "Season fields synchronized" });
        await refreshSeasons();
        refreshAdminWidgets();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Season save failed";
        setFeedback({ type: "error", message });
      } finally {
        setSavingSeason(false);
      }
    },
    [editingDates, selectedSeason, getAuthToken, refreshSeasons, refreshAdminWidgets]
  );

  const handleUserUpdate = useCallback(
    async (userId: string) => {
      const user = users.find((item) => item.id === userId);
      if (!user) return;
      setSavingUserId(userId);
      try {
        const token = await getAuthToken();
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            userId,
            role: user.role,
            isSuspended: user.isSuspended
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFeedback({ type: "error", message: data?.error ?? "Unable to update user" });
          return;
        }
        setFeedback({ type: "success", message: "User preferences synchronized" });
        refreshAdminWidgets();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update user";
        setFeedback({ type: "error", message });
      } finally {
        setSavingUserId(null);
      }
    },
    [users, getAuthToken, refreshAdminWidgets]
  );

  const handleHeroSave = useCallback(
    async (payload?: HeroContent) => {
      setContentSaving(true);
      try {
        const token = await getAuthToken();
        const nextDraft = payload ?? heroDraft;
        const res = await fetch("/api/admin/content", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ hero: nextDraft })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFeedback({ type: "error", message: data?.error ?? "Unable to update hero content" });
          return;
        }
        setHeroContent(data?.hero ?? nextDraft);
        setHeroDraft(data?.hero ?? nextDraft);
        setFeedback({ type: "success", message: "Hero content saved" });
        refreshAdminWidgets();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update content";
        setFeedback({ type: "error", message });
      } finally {
        setContentSaving(false);
      }
    },
    [getAuthToken, heroDraft, refreshAdminWidgets]
  );

  const handleHeroToggle = useCallback(() => {
    const updated = { ...heroDraft, visible: !heroDraft.visible };
    setHeroDraft(updated);
    void handleHeroSave(updated);
  }, [heroDraft, handleHeroSave]);

  const handleHeroFieldChange = (field: keyof HeroContent, value: string) => {
    setHeroDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleConfigSave = useCallback(async () => {
    setConfigSaving(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          config: configDraft,
          announcement: announcementDraft
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "error", message: data?.error ?? "Unable to update display settings" });
        return;
      }
      const nextConfig = { ...DEFAULT_DISPLAY_CONFIG, ...(data?.config ?? configDraft) };
      setDisplayConfig(nextConfig);
      setConfigDraft(nextConfig);
      const nextAnnouncement = { ...DEFAULT_ANNOUNCEMENT, ...(data?.announcement ?? announcementDraft) };
      setAnnouncement(nextAnnouncement);
      setAnnouncementDraft(nextAnnouncement);
      setFeedback({ type: "success", message: "Display settings saved" });
      void loadLogs();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update display settings";
      setFeedback({ type: "error", message });
    } finally {
      setConfigSaving(false);
    }
  }, [announcementDraft, configDraft, getAuthToken, loadLogs]);

  const handleCreatePoll = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!pollForm.question.trim() || !pollForm.optionA.trim() || !pollForm.optionB.trim()) {
        setFeedback({ type: "error", message: "Question and both options are required" });
        return;
      }
      setCreatingPoll(true);
      try {
        const token = await getAuthToken();
        const res = await fetch("/api/admin/polls", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            question: pollForm.question.trim(),
            optionA: pollForm.optionA.trim(),
            optionB: pollForm.optionB.trim(),
            isActive: pollForm.isActive
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFeedback({ type: "error", message: data?.error ?? "Unable to create poll" });
          return;
        }
        setFeedback({ type: "success", message: "Poll created" });
        setPollForm({ ...EMPTY_POLL_FORM });
        await loadPolls();
        void loadLogs();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create poll";
        setFeedback({ type: "error", message });
      } finally {
        setCreatingPoll(false);
      }
    },
    [getAuthToken, loadLogs, loadPolls, pollForm]
  );

  const handlePollToggle = useCallback(
    async (poll: AdminPoll) => {
      setPollActionId(poll.id);
      try {
        const token = await getAuthToken();
        const res = await fetch("/api/admin/polls", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            pollId: poll.id,
            isActive: !poll.is_active
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFeedback({ type: "error", message: data?.error ?? "Unable to update poll" });
          return;
        }
        setFeedback({
          type: "success",
          message: `Poll ${poll.id} ${poll.is_active ? "paused" : "activated"}`
        });
        await loadPolls();
        void loadLogs();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update poll";
        setFeedback({ type: "error", message });
      } finally {
        setPollActionId(null);
      }
    },
    [getAuthToken, loadLogs, loadPolls]
  );

  const handlePollReset = useCallback(
    async (poll: AdminPoll) => {
      setPollActionId(poll.id);
      try {
        const token = await getAuthToken();
        const res = await fetch("/api/admin/polls", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            pollId: poll.id,
            resetVotes: true
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFeedback({ type: "error", message: data?.error ?? "Unable to reset votes" });
          return;
        }
        setFeedback({ type: "success", message: "Poll votes reset" });
        await loadPolls();
        void loadLogs();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to reset votes";
        setFeedback({ type: "error", message });
      } finally {
        setPollActionId(null);
      }
    },
    [getAuthToken, loadLogs, loadPolls]
  );

  const isPreSeason = now < SPRING_2026_START_DATE;
  const finalWeek = SPRING_2026_WEEKS[SPRING_2026_WEEKS.length - 1];
  const timelineMessage = isPreSeason
    ? `As of ${TODAY_FORMATTER.format(now)} Spring 2026 is still in the pre-season planning window; Week 1 launches April 1-7, 2026.`
    : currentSpringWeek
    ? `${currentSpringWeek.label} is live (${currentSpringWeek.range}) and primes the week-by-week premieres before they finish around ${finalWeek.range}.`
    : `Spring 2026 completes its final scheduled premieres in ${finalWeek.range}.`;

  if (forbidden) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-40 space-y-4 text-center">
          <ShieldCheck size={56} className="text-orange-400" />
          <h1 className="text-3xl font-black uppercase">Admin Access Only</h1>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">You do not have permission to see this area.</p>
        </div>
      </AppShell>
    );
  }

  const assignmentStats = {
    active: seasons.filter((season) => season.status === "active").length,
    upcoming: seasons.filter((season) => season.status === "upcoming").length,
    past: seasons.filter((season) => season.status !== "active" && season.status !== "upcoming").length
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 py-6">
        <header className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-[var(--muted)]">Admin Control</p>
              <h1 className="text-4xl font-black uppercase tracking-tight">Season Operations</h1>
            </div>
          <div className="flex items-center gap-3">
            <Zap className="text-accent" size={20} />
            <p className="text-[var(--muted)] uppercase text-[10px] tracking-[0.3em]">Secure · Server verified · Iterative</p>
          </div>
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Manage seasons safely from a single server-only API. Every change is validated by the admin guard and flows through the same automation that runs on the backend.
          </p>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {springTimeline.map((week) => (
                <WeekChip key={week.label} week={week} highlight={currentSpringWeek?.label === week.label} />
              ))}
            </div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">{timelineMessage}</p>
            <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
              <span>Active: {assignmentStats.active}</span>
              <span>Upcoming: {assignmentStats.upcoming}</span>
              <span>Past: {assignmentStats.past}</span>
            </div>
          </div>
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.2em] ${
                feedback.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              {feedback.type === "success" ? "Success" : "Error"}: {feedback.message}
            </div>
          )}
        </header>

        <section className="grid gap-8 xl:grid-cols-[1.5fr,1fr]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
                <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Active</p>
                <p className="mt-3 text-3xl font-black">{assignmentStats.active}</p>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
                <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Upcoming</p>
                <p className="mt-3 text-3xl font-black">{assignmentStats.upcoming}</p>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
                <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Past</p>
                <p className="mt-3 text-3xl font-black">{assignmentStats.past}</p>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-[0.4em] text-[var(--muted)]">Seasons & Timeline</h2>
              <button
                onClick={refreshSeasons}
                className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)] hover:text-white transition-colors disabled:cursor-not-allowed"
                disabled={loading}
                type="button"
                aria-label="Refresh seasons"
              >
                <RefreshIcon loading={loading} label="Refresh seasons" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {springTimeline.map((week) => (
                <WeekChip key={`season-${week.label}`} week={week} highlight={currentSpringWeek?.label === week.label} />
              ))}
            </div>
            <p className="mt-2 text-[9px] uppercase tracking-[0.3em] text-[var(--muted)]">
              Hover a chip to see the day/date callout and know which phase is approaching.
            </p>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-accent" />
                </div>
              ) : (
                <div className="space-y-4">
                  {seasons.length ? (
                    seasons.map((season) => (
                      <div
                        key={season.id}
                        className="group relative rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 transition-all hover:border-accent/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm uppercase tracking-[0.4em] text-[var(--muted)]">{season.name}</p>
                            <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-[0.4em]">
                              <span className={`rounded-full border px-3 py-1 text-xs ${getStatusStyles(season.status)}`}>
                                {formatPhaseLabel(season.status)}
                              </span>
                              <span className="rounded-full border border-white/20 px-3 py-1 text-[9px] uppercase tracking-[0.3em] text-white/70">
                                Week {season.week_number ?? 0} / {season.total_weeks ?? "?"}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => updateSelection(season)}
                            className="text-[10px] font-black uppercase tracking-[0.3em] text-accent hover:text-white"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
                          {[
                            ["Draft opens", season.draft_opens_at],
                            ["Draft closes", season.draft_closes_at],
                            ["Season start", season.start_date],
                            ["Season end", season.end_date]
                          ].map(([label, value]) => (
                            <div key={`${season.id}-${label}`}>
                              <p className="text-[var(--muted)]">{label}</p>
                              <p className="text-white" title={value ? new Date(value).toLocaleString() : ""}>
                                {formatDateTime(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.3em] text-[var(--muted)]">
                          <span className="group relative inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                            Day callouts
                            <span className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-2xl border border-white/20 bg-black/90 px-3 py-2 text-[8px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                              {formatDayCallout(season.draft_opens_at)} – {formatDayCallout(season.end_date)}
                            </span>
                          </span>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.3em] text-white/70">
                            Draft window {formatDayCallout(season.draft_opens_at)} / {formatDayCallout(season.draft_closes_at)}
                          </span>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <span className="text-[9px] uppercase tracking-[0.5em] text-[var(--muted)]">
                            Updated {season.updated_at ? new Date(season.updated_at).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm uppercase tracking-[0.4em] text-[var(--muted)]">No seasons found yet.</p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-accent" size={20} />
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Real-Time Spring Summary</h2>
            </div>
            <p className="text-[var(--muted)] text-[10px] font-black uppercase tracking-[0.3em]">
                Week-by-week schedule shows when the cour transitions between pre-draft, draft, and live phases. Week 1 begins April 1 and Week 4 wraps on April 30, 2026.
            </p>
            <div className="mt-4 space-y-3 text-[11px]">
              <div className="flex items-center justify-between">
                <p>Current focus</p>
                <span className="text-white font-black uppercase tracking-[0.3em]">
                  {currentSpringWeek?.phase?.replace(/_/g, " ") ?? "Pre-season focus"}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {springTimeline.map((week) => (
                  <WeekChip key={`summary-${week.label}`} week={week} highlight={currentSpringWeek?.label === week.label} />
                ))}
              </div>
            </div>
          </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Automation Chart</h2>
                <p className="text-[9px] uppercase tracking-[0.3em] text-[var(--muted)]">Week progress</p>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {automationSegments.length ? (
                  automationSegments.map((segment) => (
                    <div key={segment.id} className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                        <span>{segment.label}</span>
                        <span>{segment.weekLabel}</span>
                      </div>
                      <div className="relative h-4 overflow-hidden rounded-full border border-[var(--border)] bg-white/5">
                        <div
                          className={`h-full rounded-full ${
                            segment.status === "active"
                              ? "bg-emerald-400"
                              : segment.status === "upcoming"
                              ? "bg-sky-400"
                              : "bg-white/40"
                          }`}
                          style={{ width: `${segment.progress}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted)]">Awaiting season data for chart.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-accent" size={20} />
                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Manual Automation</h2>
              </div>
              <p className="text-[var(--muted)] text-[10px] font-black uppercase tracking-[0.4em]">
                Trigger the backend season automation manually.
              </p>
              <label className="text-[var(--muted)] text-[10px] font-black uppercase tracking-[0.3em]">Next season name</label>
              <input
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-white focus:border-accent focus:outline-none"
                placeholder="Season 2026"
                value={nextSeasonName}
                onChange={(event) => setNextSeasonName(event.target.value)}
              />
              <div className="flex flex-wrap gap-3">
                <NeonButton onClick={handleAutomation} disabled={runningAutomation}>
                  {runningAutomation ? <Loader2 size={16} className="animate-spin" /> : "Run Season Automation"}
                </NeonButton>
                <NeonButton
                  variant="outline"
                  onClick={refreshSeasons}
                  disabled={loading}
                  aria-label="Refresh timeline"
                >
                  <RefreshIcon loading={loading} label="Refresh timeline" />
                </NeonButton>
                <NeonButton variant="outline" onClick={() => { setNextSeasonName("Spring 2026 Auto"); void handleAutomation(); }}>
                  Generate Next Season with Defaults
                </NeonButton>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
              <div className="flex items-center gap-2">
                <Clock4 className="text-accent" size={20} />
                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Season Editor</h2>
              </div>
              <p className="text-[var(--muted)] text-[10px] font-black uppercase tracking-[0.3em]">
                Adjust draft windows, start/end dates, or transfer review windows on the selected season.
              </p>

              {selectedSeason ? (
                <form onSubmit={handleSaveSeason} className="space-y-4 pt-4">
                  {(Object.keys(editingDates) as Array<keyof EditableFields>).map((field) => (
                    <div key={field} className="space-y-2">
                      <label className="text-[var(--muted)] text-[10px] font-black uppercase tracking-[0.3em]">
                        {field.replace(/_/g, " ")}
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-sm text-white focus:border-accent focus:outline-none"
                        value={editingDates[field]}
                        onChange={(event) => setEditingDates((prev) => ({ ...prev, [field]: event.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <NeonButton type="submit" disabled={savingSeason}>
                      {savingSeason ? <Loader2 className="animate-spin" size={16} /> : "Sync Dates"}
                    </NeonButton>
                    <NeonButton type="button" variant="outline" onClick={() => updateSelection(null)} className="text-[var(--muted)]">
                      Clear Selection
                    </NeonButton>
                  </div>
                </form>
              ) : (
                <p className="pt-4 text-xs uppercase tracking-[0.4em] text-[var(--muted)]">
                  Pick a season to configure its timeline.
                </p>
              )}
            </div>
          </div>
        </section>
        <section className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <div className="flex items-center gap-2">
              <Vote className="text-accent" size={20} />
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Polls & Voting</h2>
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
              Manage community polls, activate the right questions, and keep the hype fresh.
            </p>
            <form onSubmit={handleCreatePoll} className="space-y-3 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">Poll question</label>
                <input
                  value={pollForm.question}
                  onChange={(event) => setPollForm((prev) => ({ ...prev, question: event.target.value }))}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  placeholder="Who will reign in Week 4?"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={pollForm.optionA}
                  onChange={(event) => setPollForm((prev) => ({ ...prev, optionA: event.target.value }))}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  placeholder="Option A"
                />
                <input
                  value={pollForm.optionB}
                  onChange={(event) => setPollForm((prev) => ({ ...prev, optionB: event.target.value }))}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  placeholder="Option B"
                />
              </div>
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={pollForm.isActive}
                  onChange={(event) => setPollForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border border-[var(--border)] bg-[var(--background)]"
                />
                Start poll as active
              </label>
              <div className="flex flex-wrap gap-3">
                <NeonButton type="submit" disabled={creatingPoll}>
                  {creatingPoll ? <Loader2 size={14} className="animate-spin" /> : "Create Poll"}
                </NeonButton>
                <NeonButton
                  type="button"
                  variant="outline"
                  onClick={() => setPollForm({ ...EMPTY_POLL_FORM })}
                >
                  Clear
                </NeonButton>
              </div>
            </form>
            <div className="pt-6 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
              <p>Recent polls</p>
                <button
                  onClick={loadPolls}
                  className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]"
                  type="button"
                  aria-label="Refresh polls"
                >
                  <RefreshIcon loading={pollsLoading} label="Refresh polls" />
                </button>
            </div>
            {pollsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-accent" size={20} />
              </div>
            ) : polls.length ? (
              <div className="space-y-3 pt-4">
                {polls.map((poll) => (
                  <div key={poll.id} className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em]">
                      <p className="font-black text-[var(--foreground)]">{poll.question}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-[9px] font-black ${
                          poll.is_active
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-white/20 bg-white/5 text-white/60"
                        }`}
                      >
                        {poll.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                      <span>
                        {poll.option_a}: {poll.votes_a} votes
                      </span>
                      <span>
                        {poll.option_b}: {poll.votes_b} votes
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <NeonButton
                        variant="outline"
                        onClick={() => handlePollToggle(poll)}
                        disabled={pollActionId === poll.id}
                        className="px-4 py-2 text-[10px]"
                      >
                        {pollActionId === poll.id
                          ? "Processing"
                          : poll.is_active
                          ? "Pause"
                          : "Activate"}
                      </NeonButton>
                      <NeonButton
                        variant="outline"
                        onClick={() => handlePollReset(poll)}
                        disabled={pollActionId === poll.id}
                        className="px-4 py-2 text-[10px]"
                      >
                        Reset Votes
                      </NeonButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">No polls yet.</p>
            )}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Users & Permissions</h2>
              <button
                onClick={loadUsers}
                className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]"
                type="button"
                aria-label="Refresh users"
              >
                <RefreshIcon loading={usersLoading} label="Refresh users" />
              </button>
            </div>
            <div className="grid gap-4">
              {users.length ? (
                users.map((user) => (
                  <div key={user.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                    <div className="flex items-center justify-between text-sm font-black uppercase tracking-[0.3em]">
                      <span>{user.email ?? user.id}</span>
                      <span className="text-[10px] text-[var(--muted)]">
                        Created {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.3em]">
                      <label className="flex items-center gap-2">
                        Role
                        <select
                          className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
                          value={user.role}
                          onChange={(event) =>
                            setUsers((prev) =>
                              prev.map((entry) => (entry.id === user.id ? { ...entry, role: event.target.value } : entry))
                            )
                          }
                        >
                          <option value="player">Player</option>
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2">
                        Suspend
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border border-[var(--border)] bg-[var(--background)]"
                          checked={user.isSuspended}
                          onChange={(event) =>
                            setUsers((prev) =>
                              prev.map((entry) => (entry.id === user.id ? { ...entry, isSuspended: event.target.checked } : entry))
                            )
                          }
                        />
                      </label>
                      <NeonButton
                        onClick={() => handleUserUpdate(user.id)}
                        disabled={savingUserId === user.id}
                        className="px-4 py-2 text-[10px]"
                      >
                        {savingUserId === user.id ? "Saving…" : "Save"}
                      </NeonButton>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">No users to show.</p>
              )}
            </div>
          </div>

            <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Content & Hero Banner</h2>
              <button
                onClick={loadContent}
                className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]"
                type="button"
                aria-label="Refresh content"
              >
                <RefreshIcon loading={contentSaving} label="Refresh content" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">Headline</label>
              <input
                value={heroDraft.headline ?? ""}
                onChange={(event) => handleHeroFieldChange("headline", event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
              <label className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">Subtitle</label>
              <input
                value={heroDraft.subtitle ?? ""}
                onChange={(event) => handleHeroFieldChange("subtitle", event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
              <label className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">CTA</label>
              <input
                value={heroDraft.cta ?? ""}
                onChange={(event) => handleHeroFieldChange("cta", event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
              <label className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">CTA Link</label>
              <input
                value={heroDraft.ctaLink ?? ""}
                onChange={(event) => handleHeroFieldChange("ctaLink", event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                placeholder="/draft"
              />
              <div className="flex flex-wrap gap-3">
                <NeonButton onClick={() => handleHeroSave()} disabled={contentSaving}>
                  {contentSaving ? <Loader2 size={14} className="animate-spin" /> : "Save Banner"}
                </NeonButton>
                <NeonButton variant="outline" onClick={handleHeroToggle} disabled={contentSaving}>
                  {heroDraft.visible ? "Hide Banner" : "Show Banner"}
                </NeonButton>
              </div>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-accent/20 to-black p-4 text-[11px] uppercase tracking-[0.3em] text-white shadow-xl">
              <p className="text-[13px] font-black">{heroDraft.headline || heroContent.headline}</p>
              <p className="text-[9px] text-white/80">{heroDraft.subtitle || heroContent.subtitle}</p>
              <p className="mt-2 text-[10px] text-white/70">{heroDraft.cta || heroContent.cta}</p>
              <p className="mt-2 text-[9px] text-white/60">
                Visibility: {heroDraft.visible ? "Online" : "Hidden"} · Live preview only
              </p>
            </div>
            <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="text-accent" size={20} />
                  <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Site Broadcast & Layout</h2>
                </div>
                <button
                  onClick={loadContent}
                  className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]"
                  type="button"
                  aria-label="Refresh site broadcast"
                >
                  <RefreshIcon loading={contentSaving} label="Refresh site broadcast" />
                </button>
              </div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                Toggle homepage modules and craft announcement copy for every launch.
              </p>
              <div className="grid gap-3 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                {CONFIG_TOGGLES.map((toggle) => {
                  const checked = Boolean(configDraft[toggle.key]);
                  return (
                    <label key={toggle.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setConfigDraft((prev) => ({ ...prev, [toggle.key]: !checked }))
                        }
                        className="h-4 w-4 rounded border border-[var(--border)] bg-[var(--background)]"
                      />
                      <span className="text-[11px]">{toggle.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="border-t border-[var(--border)] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">Announcement</p>
                  <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                    Visible
                    <input
                      type="checkbox"
                      checked={Boolean(announcementDraft.visible)}
                      onChange={(event) =>
                        setAnnouncementDraft((prev) => ({ ...prev, visible: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border border-[var(--border)] bg-[var(--background)]"
                    />
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={announcementDraft.message ?? ""}
                  onChange={(event) =>
                    setAnnouncementDraft((prev) => ({ ...prev, message: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                  placeholder="Share a quick broadcast or drop a hype note"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={announcementDraft.ctaLabel ?? ""}
                    onChange={(event) =>
                      setAnnouncementDraft((prev) => ({ ...prev, ctaLabel: event.target.value }))
                    }
                    className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                    placeholder="CTA label"
                  />
                  <input
                    value={announcementDraft.ctaLink ?? ""}
                    onChange={(event) =>
                      setAnnouncementDraft((prev) => ({ ...prev, ctaLink: event.target.value }))
                    }
                    className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                    placeholder="CTA link (e.g., /draft)"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">Tone</label>
                  <select
                    value={announcementDraft.tone ?? "default"}
                    onChange={(event) =>
                      setAnnouncementDraft((prev) => ({
                        ...prev,
                        tone: event.target.value as AnnouncementContent["tone"]
                      }))
                    }
                    className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    <option value="default">Neutral</option>
                    <option value="accent">Accent</option>
                    <option value="warning">Warning</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <NeonButton onClick={handleConfigSave} disabled={configSaving}>
                  {configSaving ? <Loader2 size={14} className="animate-spin" /> : "Save Display Settings"}
                </NeonButton>
                <NeonButton
                  variant="outline"
                  onClick={() => {
                    setConfigDraft(displayConfig);
                    setAnnouncementDraft(announcement);
                  }}
                >
                  Revert
                </NeonButton>
              </div>
              <div
                className={`rounded-2xl border p-4 text-[11px] uppercase tracking-[0.3em] ${
                  announcementDraft.tone === "warning"
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : announcementDraft.tone === "accent"
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
                    : "border-white/10 bg-white/5 text-white/80"
                }`}
              >
                <p className="text-[13px] font-black">
                  {announcementDraft.visible
                    ? announcementDraft.message || "Waiting for content..."
                    : "Announcement hidden"}
                </p>
                <p className="text-[9px] text-white/70">
                  {announcementDraft.ctaLabel
                    ? `${announcementDraft.ctaLabel} · ${announcementDraft.ctaLink || "/"}`
                    : "CTA not set"}
                </p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Activity Logs</h2>
              <button
                onClick={loadLogs}
                className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]"
                type="button"
                aria-label="Refresh logs"
              >
                <RefreshIcon loading={logsLoading} label="Refresh logs" />
              </button>
            </div>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-accent" />
              </div>
            ) : logs.length ? (
              <div className="space-y-3 break-words text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="space-y-1 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3 break-words"
                  >
                    <div className="flex items-center justify-between text-[9px] text-white/60">
                      <span>{log.action_type.replace(/_/g, " ")}</span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-white break-words">{log.description}</p>
                    {log.details && (
                      <p className="text-[8px] text-white/60 break-words whitespace-pre-wrap">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">No activity yet.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
