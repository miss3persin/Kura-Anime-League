"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { supabase } from "@/lib/supabase/client";
import type { PredictionEvent } from "@/lib/types/predictions";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  Users,
} from "lucide-react";

type AdminUser = {
  id: string;
  email: string | null;
  username: string | null;
  role: string;
  totalKp: number;
  isSuspended: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

type AccessGrant = {
  email: string;
  role: string;
  totalKp: number;
  isSuspended: boolean;
};

type ContentPayload = {
  hero: {
    visible?: boolean;
    headline?: string;
    subtitle?: string;
    cta?: string;
    ctaLink?: string;
  };
  config: Record<string, boolean>;
  announcement: {
    visible?: boolean;
    message?: string;
    ctaLabel?: string;
    ctaLink?: string;
  };
  leveling: {
    base_kp?: number;
    growth_rate?: number;
  };
};

type Season = {
  id: string;
  name: string;
  status: string;
  draft_opens_at: string | null;
  draft_closes_at: string | null;
  start_date: string | null;
  end_date: string | null;
  transfer_review_ends_at: string | null;
  week_number: number | null;
  total_weeks: number | null;
};

type Poll = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  votes_a: number;
  votes_b: number;
  is_active: boolean;
  created_at: string;
};

type AdminLog = {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
};

type PredictionEventForm = {
  seasonId: string;
  weekNumber: number;
  animeId: string;
  title: string;
  description: string;
  predictionType: string;
  optionALabel: string;
  optionAValue: string;
  optionAOdds: number;
  optionBLabel: string;
  optionBValue: string;
  optionBOdds: number;
  deadline: string;
  isActive: boolean;
  isResolved: boolean;
  correctOptionValue: string;
};

type AdminState = {
  users: AdminUser[];
  grants: AccessGrant[];
  content: ContentPayload;
  seasons: Season[];
  polls: Poll[];
  predictionEvents: PredictionEvent[];
  logs: AdminLog[];
};

type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

const DEFAULT_CONTENT: ContentPayload = {
  hero: {
    visible: true,
    headline: "",
    subtitle: "",
    cta: "",
    ctaLink: "",
  },
  config: {
    show_real_time_timeline: true,
    show_trending_highlights: true,
    show_market_pulse: true,
    show_playbook: true,
    show_leaderboard_preview: true,
    show_season_timeline: true,
    disable_welcome_modal: false,
  },
  announcement: {
    visible: false,
    message: "",
    ctaLabel: "",
    ctaLink: "",
  },
  leveling: {
    base_kp: 1500,
    growth_rate: 1.18,
  },
};

const DEFAULT_STATE: AdminState = {
  users: [],
  grants: [],
  content: DEFAULT_CONTENT,
  seasons: [],
  polls: [],
  predictionEvents: [],
  logs: [],
};

const ROLE_OPTIONS = ["admin", "player"];
const DATE_FIELDS: Array<
  keyof Pick<Season, "draft_opens_at" | "draft_closes_at" | "start_date" | "end_date" | "transfer_review_ends_at">
> = ["draft_opens_at", "draft_closes_at", "start_date", "end_date", "transfer_review_ends_at"];

const formatDateTime = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
};

const toDatetimeLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 md:p-7 shadow-[0_20px_70px_rgba(0,0,0,0.18)]">
      <div className="mb-5 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">{eyebrow}</p>
        <h2 className="text-xl font-black uppercase tracking-tight text-[var(--foreground)] sm:text-2xl">{title}</h2>
        <p className="max-w-3xl break-words text-sm text-[var(--muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-[var(--foreground)] sm:text-3xl">{value}</p>
      <p className="mt-2 break-words text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-accent";

const buttonClassName =
  "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.25em] transition disabled:cursor-not-allowed disabled:opacity-50";

const createPredictionForm = (seasonId = ""): PredictionEventForm => ({
  seasonId,
  weekNumber: 1,
  animeId: "",
  title: "",
  description: "",
  predictionType: "HYPE_SCORE_TARGET",
  optionALabel: "Yes",
  optionAValue: "true",
  optionAOdds: 2.2,
  optionBLabel: "No",
  optionBValue: "false",
  optionBOdds: 1.7,
  deadline: "",
  isActive: true,
  isResolved: false,
  correctOptionValue: "",
});

const mapEventToForm = (event: PredictionEvent): PredictionEventForm => ({
  seasonId: event.season_id,
  weekNumber: event.week_number,
  animeId: event.anime_id ? String(event.anime_id) : "",
  title: event.title,
  description: event.description,
  predictionType: event.prediction_type,
  optionALabel: event.options[0]?.label ?? "Option 1",
  optionAValue: event.options[0]?.value ?? "option1",
  optionAOdds: event.options[0]?.odds ?? 1.8,
  optionBLabel: event.options[1]?.label ?? "Option 2",
  optionBValue: event.options[1]?.value ?? "option2",
  optionBOdds: event.options[1]?.odds ?? 2,
  deadline: toDatetimeLocal(event.deadline),
  isActive: event.is_active ?? true,
  isResolved: event.is_resolved,
  correctOptionValue: event.correct_option_value ?? "",
});

const buildPredictionPayload = (form: PredictionEventForm) => ({
  seasonId: form.seasonId,
  weekNumber: form.weekNumber,
  animeId: form.animeId.trim() ? Number(form.animeId) : null,
  title: form.title,
  description: form.description,
  predictionType: form.predictionType,
  options: [
    { label: form.optionALabel, value: form.optionAValue, odds: Number(form.optionAOdds) },
    { label: form.optionBLabel, value: form.optionBValue, odds: Number(form.optionBOdds) },
  ],
  deadline: form.deadline,
  isActive: form.isActive,
  isResolved: form.isResolved,
  correctOptionValue: form.correctOptionValue || null,
});

export default function AdminPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [state, setState] = useState<AdminState>(DEFAULT_STATE);
  const [contentDraft, setContentDraft] = useState<ContentPayload>(DEFAULT_CONTENT);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userDraft, setUserDraft] = useState({ role: "player", totalKp: 20000, isSuspended: false });
  const [grantDraft, setGrantDraft] = useState({ email: "", role: "admin", totalKp: 700000, isSuspended: false });
  const [seasonDrafts, setSeasonDrafts] = useState<Record<string, Record<string, string>>>({});
  const [pollDrafts, setPollDrafts] = useState<Record<string, { question: string; optionA: string; optionB: string; isActive: boolean }>>({});
  const [predictionDrafts, setPredictionDrafts] = useState<Record<string, PredictionEventForm>>({});
  const [newPoll, setNewPoll] = useState({ question: "", optionA: "", optionB: "", isActive: true });
  const [newPrediction, setNewPrediction] = useState<PredictionEventForm>(createPredictionForm());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [search, setSearch] = useState("");

  const selectedUser = useMemo(
    () => state.users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, state.users],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return state.users;
    return state.users.filter((user) => {
      return (
        user.email?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    });
  }, [search, state.users]);

  const stats = useMemo(() => {
    const adminCount = state.users.filter((user) => user.role === "admin").length;
    const suspendedCount = state.users.filter((user) => user.isSuspended).length;
    const totalKp = state.users.reduce((sum, user) => sum + user.totalKp, 0);
    return { adminCount, suspendedCount, totalKp };
  }, [state.users]);

  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return null;
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }, []);

  const refreshAll = useCallback(async (headers: Record<string, string>, preserveToast = true) => {
    try {
      setStatus("loading");
      const [usersRes, contentRes, seasonsRes, pollsRes, predictionEventsRes, logsRes] = await Promise.all([
        fetch("/api/admin/users", { headers, cache: "no-store" }),
        fetch("/api/admin/content", { headers, cache: "no-store" }),
        fetch("/api/admin/seasons", { headers, cache: "no-store" }),
        fetch("/api/admin/polls", { headers, cache: "no-store" }),
        fetch("/api/admin/predictions", { headers, cache: "no-store" }),
        fetch("/api/admin/logs", { headers, cache: "no-store" }),
      ]);

      const [usersPayload, contentPayload, seasonsPayload, pollsPayload, predictionEventsPayload, logsPayload] = await Promise.all([
        usersRes.json().catch(() => ({})),
        contentRes.json().catch(() => ({})),
        seasonsRes.json().catch(() => ({})),
        pollsRes.json().catch(() => ({})),
        predictionEventsRes.json().catch(() => ({})),
        logsRes.json().catch(() => ({})),
      ]);

      if ([usersRes, contentRes, seasonsRes, pollsRes, predictionEventsRes, logsRes].some((response) => !response.ok)) {
        const firstError =
          usersPayload.error ??
          contentPayload.error ??
          seasonsPayload.error ??
          pollsPayload.error ??
          predictionEventsPayload.error ??
          logsPayload.error ??
          "Failed to load admin data.";
        throw new Error(firstError);
      }

      const nextState: AdminState = {
        users: Array.isArray(usersPayload.users) ? usersPayload.users : [],
        grants: Array.isArray(usersPayload.grants) ? usersPayload.grants : [],
        content: {
          hero: { ...DEFAULT_CONTENT.hero, ...(contentPayload.hero ?? {}) },
          config: { ...DEFAULT_CONTENT.config, ...(contentPayload.config ?? {}) },
          announcement: { ...DEFAULT_CONTENT.announcement, ...(contentPayload.announcement ?? {}) },
          leveling: { ...DEFAULT_CONTENT.leveling, ...(contentPayload.leveling ?? {}) },
        },
        seasons: Array.isArray(seasonsPayload.seasons) ? seasonsPayload.seasons : [],
        polls: Array.isArray(pollsPayload.polls) ? pollsPayload.polls : [],
        predictionEvents: Array.isArray(predictionEventsPayload.predictionEvents) ? predictionEventsPayload.predictionEvents : [],
        logs: Array.isArray(logsPayload.logs) ? logsPayload.logs : [],
      };

      setState(nextState);
      setContentDraft(nextState.content);
      setSeasonDrafts(
        Object.fromEntries(
          nextState.seasons.map((season) => [
            season.id,
            Object.fromEntries(DATE_FIELDS.map((field) => [field, toDatetimeLocal(season[field])])),
          ]),
        ),
      );
      setPollDrafts(
        Object.fromEntries(
          nextState.polls.map((poll) => [
            poll.id,
            {
              question: poll.question,
              optionA: poll.option_a,
              optionB: poll.option_b,
              isActive: poll.is_active,
            },
          ]),
        ),
      );
      setPredictionDrafts(
        Object.fromEntries(
          nextState.predictionEvents.map((event) => [event.id, mapEventToForm(event)]),
        ),
      );
      setNewPrediction((current) => current.seasonId ? current : createPredictionForm(nextState.seasons[0]?.id ?? ""));

      if (!selectedUserId && nextState.users[0]) {
        setSelectedUserId(nextState.users[0].id);
      } else if (selectedUserId && !nextState.users.some((user) => user.id === selectedUserId)) {
        setSelectedUserId(nextState.users[0]?.id ?? "");
      }

      setStatus("ready");
      if (!preserveToast) {
        setToast(null);
      }
    } catch (error) {
      setStatus("error");
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load admin data.",
      });
    }
  }, [selectedUserId]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const headers = await getAuthHeaders();

      if (!headers) {
        if (!cancelled) {
          setStatus("error");
          setToast({ tone: "error", message: "Admin access requires an authenticated session." });
        }
        return;
      }

      if (!cancelled) {
        await refreshAll(headers, false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [getAuthHeaders, refreshAll]);

  useEffect(() => {
    if (!selectedUser) return;
    setUserDraft({
      role: selectedUser.role,
      totalKp: selectedUser.totalKp,
      isSuspended: selectedUser.isSuspended,
    });
  }, [selectedUser]);

  const runAction = async (key: string, action: () => Promise<void>, successMessage: string) => {
    try {
      setBusyKey(key);
      await action();
      setToast({ tone: "success", message: successMessage });
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Action failed.",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const postJson = async (url: string, body: unknown, method = "POST") => {
    const headers = await getAuthHeaders();

    if (!headers) {
      throw new Error("Missing admin session.");
    }

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }

    return payload;
  };

  const refreshWithCurrentSession = useCallback(async (preserveToast = true) => {
    const headers = await getAuthHeaders();

    if (!headers) {
      throw new Error("Admin session expired. Sign in again.");
    }

    await refreshAll(headers, preserveToast);
  }, [getAuthHeaders, refreshAll]);

  const renderBody = () => {
    if (status === "loading") {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-accent" size={44} />
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-[var(--muted)]">Loading admin control center</p>
        </div>
      );
    }

    if (status === "error" && !state.users.length) {
      return (
        <div className="rounded-[2rem] border border-red-500/40 bg-red-500/10 p-8 text-center">
          <AlertTriangle className="mx-auto text-red-300" size={40} />
          <h1 className="mt-4 text-2xl font-black uppercase tracking-tight text-[var(--foreground)]">Admin panel unavailable</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--muted)]">
            The control center could not load. This usually means the current session is not authorized or one of the admin APIs failed.
          </p>
        </div>
      );
    }

    return (
      <div className="min-w-0 space-y-6">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4 sm:p-6 md:p-8">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">Admin HQ</p>
              <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--foreground)] sm:text-3xl md:text-5xl">
                Run the whole webapp from one place
              </h1>
              <p className="break-words text-sm text-[var(--muted)] md:text-base">
                User access, KP, homepage content, season dates, polls, and audit history are managed here so admins do not need direct code or database edits for routine operations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshWithCurrentSession()}
              className={`${buttonClassName} w-full gap-2 border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 sm:w-auto`}
              disabled={busyKey !== null}
            >
              <RefreshCw size={16} />
              Refresh data
            </button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Users" value={state.users.length.toString()} hint="All authenticated accounts currently visible to Supabase admin." />
            <StatCard label="Admins" value={stats.adminCount.toString()} hint="Accounts with current admin role access." />
            <StatCard label="Suspended" value={stats.suspendedCount.toString()} hint="Users blocked from normal activity pending review." />
            <StatCard label="KP in play" value={stats.totalKp.toLocaleString()} hint="Combined KP across the visible user directory." />
          </div>
        </section>

        {toast ? (
          <div
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
              toast.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/30 bg-red-500/10 text-red-100"
            }`}
          >
            {toast.tone === "success" ? <CheckCircle2 size={18} /> : <Siren size={18} />}
            <span>{toast.message}</span>
          </div>
        ) : null}

        <Section
          eyebrow="User Access"
          title="People, roles, KP, and suspension"
          description="Search users, promote or demote roles, set KP balances, suspend accounts, and pre-configure access defaults by email before someone signs in."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
            <div className="min-w-0 space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by email, username, or role"
                  className={`${inputClassName} pl-11`}
                />
              </div>
              <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1 sm:max-h-[34rem]">
                {filteredUsers.map((user) => {
                  const active = user.id === selectedUserId;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                        active ? "border-accent bg-accent/10" : "border-white/8 bg-[var(--background)] hover:border-white/20"
                      }`}
                    >
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black text-[var(--foreground)]">{user.username || "No username yet"}</p>
                          <p className="mt-1 break-all text-xs text-[var(--muted)]">{user.email || "No email"}</p>
                        </div>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-accent">
                          {user.role}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                        <span>{user.totalKp.toLocaleString()} KP</span>
                        <span>{user.isSuspended ? "Suspended" : "Active"}</span>
                        <span>Last sign-in: {user.lastSignInAt ? formatDateTime(user.lastSignInAt) : "Never"}</span>
                      </div>
                    </button>
                  );
                })}
                {!filteredUsers.length ? (
                  <div className="rounded-[1.5rem] border border-dashed border-white/10 p-6 text-center text-sm text-[var(--muted)]">
                    No users match the current search.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-accent" size={18} />
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Selected user</h3>
                  <p className="text-xs text-[var(--muted)]">Live changes update both auth metadata and the profile record.</p>
                </div>
              </div>
              {selectedUser ? (
                <>
                  <div className="min-w-0 rounded-2xl border border-white/8 bg-black/10 p-4 text-sm">
                    <p className="break-words font-black text-[var(--foreground)]">{selectedUser.username || "No username"}</p>
                    <p className="mt-1 break-all text-[var(--muted)]">{selectedUser.email}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Joined {formatDateTime(selectedUser.createdAt)}</p>
                  </div>
                  <Field label="Role">
                    <select
                      value={userDraft.role}
                      onChange={(event) => setUserDraft((current) => ({ ...current, role: event.target.value }))}
                      className={inputClassName}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Total KP">
                    <input
                      type="number"
                      min={0}
                      value={userDraft.totalKp}
                      onChange={(event) => setUserDraft((current) => ({ ...current, totalKp: Number(event.target.value || 0) }))}
                      className={inputClassName}
                    />
                  </Field>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={userDraft.isSuspended}
                      onChange={(event) => setUserDraft((current) => ({ ...current, isSuspended: event.target.checked }))}
                    />
                    Suspend this user
                  </label>
                  <button
                    type="button"
                    className={`${buttonClassName} w-full bg-accent text-black hover:opacity-90`}
                    disabled={busyKey !== null}
                    onClick={() =>
                      void runAction(
                        `user:${selectedUser.id}`,
                        async () => {
                          await postJson("/api/admin/users", {
                            userId: selectedUser.id,
                            role: userDraft.role,
                            totalKp: userDraft.totalKp,
                            isSuspended: userDraft.isSuspended,
                          });
                          await refreshWithCurrentSession();
                        },
                        "User updated successfully.",
                      )
                    }
                  >
                    {busyKey === `user:${selectedUser.id}` ? <Loader2 className="animate-spin" size={16} /> : "Save user changes"}
                  </button>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-[var(--muted)]">
                  Select a user to edit role, KP, and suspension status.
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Users className="text-accent" size={18} />
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Access by email</h3>
                  <p className="text-xs text-[var(--muted)]">Grant admin or player defaults before the user signs in.</p>
                </div>
              </div>
              <Field label="Email">
                <input
                  type="email"
                  value={grantDraft.email}
                  onChange={(event) => setGrantDraft((current) => ({ ...current, email: event.target.value }))}
                  className={inputClassName}
                  placeholder="name@example.com"
                />
              </Field>
              <Field label="Default role">
                <select
                  value={grantDraft.role}
                  onChange={(event) => setGrantDraft((current) => ({ ...current, role: event.target.value }))}
                  className={inputClassName}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default KP">
                <input
                  type="number"
                  min={0}
                  value={grantDraft.totalKp}
                  onChange={(event) => setGrantDraft((current) => ({ ...current, totalKp: Number(event.target.value || 0) }))}
                  className={inputClassName}
                />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={grantDraft.isSuspended}
                  onChange={(event) => setGrantDraft((current) => ({ ...current, isSuspended: event.target.checked }))}
                />
                Start as suspended
              </label>
              <button
                type="button"
                className={`${buttonClassName} w-full bg-white text-black hover:opacity-90`}
                disabled={busyKey !== null || !grantDraft.email.trim()}
                onClick={() =>
                  void runAction(
                    `grant:${grantDraft.email}`,
                    async () => {
                      await postJson("/api/admin/users", {
                        action: "grant_access",
                        email: grantDraft.email,
                        role: grantDraft.role,
                        totalKp: grantDraft.totalKp,
                        isSuspended: grantDraft.isSuspended,
                      });
                      setGrantDraft({ email: "", role: "admin", totalKp: 700000, isSuspended: false });
                      await refreshWithCurrentSession();
                    },
                    "Access defaults saved successfully.",
                  )
                }
              >
                {busyKey?.startsWith("grant:") ? <Loader2 className="animate-spin" size={16} /> : "Save access defaults"}
              </button>
              <div className="space-y-3 pt-2">
                {state.grants.map((grant) => (
                  <div key={grant.email} className="min-w-0 rounded-2xl border border-white/8 bg-black/10 p-4">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-all text-sm font-black text-[var(--foreground)]">{grant.email}</p>
                        <p className="mt-1 break-words text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                          {grant.role} • {grant.totalKp.toLocaleString()} KP • {grant.isSuspended ? "Suspended" : "Active"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-[10px] font-black uppercase tracking-[0.25em] text-red-300"
                        disabled={busyKey !== null}
                        onClick={() =>
                          void runAction(
                            `remove:${grant.email}`,
                            async () => {
                              await postJson("/api/admin/users", { action: "remove_grant", email: grant.email });
                              await refreshWithCurrentSession();
                            },
                            "Access defaults removed.",
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {!state.grants.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-[var(--muted)]">
                    No email-based access defaults are configured yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Site Content"
          title="Homepage and display controls"
          description="Edit the hero banner, announcement rail, and visibility toggles that shape what users see across the app."
        >
          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Hero banner</h3>
              <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={Boolean(contentDraft.hero.visible)}
                  onChange={(event) => setContentDraft((current) => ({ ...current, hero: { ...current.hero, visible: event.target.checked } }))}
                />
                Show hero section
              </label>
              <Field label="Headline">
                <input
                  value={contentDraft.hero.headline ?? ""}
                  onChange={(event) => setContentDraft((current) => ({ ...current, hero: { ...current.hero, headline: event.target.value } }))}
                  className={inputClassName}
                />
              </Field>
              <Field label="Subtitle">
                <textarea
                  value={contentDraft.hero.subtitle ?? ""}
                  onChange={(event) => setContentDraft((current) => ({ ...current, hero: { ...current.hero, subtitle: event.target.value } }))}
                  className={`${inputClassName} min-h-28`}
                />
              </Field>
              <Field label="CTA label">
                <input
                  value={contentDraft.hero.cta ?? ""}
                  onChange={(event) => setContentDraft((current) => ({ ...current, hero: { ...current.hero, cta: event.target.value } }))}
                  className={inputClassName}
                />
              </Field>
              <Field label="CTA link">
                <input
                  value={contentDraft.hero.ctaLink ?? ""}
                  onChange={(event) => setContentDraft((current) => ({ ...current, hero: { ...current.hero, ctaLink: event.target.value } }))}
                  className={inputClassName}
                />
              </Field>
            </div>

            <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Announcement</h3>
              <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={Boolean(contentDraft.announcement.visible)}
                  onChange={(event) =>
                    setContentDraft((current) => ({ ...current, announcement: { ...current.announcement, visible: event.target.checked } }))
                  }
                />
                Show announcement
              </label>
              <Field label="Message">
                <textarea
                  value={contentDraft.announcement.message ?? ""}
                  onChange={(event) =>
                    setContentDraft((current) => ({ ...current, announcement: { ...current.announcement, message: event.target.value } }))
                  }
                  className={`${inputClassName} min-h-36`}
                />
              </Field>
              <Field label="CTA label">
                <input
                  value={contentDraft.announcement.ctaLabel ?? ""}
                  onChange={(event) =>
                    setContentDraft((current) => ({ ...current, announcement: { ...current.announcement, ctaLabel: event.target.value } }))
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="CTA link">
                <input
                  value={contentDraft.announcement.ctaLink ?? ""}
                  onChange={(event) =>
                    setContentDraft((current) => ({ ...current, announcement: { ...current.announcement, ctaLink: event.target.value } }))
                  }
                  className={inputClassName}
                />
              </Field>
            </div>

            <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Display toggles</h3>
              <div className="space-y-3">
                {Object.entries(contentDraft.config).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 px-4 py-3">
                    <span className="min-w-0 break-words pr-3 text-sm text-[var(--foreground)]">{key.replaceAll("_", " ")}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) =>
                        setContentDraft((current) => ({ ...current, config: { ...current.config, [key]: event.target.checked } }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">Leveling system</h3>
              <p className="text-xs text-[var(--muted)]">
                Base KP sets the early speed. Growth rate scales each next level for a slower climb later.
              </p>
              <Field label="Base KP (level 2 requirement)">
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={contentDraft.leveling.base_kp ?? 1500}
                  onChange={(event) =>
                    setContentDraft((current) => ({
                      ...current,
                      leveling: { ...current.leveling, base_kp: Number(event.target.value || 0) },
                    }))
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Growth rate (slower later)">
                <input
                  type="number"
                  min={1.01}
                  step={0.01}
                  value={contentDraft.leveling.growth_rate ?? 1.18}
                  onChange={(event) =>
                    setContentDraft((current) => ({
                      ...current,
                      leveling: { ...current.leveling, growth_rate: Number(event.target.value || 0) },
                    }))
                  }
                  className={inputClassName}
                />
              </Field>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              className={`${buttonClassName} w-full bg-accent text-black hover:opacity-90 sm:w-auto`}
              disabled={busyKey !== null}
              onClick={() =>
                void runAction(
                  "content",
                  async () => {
                    await postJson("/api/admin/content", contentDraft);
                    await refreshWithCurrentSession();
                  },
                  "Content settings updated.",
                )
              }
            >
              {busyKey === "content" ? <Loader2 className="animate-spin" size={16} /> : "Publish content changes"}
            </button>
          </div>
        </Section>

        <Section
          eyebrow="Season Ops"
          title="Timeline and automation"
          description="Trigger season management automation and adjust the date windows that control drafting, transfers, and the active season timeline."
        >
          <div className="mb-5 flex flex-wrap gap-3">
            <button
              type="button"
              className={`${buttonClassName} gap-2 bg-white text-black hover:opacity-90`}
              disabled={busyKey !== null}
              onClick={() =>
                void runAction(
                  "season-manage",
                  async () => {
                    await postJson("/api/admin/seasons", { action: "manage" });
                    await refreshWithCurrentSession();
                  },
                  "Season automation completed.",
                )
              }
            >
              {busyKey === "season-manage" ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Run season automation
            </button>
          </div>
          <div className="space-y-4">
            {state.seasons.map((season) => (
              <div key={season.id} className="min-w-0 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-black uppercase tracking-tight text-[var(--foreground)]">{season.name}</h3>
                    <p className="mt-1 break-words text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                      {season.status} • Week {season.week_number ?? 0} / {season.total_weeks ?? 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${buttonClassName} w-full bg-accent text-black hover:opacity-90 sm:w-auto`}
                    disabled={busyKey !== null}
                    onClick={() =>
                      void runAction(
                        `season:${season.id}`,
                        async () => {
                          await postJson("/api/admin/seasons", {
                            action: "update",
                            seasonId: season.id,
                            fields: seasonDrafts[season.id] ?? {},
                          });
                          await refreshWithCurrentSession();
                        },
                        `${season.name} updated.`,
                      )
                    }
                  >
                    {busyKey === `season:${season.id}` ? <Loader2 className="animate-spin" size={16} /> : "Save season dates"}
                  </button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-5">
                  {DATE_FIELDS.map((field) => (
                    <Field key={field} label={field.replaceAll("_", " ")}>
                      <div className="space-y-2">
                        <input
                          type="datetime-local"
                          value={seasonDrafts[season.id]?.[field] ?? ""}
                          onChange={(event) =>
                            setSeasonDrafts((current) => ({
                              ...current,
                              [season.id]: { ...(current[season.id] ?? {}), [field]: event.target.value },
                            }))
                          }
                          className={inputClassName}
                        />
                        <p className="text-xs text-[var(--muted)]">Current: {formatDateTime(season[field])}</p>
                      </div>
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Poll Studio"
          title="Create and tune polls"
          description="Launch new polls, toggle them on or off, and reset vote counts without touching the database directly."
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="min-w-0 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">New poll</h3>
              <div className="mt-4 space-y-4">
                <Field label="Question">
                  <textarea
                    value={newPoll.question}
                    onChange={(event) => setNewPoll((current) => ({ ...current, question: event.target.value }))}
                    className={`${inputClassName} min-h-28`}
                  />
                </Field>
                <Field label="Option A">
                  <input
                    value={newPoll.optionA}
                    onChange={(event) => setNewPoll((current) => ({ ...current, optionA: event.target.value }))}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Option B">
                  <input
                    value={newPoll.optionB}
                    onChange={(event) => setNewPoll((current) => ({ ...current, optionB: event.target.value }))}
                    className={inputClassName}
                  />
                </Field>
                <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={newPoll.isActive}
                    onChange={(event) => setNewPoll((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  Set active immediately
                </label>
                <button
                  type="button"
                  className={`${buttonClassName} w-full bg-accent text-black hover:opacity-90`}
                  disabled={busyKey !== null}
                  onClick={() =>
                    void runAction(
                      "poll-create",
                      async () => {
                        await postJson("/api/admin/polls", newPoll);
                        setNewPoll({ question: "", optionA: "", optionB: "", isActive: true });
                        await refreshWithCurrentSession();
                      },
                      "Poll created.",
                    )
                  }
                >
                  {busyKey === "poll-create" ? <Loader2 className="animate-spin" size={16} /> : "Create poll"}
                </button>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              {state.polls.map((poll) => {
                const draft = pollDrafts[poll.id] ?? {
                  question: poll.question,
                  optionA: poll.option_a,
                  optionB: poll.option_b,
                  isActive: poll.is_active,
                };
                return (
                  <div key={poll.id} className="min-w-0 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-black uppercase tracking-tight text-[var(--foreground)]">{poll.question}</h3>
                        <p className="mt-1 break-words text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                          {poll.votes_a} vs {poll.votes_b} votes • {poll.is_active ? "Active" : "Inactive"} • Created {formatDateTime(poll.created_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`${buttonClassName} w-full bg-white text-black hover:opacity-90 sm:w-auto`}
                        disabled={busyKey !== null}
                        onClick={() =>
                          void runAction(
                            `poll:${poll.id}`,
                            async () => {
                              await postJson("/api/admin/polls", {
                                pollId: poll.id,
                                question: draft.question,
                                optionA: draft.optionA,
                                optionB: draft.optionB,
                                isActive: draft.isActive,
                              }, "PATCH");
                              await refreshWithCurrentSession();
                            },
                            "Poll updated.",
                          )
                        }
                      >
                        {busyKey === `poll:${poll.id}` ? <Loader2 className="animate-spin" size={16} /> : "Save poll"}
                      </button>
                    </div>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <Field label="Question">
                        <textarea
                          value={draft.question}
                          onChange={(event) => setPollDrafts((current) => ({ ...current, [poll.id]: { ...draft, question: event.target.value } }))}
                          className={`${inputClassName} min-h-24`}
                        />
                      </Field>
                      <div className="space-y-4">
                        <Field label="Option A">
                          <input
                            value={draft.optionA}
                            onChange={(event) => setPollDrafts((current) => ({ ...current, [poll.id]: { ...draft, optionA: event.target.value } }))}
                            className={inputClassName}
                          />
                        </Field>
                        <Field label="Option B">
                          <input
                            value={draft.optionB}
                            onChange={(event) => setPollDrafts((current) => ({ ...current, [poll.id]: { ...draft, optionB: event.target.value } }))}
                            className={inputClassName}
                          />
                        </Field>
                        <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={(event) => setPollDrafts((current) => ({ ...current, [poll.id]: { ...draft, isActive: event.target.checked } }))}
                          />
                          Poll is active
                        </label>
                        <button
                          type="button"
                          className={`${buttonClassName} w-full border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20`}
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runAction(
                              `poll-reset:${poll.id}`,
                              async () => {
                                await postJson("/api/admin/polls", { pollId: poll.id, resetVotes: true }, "PATCH");
                                await refreshWithCurrentSession();
                              },
                              "Poll votes reset.",
                            )
                          }
                        >
                          {busyKey === `poll-reset:${poll.id}` ? <Loader2 className="animate-spin" size={16} /> : "Reset votes"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Prediction Ops"
          title="Create and manage prediction events"
          description="Control the actual prediction opportunities players can bet on, including deadlines, options, activation, resolution, and safe deletion."
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="min-w-0 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-[var(--foreground)]">New prediction event</h3>
              <div className="mt-4 space-y-4">
                <Field label="Season">
                  <select
                    value={newPrediction.seasonId}
                    onChange={(event) => setNewPrediction((current) => ({ ...current, seasonId: event.target.value }))}
                    className={inputClassName}
                  >
                    <option value="">Select season</option>
                    {state.seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Week number">
                    <input
                      type="number"
                      min={1}
                      value={newPrediction.weekNumber}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, weekNumber: Number(event.target.value || 1) }))}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Anime ID (optional)">
                    <input
                      value={newPrediction.animeId}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, animeId: event.target.value }))}
                      className={inputClassName}
                    />
                  </Field>
                </div>
                <Field label="Prediction type">
                  <input
                    value={newPrediction.predictionType}
                    onChange={(event) => setNewPrediction((current) => ({ ...current, predictionType: event.target.value }))}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Title">
                  <input
                    value={newPrediction.title}
                    onChange={(event) => setNewPrediction((current) => ({ ...current, title: event.target.value }))}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={newPrediction.description}
                    onChange={(event) => setNewPrediction((current) => ({ ...current, description: event.target.value }))}
                    className={`${inputClassName} min-h-28`}
                  />
                </Field>
                <Field label="Deadline">
                  <input
                    type="datetime-local"
                    value={newPrediction.deadline}
                    onChange={(event) => setNewPrediction((current) => ({ ...current, deadline: event.target.value }))}
                    className={inputClassName}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Option A label">
                    <input
                      value={newPrediction.optionALabel}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, optionALabel: event.target.value }))}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Option A value">
                    <input
                      value={newPrediction.optionAValue}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, optionAValue: event.target.value }))}
                      className={inputClassName}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Option B label">
                    <input
                      value={newPrediction.optionBLabel}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, optionBLabel: event.target.value }))}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Option B value">
                    <input
                      value={newPrediction.optionBValue}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, optionBValue: event.target.value }))}
                      className={inputClassName}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Option A odds">
                    <input
                      type="number"
                      step="0.1"
                      min={1}
                      value={newPrediction.optionAOdds}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, optionAOdds: Number(event.target.value || 1) }))}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Option B odds">
                    <input
                      type="number"
                      step="0.1"
                      min={1}
                      value={newPrediction.optionBOdds}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, optionBOdds: Number(event.target.value || 1) }))}
                      className={inputClassName}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={newPrediction.isActive}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, isActive: event.target.checked }))}
                    />
                    Active immediately
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={newPrediction.isResolved}
                      onChange={(event) => setNewPrediction((current) => ({ ...current, isResolved: event.target.checked }))}
                    />
                    Already resolved
                  </label>
                </div>
                <Field label="Correct option value (if resolved)">
                  <input
                    value={newPrediction.correctOptionValue}
                    onChange={(event) => setNewPrediction((current) => ({ ...current, correctOptionValue: event.target.value }))}
                    className={inputClassName}
                  />
                </Field>
                <button
                  type="button"
                  className={`${buttonClassName} w-full bg-accent text-black hover:opacity-90`}
                  disabled={busyKey !== null}
                  onClick={() =>
                    void runAction(
                      "prediction-create",
                      async () => {
                        await postJson("/api/admin/predictions", buildPredictionPayload(newPrediction));
                        setNewPrediction(createPredictionForm(state.seasons[0]?.id ?? ""));
                        await refreshWithCurrentSession();
                      },
                      "Prediction event created.",
                    )
                  }
                >
                  {busyKey === "prediction-create" ? <Loader2 className="animate-spin" size={16} /> : "Create prediction event"}
                </button>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              {state.predictionEvents.map((event) => {
                const draft = predictionDrafts[event.id] ?? mapEventToForm(event);
                return (
                  <div key={event.id} className="min-w-0 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-black uppercase tracking-tight text-[var(--foreground)]">{event.title}</h3>
                        <p className="mt-1 break-words text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                          Week {event.week_number} • {event.prediction_type} • {event.is_active ? "Active" : "Inactive"} • {event.is_resolved ? "Resolved" : "Open"}
                        </p>
                      </div>
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <button
                          type="button"
                          className={`${buttonClassName} w-full bg-white text-black hover:opacity-90 sm:w-auto`}
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runAction(
                              `prediction:${event.id}`,
                              async () => {
                                await postJson("/api/admin/predictions", { eventId: event.id, ...buildPredictionPayload(draft) }, "PATCH");
                                await refreshWithCurrentSession();
                              },
                              "Prediction event updated.",
                            )
                          }
                        >
                          {busyKey === `prediction:${event.id}` ? <Loader2 className="animate-spin" size={16} /> : "Save event"}
                        </button>
                        <button
                          type="button"
                          className={`${buttonClassName} w-full border border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 sm:w-auto`}
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runAction(
                              `prediction-delete:${event.id}`,
                              async () => {
                                const headers = await getAuthHeaders();
                                if (!headers) throw new Error("Missing admin session.");
                                const response = await fetch(`/api/admin/predictions?eventId=${event.id}`, {
                                  method: "DELETE",
                                  headers,
                                });
                                const payload = await response.json().catch(() => ({}));
                                if (!response.ok) {
                                  throw new Error(payload.error ?? "Failed to delete prediction event");
                                }
                                await refreshAll(headers);
                              },
                              "Prediction event deleted.",
                            )
                          }
                        >
                          {busyKey === `prediction-delete:${event.id}` ? <Loader2 className="animate-spin" size={16} /> : "Delete event"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        <Field label="Season">
                          <select
                            value={draft.seasonId}
                            onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, seasonId: input.target.value } }))}
                            className={inputClassName}
                          >
                            <option value="">Select season</option>
                            {state.seasons.map((season) => (
                              <option key={season.id} value={season.id}>
                                {season.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Week number">
                            <input
                              type="number"
                              min={1}
                              value={draft.weekNumber}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, weekNumber: Number(input.target.value || 1) } }))}
                              className={inputClassName}
                            />
                          </Field>
                          <Field label="Anime ID">
                            <input
                              value={draft.animeId}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, animeId: input.target.value } }))}
                              className={inputClassName}
                            />
                          </Field>
                        </div>
                        <Field label="Prediction type">
                          <input
                            value={draft.predictionType}
                            onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, predictionType: input.target.value } }))}
                            className={inputClassName}
                          />
                        </Field>
                        <Field label="Title">
                          <input
                            value={draft.title}
                            onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, title: input.target.value } }))}
                            className={inputClassName}
                          />
                        </Field>
                        <Field label="Description">
                          <textarea
                            value={draft.description}
                            onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, description: input.target.value } }))}
                            className={`${inputClassName} min-h-24`}
                          />
                        </Field>
                      </div>
                      <div className="space-y-4">
                        <Field label="Deadline">
                          <input
                            type="datetime-local"
                            value={draft.deadline}
                            onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, deadline: input.target.value } }))}
                            className={inputClassName}
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Option A label">
                            <input
                              value={draft.optionALabel}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, optionALabel: input.target.value } }))}
                              className={inputClassName}
                            />
                          </Field>
                          <Field label="Option A value">
                            <input
                              value={draft.optionAValue}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, optionAValue: input.target.value } }))}
                              className={inputClassName}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Option B label">
                            <input
                              value={draft.optionBLabel}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, optionBLabel: input.target.value } }))}
                              className={inputClassName}
                            />
                          </Field>
                          <Field label="Option B value">
                            <input
                              value={draft.optionBValue}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, optionBValue: input.target.value } }))}
                              className={inputClassName}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Option A odds">
                            <input
                              type="number"
                              min={1}
                              step="0.1"
                              value={draft.optionAOdds}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, optionAOdds: Number(input.target.value || 1) } }))}
                              className={inputClassName}
                            />
                          </Field>
                          <Field label="Option B odds">
                            <input
                              type="number"
                              min={1}
                              step="0.1"
                              value={draft.optionBOdds}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, optionBOdds: Number(input.target.value || 1) } }))}
                              className={inputClassName}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                            <input
                              type="checkbox"
                              checked={draft.isActive}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, isActive: input.target.checked } }))}
                            />
                            Event is active
                          </label>
                          <label className="flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 text-sm text-[var(--foreground)]">
                            <input
                              type="checkbox"
                              checked={draft.isResolved}
                              onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, isResolved: input.target.checked } }))}
                            />
                            Event is resolved
                          </label>
                        </div>
                        <Field label="Correct option value">
                          <input
                            value={draft.correctOptionValue}
                            onChange={(input) => setPredictionDrafts((current) => ({ ...current, [event.id]: { ...draft, correctOptionValue: input.target.value } }))}
                            className={inputClassName}
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!state.predictionEvents.length ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 p-6 text-sm text-[var(--muted)]">
                  No managed prediction events exist yet.
                </div>
              ) : null}
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Audit Trail"
          title="Recent admin activity"
          description="Track the last control-center actions so changes are visible and reversible at the process level."
        >
          <div className="space-y-3">
            {state.logs.map((log) => (
              <div key={log.id} className="min-w-0 rounded-[1.5rem] border border-white/8 bg-[var(--background)] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-[var(--foreground)]">{log.description}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.25em] text-[var(--muted)]">{log.action_type}</p>
                  </div>
                  <p className="break-words text-xs text-[var(--muted)]">{formatDateTime(log.created_at)}</p>
                </div>
              </div>
            ))}
            {!state.logs.length ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 p-6 text-sm text-[var(--muted)]">
                No admin logs were returned.
              </div>
            ) : null}
          </div>
        </Section>
      </div>
    );
  };

  return <AppShell>{renderBody()}</AppShell>;
}
