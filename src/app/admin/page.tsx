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

  const now = useMemo(() => new Date(), []);
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
      const targetUser = users.find((item) => item.id === userId);
      if (!targetUser) return;
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
            role: targetUser.role,
            isSuspended: targetUser.isSuspended
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

  const isPreSeason = useMemo(() => now < SPRING_2026_START_DATE, [now]);
  const finalWeek = SPRING_2026_WEEKS[SPRING_2026_WEEKS.length - 1];
  const timelineMessage = useMemo(() => {
    if (isPreSeason) {
      return `As of ${TODAY_FORMATTER.format(now)} Spring 2026 is still in the pre-season planning window; Week 1 launches April 1-7, 2026.`;
    }
    if (currentSpringWeek) {
      return `${currentSpringWeek.label} is live (${currentSpringWeek.range}) and primes the week-by-week premieres before they finish around ${finalWeek.range}.`;
    }
    return `Spring 2026 completes its final scheduled premieres in ${finalWeek.range}.`;
  }, [isPreSeason, now, currentSpringWeek, finalWeek.range]);

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
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 py-4 md:py-6 px-1">
        <header className="space-y-4 px-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.5em] text-[var(--muted)]">Admin Control</p>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-tight">Operations</h1>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="text-accent" size={16} />
              <p className="text-[var(--muted)] uppercase text-[8px] md:text-[10px] tracking-[0.3em]">Secure · Verified</p>
            </div>
          </div>
          <p className="text-xs md:text-sm text-[var(--muted)] leading-relaxed max-w-2xl">
            Manage seasons safely from a single server-only API. Changes are validated by the admin guard.
          </p>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 md:gap-3">
              {springTimeline.map((week) => (
                <WeekChip key={week.label} week={week} highlight={currentSpringWeek?.label === week.label} />
              ))}
            </div>
            <p className="text-[9px] md:text-xs uppercase tracking-[0.3em] md:tracking-[0.4em] text-[var(--muted)]">{timelineMessage}</p>
          </div>
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-xl md:rounded-2xl border px-4 py-3 text-xs md:text-sm font-black uppercase tracking-[0.2em] ${
                feedback.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              {feedback.message}
            </div>
          )}
        </header>

        <div className="grid gap-6 md:gap-8 grid-cols-1 xl:grid-cols-[1.5fr,1fr]">
          <div className="space-y-6">
            <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3">
              <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5 text-center">
                <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">Active</p>
                <p className="mt-2 text-2xl md:text-3xl font-black">{assignmentStats.active}</p>
              </div>
              <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5 text-center">
                <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">Upcoming</p>
                <p className="mt-2 text-2xl md:text-3xl font-black">{assignmentStats.upcoming}</p>
              </div>
              <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5 text-center col-span-2 md:col-span-1">
                <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">Past</p>
                <p className="mt-2 text-2xl md:text-3xl font-black">{assignmentStats.past}</p>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-base md:text-lg font-black uppercase tracking-[0.4em] text-[var(--muted)]">Seasons</h2>
                <button
                  onClick={refreshSeasons}
                  className="p-2 text-[var(--muted)] hover:text-white transition-colors"
                  disabled={loading}
                >
                  <RefreshIcon loading={loading} />
                </button>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-accent" />
                </div>
              ) : (
                <div className="space-y-4">
                  {seasons.map((season) => (
                    <div key={season.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm uppercase tracking-[0.3em] font-black text-[var(--foreground)] truncate">{season.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${getStatusStyles(season.status)}`}>
                              {season.status}
                            </span>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] uppercase font-black text-white/60">
                              Wk {season.week_number ?? 0}/{season.total_weeks ?? "?"}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => updateSelection(season)} className="text-[9px] font-black uppercase tracking-widest text-accent px-3 py-1.5 bg-accent/10 rounded-lg">Edit</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] md:text-[12px]">
                        {[
                          ["Draft Opens", season.draft_opens_at],
                          ["Draft Closes", season.draft_closes_at],
                          ["Season Start", season.start_date],
                          ["Season End", season.end_date]
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between sm:block">
                            <p className="text-[var(--muted)] uppercase text-[8px] font-black">{label}</p>
                            <p className="text-white font-medium">{formatDateTime(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6 shadow-lg space-y-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-accent" size={18} />
                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Automation</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Next Season Name</label>
                  <input
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-white focus:border-accent focus:outline-none"
                    placeholder="Season 2026"
                    value={nextSeasonName}
                    onChange={(e) => setNextSeasonName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <NeonButton onClick={handleAutomation} disabled={runningAutomation} className="w-full text-[10px]">
                    {runningAutomation ? <Loader2 size={14} className="animate-spin" /> : "Run Automation"}
                  </NeonButton>
                  <button onClick={refreshSeasons} className="py-2.5 rounded-xl border border-[var(--border)] text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Refresh All</button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6 shadow-lg space-y-4">
              <div className="flex items-center gap-2">
                <Clock4 className="text-accent" size={18} />
                <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Editor</h2>
              </div>
              {selectedSeason ? (
                <form onSubmit={handleSaveSeason} className="space-y-4">
                  <p className="text-[10px] font-black text-accent uppercase">{selectedSeason.name}</p>
                  {(Object.keys(editingDates) as Array<keyof EditableFields>).map((field) => (
                    <div key={field} className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">{field.replace(/_/g, " ")}</label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-xs text-white focus:border-accent focus:outline-none"
                        value={editingDates[field]}
                        onChange={(e) => setEditingDates((prev) => ({ ...prev, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="flex flex-col gap-2 pt-2">
                    <NeonButton type="submit" disabled={savingSeason} className="w-full text-[10px]">Sync Dates</NeonButton>
                    <button type="button" onClick={() => updateSelection(null)} className="text-[9px] font-black uppercase text-[var(--muted)] py-2">Cancel</button>
                  </div>
                </form>
              ) : (
                <p className="py-4 text-[10px] uppercase font-black text-[var(--muted)] text-center border border-dashed border-[var(--border)] rounded-xl">Pick a season to edit</p>
              )}
            </div>
          </div>
        </div>

        {/* User & Polls Management */}
        <div className="grid gap-6 md:gap-8 grid-cols-1 lg:grid-cols-2">
          {/* Polls Section */}
          <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6 shadow-lg space-y-6">
            <div className="flex items-center gap-2">
              <Vote className="text-accent" size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Polls</h2>
            </div>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              <input
                value={pollForm.question}
                onChange={(e) => setPollForm(prev => ({ ...prev, question: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-xs text-white focus:border-accent focus:outline-none"
                placeholder="Question"
              />
              <div className="grid grid-cols-2 gap-3">
                <input value={pollForm.optionA} onChange={e => setPollForm(prev => ({ ...prev, optionA: e.target.value }))} className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-xs text-white focus:outline-none" placeholder="Opt A" />
                <input value={pollForm.optionB} onChange={e => setPollForm(prev => ({ ...prev, optionB: e.target.value }))} className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-xs text-white focus:outline-none" placeholder="Opt B" />
              </div>
              <NeonButton type="submit" disabled={creatingPoll} className="w-full text-[10px]">Create Poll</NeonButton>
            </form>
            
            <div className="space-y-3 pt-4 border-t border-[var(--border)]">
              {pollsLoading ? (
                <Loader2 className="animate-spin mx-auto text-accent" size={20} />
              ) : polls.map(poll => (
                <div key={poll.id} className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-black uppercase leading-tight truncate flex-1 pr-2">{poll.question}</p>
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${poll.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>{poll.is_active ? 'Active' : 'Off'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handlePollToggle(poll)} className="text-[8px] font-black uppercase text-accent bg-accent/5 px-2 py-1 rounded">Toggle</button>
                    <button onClick={() => handlePollReset(poll)} className="text-[8px] font-black uppercase text-[var(--muted)] px-2 py-1 rounded">Reset</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content & Config */}
          <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6 shadow-lg space-y-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-accent" size={18} />
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Config</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {CONFIG_TOGGLES.map(toggle => (
                  <label key={toggle.key} className="flex items-center gap-2 p-2 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                    <input type="checkbox" checked={Boolean(configDraft[toggle.key])} onChange={() => setConfigDraft(prev => ({ ...prev, [toggle.key]: !prev[toggle.key] }))} className="h-3.5 w-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">{toggle.label}</span>
                  </label>
                ))}
              </div>
              <NeonButton onClick={handleConfigSave} disabled={configSaving} className="w-full text-[10px]">Save Display Config</NeonButton>
            </div>
          </div>
        </div>

        {/* Users Table / List */}
        <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6 shadow-lg space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">User Management</h2>
          <div className="space-y-3">
            {usersLoading ? (
              <Loader2 className="animate-spin mx-auto text-accent" size={20} />
            ) : users.map(user => (
              <div key={user.id} className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-[var(--foreground)] truncate">{user.email ?? user.id}</p>
                  <p className="text-[8px] font-black text-[var(--muted)] uppercase">{user.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-[9px] font-black text-white"
                    value={user.role}
                    onChange={(e) => setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: e.target.value } : u))}
                  >
                    <option value="player">PLAYER</option>
                    <option value="admin">ADMIN</option>
                  </select>
                  <NeonButton onClick={() => handleUserUpdate(user.id)} disabled={savingUserId === user.id} className="px-3 py-1 text-[8px]">Sync</NeonButton>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs */}
        <div className="rounded-2xl md:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6 shadow-lg space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.4em] text-[var(--muted)]">Recent Logs</h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {logsLoading ? (
              <Loader2 className="animate-spin mx-auto text-accent" size={20} />
            ) : logs.map(log => (
              <div key={log.id} className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[9px] space-y-1">
                <div className="flex justify-between text-[8px] text-[var(--muted)] font-black uppercase">
                  <span>{log.action_type}</span>
                  <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-white font-medium">{log.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
