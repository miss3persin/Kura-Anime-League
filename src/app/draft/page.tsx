"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { NeonButton } from "@/components/ui/neon-button";
import { Search, Zap, RefreshCw, Loader2, Check, Star, Heart, Save, User as UserIcon, Clock, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useRouter } from "next/navigation";
import { useCountdown } from "@/components/ui/season-banner";
import { SeasonInfoPayload, useSeasonTimeline } from "@/lib/hooks/useSeasonTimeline";

interface Anime {
  id: number;
  title_romaji: string;
  title_english: string;
  cover_image: string;
  cost_kp: number;
  format: string;
  season_id?: number | null;
  average_score?: number;
  genres?: string[];
  banner_image?: string;
  hype_change?: number;
  season_uuid?: string;
  season_name?: string;
  hype_score?: number;
}

interface Character {
  id: number;
  name: string;
  image: string;
  anime_id: number;
}

const PHASE_ACTIONS: Record<SeasonInfoPayload["phase"], { label: string; href: string; description: string }> = {
  draft_open: {
    label: "Finish Your Draft",
    href: "/draft",
    description: "Drafting is open. Lock in five series before the deadline."
  },
  pre_draft: {
    label: "Preview Upcoming Shows",
    href: "/hype",
    description: "The league is counting down to the opening bell. Study the upcoming lineup."
  },
  season_live: {
    label: "Track the Hype Index",
    href: "/hype",
    description: "Matches are live. Monitor your team's momentum in real time."
  },
  transfer_review: {
    label: "Manage Transfers",
    href: "/squad",
    description: "Transfer review is active. Decide what picks carry into the next season."
  },
  off_season: {
    label: "Stay in the Loop",
    href: "/hype",
    description: "No draft window yet. Keep scouting until the next season announces itself."
  },
  ended: {
    label: "Relive Highlights",
    href: "/hype",
    description: "Season complete. Review how your picks fared and prep for next season."
  }
};

export default function DraftPage() {
  const router = useRouter();
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [characterList, setCharacterList] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<number[]>([]);
  const [starCharId, setStarCharId] = useState<number | null>(null);
  const [waifuId, setWaifuId] = useState<number | null>(null);
  const [budget, setBudget] = useState(20000);
  const [initialBudget, setInitialBudget] = useState(20000);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'anime' | 'characters'>('anime');
  const timeline = useSeasonTimeline();
  const seasonInfo = timeline.seasonInfo;
  const [draftClosed, setDraftClosed] = useState(false);
  const [previewAnime, setPreviewAnime] = useState<Anime[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const phaseBadgeLabel = seasonInfo?.phase
    ? seasonInfo.phase
        .split("_")
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ")
    : "Pre Draft";
  const seasonDisplayName = seasonInfo?.activeSeason?.name ?? seasonInfo?.upcomingSeason?.name ?? "Season";
  const upcomingSeasonName = seasonInfo?.upcomingSeason?.name ?? "Next Season";
  const deadlineLabel = seasonInfo?.deadlineLabel ?? "Draft Opens";
  const deadlineValue = seasonInfo?.deadline
    ? new Date(seasonInfo.deadline).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric"
      })
    : "TBD";

  const countdown = useCountdown(seasonInfo?.deadline ?? null);
  const phaseAction = PHASE_ACTIONS[seasonInfo?.phase ?? "pre_draft"] ?? PHASE_ACTIONS.pre_draft;
  const countdownSegments = [
    { value: countdown.days, label: "d" },
    { value: countdown.hours, label: "h" },
    { value: countdown.minutes, label: "m" },
    { value: countdown.seconds, label: "s" },
  ];
  const hasCountdown = Boolean(seasonInfo?.deadline);
  const phaseDotClasses = seasonInfo?.phase === "draft_open"
    ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]"
    : "bg-red-500";
  const budgetTone = budget < 0 ? "text-red-400" : "text-accent";
  const getTabButtonClass = (tab: "anime" | "characters") =>
    `px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${tab === activeTab ? "bg-accent text-white shadow-lg" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`;

  // Modal State
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const showAlert = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setIsModalOpen(true);
  };

  const fetchAnimeBySeason = useCallback(
    async (seasonIdentifier?: string | number, fallbackSeasonName?: string) => {
      let query = supabase.from<Anime>('anime_cache').select('*');
      if (typeof seasonIdentifier === 'number') {
        query = query.eq('season_id', seasonIdentifier);
      } else if (typeof seasonIdentifier === 'string') {
        if (/^\d+$/.test(seasonIdentifier)) {
          query = query.eq('season_id', Number(seasonIdentifier));
        } else {
          query = query.eq('season_uuid', seasonIdentifier);
        }
      } else if (fallbackSeasonName) {
        query = query.eq('season_name', fallbackSeasonName);
      }
      const { data } = await query.order('hype_score', { ascending: false });
      return data ?? [];
    },
    []
  );

  const fetchCharacters = useCallback(async () => {
    const { data } = await supabase
      .from<Character>('character_cache')
      .select('*')
      .order('name', { ascending: true });
    return data ?? [];
  }, []);

  const refreshSeasonData = useCallback(
    async ({
      activeSeasonId,
      activeSeasonName,
      upcomingSeasonId,
      upcomingSeasonName
    }: {
      activeSeasonId?: string | number;
      activeSeasonName?: string;
      upcomingSeasonId?: string | number;
      upcomingSeasonName?: string;
    }) => {
      setLoading(true);
      setPreviewLoading(Boolean(upcomingSeasonId ?? upcomingSeasonName));
      try {
        const [animeForSeason, upcomingAnime, characters] = await Promise.all([
          fetchAnimeBySeason(
            activeSeasonId ?? upcomingSeasonId,
            activeSeasonName ?? upcomingSeasonName
          ),
          upcomingSeasonId || upcomingSeasonName
            ? fetchAnimeBySeason(upcomingSeasonId, upcomingSeasonName)
            : Promise.resolve([]),
          fetchCharacters(),
        ]);
        setAnimeList(animeForSeason);
        setPreviewAnime(upcomingAnime.slice(0, 8));
        setCharacterList(characters);
      } catch (error) {
        console.error("Failed to refresh season data", error);
      } finally {
        setLoading(false);
        setPreviewLoading(false);
      }
    },
    [fetchAnimeBySeason, fetchCharacters]
  );

  useEffect(() => {
    const init = async () => {
      if (!seasonInfo) return;
      setDraftClosed(seasonInfo.phase !== 'draft_open');
      await refreshSeasonData({
        activeSeasonId: seasonInfo.activeSeason?.id,
        activeSeasonName: seasonInfo.activeSeason?.name,
        upcomingSeasonId: seasonInfo.upcomingSeason?.id,
        upcomingSeasonName: seasonInfo.upcomingSeason?.name
      });

      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: prof } = await supabase.from('profiles').select('total_kp').eq('id', session.user.id).single();
        if (prof) {
          setBudget(prof.total_kp);
          setInitialBudget(prof.total_kp);
        }
      }
    };
    init();
  }, [seasonInfo, refreshSeasonData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/internal/sync', { method: 'POST' });
      const result = await response.json();
      if (result.data?.success) {
        await refreshSeasonData({
          activeSeasonId: seasonInfo?.activeSeason?.id,
          activeSeasonName: seasonInfo?.activeSeason?.name,
          upcomingSeasonId: seasonInfo?.upcomingSeason?.id,
          upcomingSeasonName: seasonInfo?.upcomingSeason?.name
        });
        showAlert("Sync Complete", `Imported ${result.data.count} titles.`);
      }
    } catch (err) {
      console.error(err);
      showAlert("Sync Failed", "Could not connect to the seasonal server.");
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelectAnime = (anime: Anime) => {
    if (selectedAnimeIds.includes(anime.id)) {
      setSelectedAnimeIds(prev => prev.filter(id => id !== anime.id));
      const newBudget = budget + anime.cost_kp;
      setBudget(newBudget);
      window.dispatchEvent(new CustomEvent('kalKpUpdate', { detail: { total_kp: newBudget } }));
    } else {
      if (selectedAnimeIds.length >= 5) {
        showAlert("Draft Error", "Maximum team size is 5 shows.");
        return;
      }
      if (budget < anime.cost_kp) {
        showAlert("Insufficient KP", "Not enough KuraPoints for this series.");
        return;
      }
      setSelectedAnimeIds(prev => [...prev, anime.id]);
      const newBudget = budget - anime.cost_kp;
      setBudget(newBudget);
      window.dispatchEvent(new CustomEvent('kalKpUpdate', { detail: { total_kp: newBudget } }));
    }
  };

  const handleSaveTeam = async () => {
    if (!user) {
      showAlert("Login Required", "Please log in to save your team.");
      return;
    }
    if (selectedAnimeIds.length === 0) {
      showAlert("Draft Picks Needed", "Select at least one hero before saving.");
      return;
    }

    setSaving(true);
    try {
      const currentSeasonId = seasonInfo?.activeSeason?.id;
      if (!currentSeasonId) throw new Error("No active draft season identified.");

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .upsert({
          user_id: user.id,
          season_id: currentSeasonId,
          remaining_kp: budget
        }, { onConflict: 'user_id,season_id' })
        .select()
        .single();

      if (teamError) throw teamError;

      await supabase.from('team_picks').delete().eq('team_id', teamData.id);
      const picks = selectedAnimeIds.map(id => ({
        team_id: teamData.id,
        anime_id: id
      }));
      await supabase.from('team_picks').insert(picks);

      await supabase.from('character_picks').delete().eq('team_id', teamData.id);
      const charPicks = [];
      if (starCharId) charPicks.push({ team_id: teamData.id, character_id: starCharId, pick_type: 'STAR_CHAR' });
      if (waifuId) charPicks.push({ team_id: teamData.id, character_id: waifuId, pick_type: 'WAIFU_HUSBANDO' });
      if (charPicks.length > 0) {
        await supabase.from('character_picks').insert(charPicks);
      }

      showAlert("Team Deployed", "Your tactical lineup has been synchronized with the league servers. 🏮");
    } catch (err: any) {
      console.error(err);
      showAlert("System Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredAnime = animeList.filter(anime =>
    anime.title_romaji.toLowerCase().includes(searchQuery.toLowerCase()) ||
    anime.title_english?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChars = characterList.filter(char =>
    char.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const previewCharacters = useMemo(() => {
    const previewIds = new Set(previewAnime.map((anime) => anime.id));
    return characterList.filter((character) => previewIds.has(character.anime_id));
  }, [characterList, previewAnime]);

  return (
    <AppShell>
      <div className="space-y-10">
        {loading ? (
          <div className="flex items-center justify-center py-64">
            <Loader2 className="animate-spin text-accent" size={48} />
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-48 space-y-8 bg-[var(--surface)] rounded-[3rem] border border-dashed border-[var(--border)] p-12 text-center">
            <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center text-accent ring-4 ring-accent/10">
              <UserIcon size={40} />
            </div>
            <div className="space-y-4 max-w-md">
              <h3 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Access Restricted</h3>
              <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                You must be an authorized member of the Kura Anime League to access the seasonal drafting interface.
              </p>
            </div>
            <NeonButton onClick={() => router.push('/login')} className="px-10 py-5">
              Log In to Start Draft
            </NeonButton>
          </div>
        ) : (
          <>
            {/* Header Control Panel */}
            <div className="relative grid gap-6 bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] shadow-2xl backdrop-blur-xl transition-all">
              <div className="grid gap-6 lg:grid-cols-[1.35fr,0.95fr]">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">Draft Season</h2>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">{seasonDisplayName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] px-3 py-1 rounded-full border border-[var(--border)]">
                        {phaseBadgeLabel}
                      </span>
                      {seasonInfo && (
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">
                          <div
                            className={`w-2 h-2 rounded-full ${phaseDotClasses} animate-pulse`}
                          />
                          <span>{seasonInfo.phase === "draft_open" ? "Draft Open" : "Phase Locked"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Tactical Budget</p>
                      <p className={`text-sm font-black uppercase tracking-[0.2em] ${budgetTone}`}>
                        {budget.toLocaleString()} KP
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Squad Formation</p>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-3 h-1.5 rounded-full ${i < selectedAnimeIds.length ? "bg-accent" : "bg-[var(--border)]"}`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--foreground)]">{selectedAnimeIds.length}/5</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">{deadlineLabel}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--foreground)]">{deadlineValue}</p>
                    </div>
                  </div>
                  {seasonInfo && (
                    <div className="rounded-3xl border border-[var(--border)] bg-[var(--background)] p-5 shadow-inner">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">{phaseAction.description}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black uppercase tracking-[0.35em] text-[var(--foreground)]">
                              {seasonInfo.phase === "draft_open" ? "Draft window live" : "Phase countdown"}
                            </span>
                            <span className="hidden sm:inline text-[9px] uppercase tracking-[0.3em] text-[var(--muted)]">{seasonDisplayName}</span>
                          </div>
                        </div>
                        {hasCountdown && (
                          <div className="grid grid-cols-4 gap-2">
                            {countdownSegments.map((segment) => (
                              <div
                                key={segment.label}
                                className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-black/15 px-3 py-2"
                              >
                                <span className="text-sm font-black uppercase tracking-[0.3em] text-[var(--foreground)]">
                                  {String(segment.value).padStart(2, "0")}
                                </span>
                                <span className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">
                                  {segment.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">
                          {seasonInfo.deadlineLabel ?? "Next Deadline"}
                        </p>
                        <NeonButton onClick={() => router.push(phaseAction.href)} className="px-6 py-3">
                          {phaseAction.label}
                        </NeonButton>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-6">
                  <div className="flex gap-2 p-1 bg-[var(--background)] rounded-xl w-fit border border-[var(--border)]">
                    <button
                      onClick={() => setActiveTab('anime')}
                      className={getTabButtonClass('anime')}
                    >
                      Show Selection
                    </button>
                    <button
                      onClick={() => setActiveTab('characters')}
                      className={getTabButtonClass('characters')}
                    >
                      Special Picks
                    </button>
                  </div>
                  <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                    <input
                      className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:border-accent transition-all w-full cursor-pointer"
                      placeholder={activeTab === 'anime' ? "Search series..." : "Search characters..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4 w-full sm:w-auto">
                    <NeonButton variant="outline" onClick={handleSync} disabled={syncing} className="px-4">
                      {syncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    </NeonButton>
                    <NeonButton onClick={handleSaveTeam} disabled={saving || draftClosed} className="flex-grow sm:flex-grow-0">
                      {(saving || draftClosed) ? (
                        <div className="flex items-center gap-2">
                          {saving ? <Loader2 className="animate-spin" size={16} /> : <Shield size={16} />}
                          <span>{draftClosed ? 'Drafting Locked' : 'Synchronizing...'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Save size={16} />
                          <span>Deploy Tactical Team</span>
                        </div>
                      )}
                    </NeonButton>
                  </div>
                </div>
              </div>

              {seasonInfo?.upcomingSeason && (
                <div className="space-y-4 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-2xl">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">Next Season Preview</p>
                      <h3 className="text-3xl font-black uppercase tracking-tight text-[var(--foreground)]">
                        {seasonInfo.upcomingSeason.name ?? "Upcoming Season"}
                      </h3>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">
                        Browse the anime & characters that will be available once draft opens.
                      </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <NeonButton variant="outline" onClick={() => router.push('/draft')}>
                        View Draft Board
                      </NeonButton>
                      <NeonButton onClick={() => router.push('/hype')} variant="outline">
                        Track Hype
                      </NeonButton>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6">
                    {previewLoading ? (
                      <div className="flex justify-center py-10">
                        <Loader2 size={24} className="animate-spin text-accent" />
                      </div>
                    ) : previewAnime.length ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {previewAnime.map((anime) => (
                          <div
                            key={anime.id}
                            className="space-y-2 rounded-2xl border border-[var(--border)] bg-black/20 p-3 text-center transition-all hover:border-accent/40"
                          >
                            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[var(--border)]">
                              <img
                                src={anime.banner_image || anime.cover_image}
                                alt={anime.title_romaji}
                                className="h-full w-full object-cover transition-all"
                              />
                            </div>
                            <h4 className="text-[10px] font-black uppercase tracking-tight text-[var(--foreground)]">
                              {anime.title_romaji}
                            </h4>
                            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">
                              {anime.cost_kp.toLocaleString()} KP
                            </p>
                            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-green-400">
                              {anime.hype_change >= 0 ? "+" : ""}
                              {anime.hype_change ?? 0}% hype
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">
                        Upcoming season data is syncing - check back in a few minutes.
                      </p>
                    )}
                  </div>

                  {previewCharacters.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">
                          Featured characters tied to these shows
                        </p>
                        <span className="text-[8px] uppercase tracking-[0.3em] text-[var(--muted)]">
                          {previewCharacters.length} on deck
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                        {previewCharacters.slice(0, 6).map((character) => (
                          <div
                            key={character.id}
                            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-2"
                          >
                            <img
                              src={character.image}
                              alt={character.name}
                              className="h-12 w-12 rounded-xl object-cover"
                            />
                            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">
                              {character.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Summary HUD */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
              <div className={`flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-dashed transition-all ${starCharId ? 'border-yellow-500 bg-yellow-500/5 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-[var(--border)] opacity-40'}`}>
                {starCharId ? (
                  <>
                    <img src={characterList.find(c => c.id === starCharId)?.image} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-yellow-500/50" alt="Star" />
                    <Star size={10} className="text-yellow-500 mt-1 fill-yellow-500" />
                  </>
                ) : (
                  <>
                    <Star size={12} className="text-[var(--muted)]" />
                    <span className="text-[6px] font-black uppercase text-[var(--muted)] mt-1">STAR HERO</span>
                  </>
                )}
              </div>

              <div className={`flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-dashed transition-all ${waifuId ? 'border-pink-500 bg-pink-500/5 shadow-[0_0_15px_rgba(236,72,153,0.1)]' : 'border-[var(--border)] opacity-40'}`}>
                {waifuId ? (
                  <>
                    <img src={characterList.find(c => c.id === waifuId)?.image} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-pink-500/50" alt="Waifu" />
                    <Heart size={10} className="text-pink-500 mt-1 fill-pink-500" />
                  </>
                ) : (
                  <>
                    <Heart size={12} className="text-[var(--muted)]" />
                    <span className="text-[6px] font-black uppercase text-[var(--muted)] mt-1">WAIFU/HUSB</span>
                  </>
                )}
              </div>

              {Array.from({ length: 5 }).map((_, i) => {
                const anime = animeList.find(a => a.id === selectedAnimeIds[i]);
                return (
                  <div key={i} className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-1 md:p-2 text-center space-y-1 transition-all ${anime ? 'border-accent bg-accent/5' : 'border-[var(--border)] opacity-20'}`}>
                    {anime ? (
                      <>
                        <img src={anime.cover_image} className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover" alt="Anime" />
                        <p className="text-[6px] md:text-[7px] font-black uppercase text-accent truncate w-full px-1">{anime.title_romaji}</p>
                      </>
                    ) : (
                      <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-[var(--muted)] opacity-30"></div>
                    )}
                  </div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'anime' ? (
                <motion.div key="anime-grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {filteredAnime.map((anime) => {
                    const isSelected = selectedAnimeIds.includes(anime.id);
                    return (
                      <motion.div key={anime.id} whileHover={{ y: -5 }} onClick={() => toggleSelectAnime(anime)} className={`bg-[var(--surface)] rounded-3xl border transition-all cursor-pointer shadow-lg overflow-hidden group ${isSelected ? 'border-accent ring-2 ring-accent/20' : 'border-[var(--border)] hover:border-accent/30'}`}>
                        <div className="relative aspect-[3/4.2]">
                          <img src={anime.cover_image} className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-105 brightness-50' : 'group-hover:scale-110'}`} alt={anime.title_romaji} />
                          <div className="absolute top-4 left-4 flex flex-col gap-2">
                            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black border border-white/20 flex items-center gap-1.5 text-white">
                              <Zap size={10} className="text-accent" />
                              {anime.cost_kp.toLocaleString()} KP
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-accent text-white p-3 rounded-full shadow-2xl scale-110 ring-4 ring-black">
                                <Check size={24} strokeWidth={4} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-5 space-y-3">
                          <div>
                            <h4 className={`text-[10px] font-black uppercase truncate transition-colors ${isSelected ? 'text-accent' : 'text-[var(--foreground)]'}`}>
                              {anime.title_romaji}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest">{anime.format}</p>
                              {anime.average_score && (
                                <div className="flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-[var(--border)]"></span>
                                  <p className="text-[8px] font-black text-accent uppercase tracking-tighter">{anime.average_score}% Score</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div key="char-grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-6">
                  {filteredChars.map((char) => {
                    const isStar = starCharId === char.id;
                    const isWaifu = waifuId === char.id;
                    return (
                      <motion.div key={char.id} whileHover={{ y: -5 }} className={`bg-[var(--surface)] rounded-3xl border transition-all shadow-lg overflow-hidden group p-4 space-y-4 ${isStar ? 'border-yellow-500 ring-2 ring-yellow-500/20' : isWaifu ? 'border-pink-500 ring-2 ring-pink-500/20' : 'border-[var(--border)] hover:border-accent/30'}`}>
                        <img src={char.image} className="w-full aspect-square object-cover rounded-2xl grayscale group-hover:grayscale-0 transition-all duration-500" alt={char.name} />
                        <div className="text-center space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-tight truncate leading-tight text-[var(--foreground)]">{char.name}</h4>
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => setStarCharId(isStar ? null : char.id)} className={`p-2 rounded-lg transition-all cursor-pointer ${isStar ? 'bg-yellow-500 text-black' : 'bg-[var(--surface-hover)] text-[var(--muted)] hover:text-yellow-500'}`}><Star size={14} fill={isStar ? "black" : "none"} /></button>
                            <button onClick={() => setWaifuId(isWaifu ? null : char.id)} className={`p-2 rounded-lg transition-all cursor-pointer ${isWaifu ? 'bg-pink-500 text-white' : 'bg-[var(--surface-hover)] text-[var(--muted)] hover:text-pink-500'}`}><Heart size={14} fill={isWaifu ? "white" : "none"} /></button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        <p className="text-[var(--foreground)] font-bold uppercase tracking-tight text-sm italic">{modalMessage}</p>
      </Modal>
    </AppShell>
  );
}
