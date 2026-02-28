"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { NeonButton } from "@/components/ui/neon-button";
import {
  Zap, CheckCircle,
  Loader2, Search, RefreshCw,
  Shield, Heart, LayoutGrid, Star
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { useSeasonTimeline } from "@/lib/hooks/useSeasonTimeline";
import { useCountdown } from "@/components/ui/season-banner";
import type { SeasonInfoPayload } from "@/lib/hooks/useSeasonTimeline";
import { Modal } from "@/components/ui/modal";

interface Anime {
  id: number;
  title_romaji: string;
  title_english?: string;
  cover_image: string;
  banner_image?: string;
  cost_kp: number;
  average_score: number;
  hype_score: number;
  format?: string;
  genres?: string[];
}

interface Character {
  id: number;
  name: string;
  image: string;
  anime_id: number;
}

interface DraftUser {
  id: string;
  email?: string;
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
  const [user, setUser] = useState<DraftUser | null>(null);
  const [activeTab, setActiveTab] = useState<'anime' | 'characters'>('anime');
  const timeline = useSeasonTimeline();
  const seasonInfo = timeline.seasonInfo;
  const [draftClosed, setDraftClosed] = useState(false);
  const [previewAnime, setPreviewAnime] = useState<Anime[]>([]);
  const phaseBadgeLabel = seasonInfo?.phase
    ? seasonInfo.phase
        .split("_")
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ")
    : "Pre Draft";
  const seasonDisplayName = seasonInfo?.activeSeason?.name ?? seasonInfo?.upcomingSeason?.name ?? "Season";
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
    async (seasonIdentifier?: string | number | null, fallbackSeasonName?: string | null) => {
      let query = supabase.from('anime_cache').select('*');
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
      return (data as Anime[]) ?? [];
    },
    []
  );

  const fetchCharacters = useCallback(async () => {
    const { data } = await supabase
      .from('character_cache')
      .select('*')
      .order('name', { ascending: true });
    return (data as Character[]) ?? [];
  }, []);

  const refreshSeasonData = useCallback(
    async ({
      activeSeasonId,
      activeSeasonName,
      upcomingSeasonId,
      upcomingSeasonName
    }: {
      activeSeasonId?: string | number | null;
      activeSeasonName?: string | null;
      upcomingSeasonId?: string | number | null;
      upcomingSeasonName?: string | null;
    }) => {
      setLoading(true);
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
      }
    },
    [fetchAnimeBySeason, fetchCharacters]
  );

  useEffect(() => {
    const init = async () => {
      if (!seasonInfo) return;
      setDraftClosed(seasonInfo.phase !== 'draft_open');
      await refreshSeasonData({
        activeSeasonId: seasonInfo.activeSeason?.id as string | number | null,
        activeSeasonName: seasonInfo.activeSeason?.name,
        upcomingSeasonId: seasonInfo.upcomingSeason?.id as string | number | null,
        upcomingSeasonName: seasonInfo.upcomingSeason?.name
      });

      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: prof } = await supabase.from('profiles').select('total_kp').eq('id', session.user.id).single();
        if (prof) {
          setBudget(prof.total_kp);
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
          activeSeasonId: seasonInfo?.activeSeason?.id as string | number | null,
          activeSeasonName: seasonInfo?.activeSeason?.name,
          upcomingSeasonId: seasonInfo?.upcomingSeason?.id as string | number | null,
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

      const castedTeamData = teamData as { id: string };

      await supabase.from('team_picks').delete().eq('team_id', castedTeamData.id);
      const picks = selectedAnimeIds.map(id => ({
        team_id: castedTeamData.id,
        anime_id: id
      }));
      await supabase.from('team_picks').insert(picks);

      await supabase.from('character_picks').delete().eq('team_id', castedTeamData.id);
      const charPicks = [];
      if (starCharId) charPicks.push({ team_id: castedTeamData.id, character_id: starCharId, pick_type: 'STAR_CHAR' });
      if (waifuId) charPicks.push({ team_id: castedTeamData.id, character_id: waifuId, pick_type: 'WAIFU_HUSBANDO' });
      if (charPicks.length > 0) {
        await supabase.from('character_picks').insert(charPicks);
      }

      showAlert("Team Deployed", "Your tactical lineup has been synchronized with the league servers. 🏮");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(err);
      showAlert("System Error", message);
    } finally {
      setSaving(false);
    }
  };

  const filteredAnime = animeList.filter(a =>
    a.title_romaji.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.title_english?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCharacters = characterList.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-10">
        {/* Cinematic Header HUD */}
        <div className="relative overflow-hidden bg-[var(--surface)] border border-[var(--border)] rounded-[3.5rem] p-10 md:p-14 shadow-2xl">
          <div className="absolute top-0 right-0 p-16 opacity-[0.03] rotate-12 pointer-events-none">
            <LayoutGrid size={320} />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${phaseDotClasses}`} />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">{phaseBadgeLabel}</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] leading-none">
                  The Draft
                </h1>
                <p className="text-sm md:text-base text-[var(--muted)] font-bold uppercase tracking-[0.2em]">
                  {seasonDisplayName} <span className="mx-3 opacity-30">|</span> 20,000 KP Operational Budget
                </p>
              </div>
              <div className="flex flex-wrap gap-4 pt-4">
                <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl px-6 py-4 shadow-sm">
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)] mb-1">{deadlineLabel}</p>
                  <p className="text-sm font-black text-[var(--foreground)]">{deadlineValue}</p>
                </div>
                {hasCountdown && (
                  <div className="flex gap-2">
                    {countdownSegments.map((seg) => (
                      <div key={seg.label} className="w-14 h-14 rounded-2xl bg-accent/5 border border-accent/20 flex flex-col items-center justify-center shadow-lg">
                        <span className="text-lg font-black text-accent leading-none">{String(seg.value).padStart(2, '0')}</span>
                        <span className="text-[7px] font-black uppercase text-accent/60">{seg.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 min-w-[280px]">
              <div className="bg-[var(--background)] border border-[var(--border)] rounded-3xl p-8 space-y-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Zap size={40} className="text-accent" />
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Remaining Credits</p>
                  <p className={`text-4xl font-black italic tracking-tighter font-outfit transition-colors ${budgetTone}`}>
                    {budget.toLocaleString()} <span className="text-xs uppercase align-middle ml-1">KP</span>
                  </p>
                </div>
                <div className="w-full bg-[var(--surface-hover)] h-1.5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: `${(budget / 20000) * 100}%` }}
                    className="h-full bg-accent shadow-[0_0_15px_var(--accent)]"
                  />
                </div>
                <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest text-center opacity-60">
                  Transaction encryption active
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Phase Narrative Card */}
        <div className="bg-accent/5 border border-accent/20 rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 group hover:bg-accent/10 transition-all shadow-lg">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white shadow-2xl shadow-accent/40 rotate-3 group-hover:rotate-0 transition-transform">
              <Shield size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black uppercase italic tracking-tight text-[var(--foreground)]">{phaseBadgeLabel} Phase Active</h3>
              <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest max-w-lg leading-relaxed">
                {phaseAction.description}
              </p>
            </div>
          </div>
          <NeonButton onClick={() => router.push(phaseAction.href)} className="w-full md:w-auto px-10 py-4 shadow-xl">
            {phaseAction.label}
          </NeonButton>
        </div>

        {/* Search & Tabs HUD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
          <div className="flex gap-2 p-1.5 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm">
            <button
              onClick={() => setActiveTab('anime')}
              className={getTabButtonClass('anime')}
            >
              Anime Series
            </button>
            <button
              onClick={() => setActiveTab('characters')}
              className={getTabButtonClass('characters')}
            >
              Star Recruits
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] transition-colors group-focus-within:text-accent" size={16} />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-2xl pl-12 pr-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-accent/40 focus:bg-accent/5 transition-all w-full md:w-64 shadow-sm"
              />
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-[var(--muted)] hover:text-[var(--foreground)] hover:border-accent/20 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Refresh seasonal data"
            >
              <RefreshCw className={`transition-transform ${syncing ? 'animate-spin' : ''}`} size={20} />
            </button>
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 px-2">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-[var(--surface)] aspect-[3/4.5] rounded-3xl border border-[var(--border)] animate-pulse shadow-sm" />
            ))
          ) : activeTab === 'anime' ? (
            filteredAnime.map((anime) => {
              const isSelected = selectedAnimeIds.includes(anime.id);
              return (
                <motion.div
                  layout
                  key={anime.id}
                  whileHover={{ y: -8 }}
                  className={`group relative bg-[var(--surface)] border rounded-[2rem] overflow-hidden transition-all shadow-xl ${isSelected ? 'border-accent ring-4 ring-accent/10 bg-accent/5' : 'border-[var(--border)]'}`}
                >
                  <div className="aspect-[3/4] overflow-hidden relative">
                    <img src={anime.cover_image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 brightness-[0.85] group-hover:brightness-100" alt={`${anime.title_romaji} cover`} />
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                      <p className="text-[10px] font-black text-white italic">{anime.cost_kp.toLocaleString()} KP</p>
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 bg-accent/20 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="w-14 h-14 bg-accent text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20">
                          <CheckCircle size={32} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-tight text-[var(--foreground)] truncate group-hover:text-accent transition-colors italic leading-tight">
                        {anime.title_romaji}
                      </h3>
                      <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest truncate opacity-60">
                        {anime.format} <span className="mx-1">•</span> {anime.genres?.[0] || 'Original'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-[10px] font-black text-[var(--foreground)]">{anime.average_score || '??'}</span>
                      </div>
                      <button
                        onClick={() => toggleSelectAnime(anime)}
                        disabled={draftClosed}
                        className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isSelected ? 'bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]' : 'bg-accent text-white shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                      >
                        {isSelected ? 'Remove' : 'Draft'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            filteredCharacters.map((char) => {
              const isStar = starCharId === char.id;
              const isWaifu = waifuId === char.id;
              return (
                <motion.div
                  layout
                  key={char.id}
                  whileHover={{ y: -8 }}
                  className={`group relative bg-[var(--surface)] border rounded-[2rem] overflow-hidden transition-all shadow-xl ${isStar || isWaifu ? 'border-accent ring-4 ring-accent/10 bg-accent/5' : 'border-[var(--border)]'}`}
                >
                  <div className="aspect-square overflow-hidden relative">
                    <img src={char.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 brightness-[0.85] group-hover:brightness-100" alt={`${char.name} profile`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {(isStar || isWaifu) && (
                      <div className="absolute top-4 right-4 w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white/20">
                        {isStar ? <Star size={20} /> : <Heart size={20} />}
                      </div>
                    )}
                  </div>
                  <div className="p-6 space-y-4 text-center">
                    <h3 className="text-sm font-black uppercase tracking-tight text-[var(--foreground)] group-hover:text-accent transition-colors italic truncate leading-tight">
                      {char.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setStarCharId(isStar ? null : char.id)}
                        disabled={draftClosed}
                        className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${isStar ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-[var(--surface-hover)] text-[var(--muted)] hover:text-yellow-500 border border-transparent hover:border-yellow-500/20'}`}
                      >
                        Hero
                      </button>
                      <button
                        onClick={() => setWaifuId(isWaifu ? null : char.id)}
                        disabled={draftClosed}
                        className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${isWaifu ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'bg-[var(--surface-hover)] text-[var(--muted)] hover:text-pink-500 border border-transparent hover:border-pink-500/20'}`}
                      >
                        Waifu
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Selection Sidebar (Mobile) & Fixed Summary HUD */}
        <AnimatePresence>
          {selectedAnimeIds.length > 0 && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-4xl"
            >
              <div className="bg-black/80 backdrop-blur-2xl border-2 border-white/10 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent pointer-events-none" />

                <div className="flex items-center gap-6 relative z-10">
                  <div className="flex -space-x-4">
                    {selectedAnimeIds.slice(0, 5).map((id) => {
                      const anime = animeList.find(a => a.id === id);
                      return (
                        <div key={id} className="w-14 h-14 rounded-2xl border-4 border-black bg-[var(--surface)] overflow-hidden shadow-xl">
                          <img src={anime?.cover_image} className="w-full h-full object-cover" alt={`${anime?.title_romaji} thumbnail`} />
                        </div>
                      );
                    })}
                    {Array.from({ length: Math.max(0, 5 - selectedAnimeIds.length) }).map((_, i) => (
                      <div key={i} className="w-14 h-14 rounded-2xl border-4 border-black bg-[var(--surface-hover)] border-dashed border-[var(--muted)]/30 flex items-center justify-center text-[var(--muted)]/40 font-black text-xl">
                        +
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Active Roster</p>
                    <p className="text-xl font-black italic text-white uppercase tracking-tighter">{selectedAnimeIds.length}/5 Series Operational</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 relative z-10">
                  <div className="text-right hidden sm:block">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Projected Impact</p>
                    <p className="text-lg font-black text-white italic">{(20000 - budget).toLocaleString()} KP Allocated</p>
                  </div>
                  <button
                    onClick={handleSaveTeam}
                    disabled={saving || draftClosed}
                    className="px-10 py-4 bg-accent text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-accent/40 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                    {saving ? 'SYNCHRONIZING...' : 'LOCK LINEUP'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty Catalog State */}
        {!loading && filteredAnime.length === 0 && (
          <div className="text-center py-40 bg-[var(--surface)] rounded-[3rem] border border-[var(--border)] border-dashed">
            <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="text-accent opacity-40" size={40} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--foreground)]">No Archive Matches</h3>
            <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-widest mt-2">Adjust your search filters or refresh the seasonal feed</p>
            <button
              onClick={() => { setSearchQuery(""); handleSync(); }}
              className="mt-8 px-10 py-4 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--muted)] font-black text-[10px] uppercase tracking-widest rounded-2xl hover:text-accent hover:border-accent/40 transition-all cursor-pointer shadow-md"
            >
              Reset Terminal
            </button>
          </div>
        )}

        {/* Seasonal Preview HUD */}
        {previewAnime.length > 0 && (
          <div className="space-y-8 pt-10 border-t border-[var(--border)]">
            <div className="flex justify-between items-end px-2">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Scouting Report</p>
                <h2 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Upcoming Drops</h2>
              </div>
              <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.2em] mb-1">Pre-season Preview active</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 px-2 opacity-60">
              {previewAnime.map((anime) => (
                <div key={anime.id} className="group relative aspect-[3/4.5] rounded-2xl overflow-hidden border border-[var(--border)] grayscale hover:grayscale-0 transition-all shadow-sm">
                  <img src={anime.cover_image} className="w-full h-full object-cover" alt={`${anime.title_romaji} upcoming`} />
                  <div className="absolute inset-0 bg-black/40 group-hover:opacity-0 transition-opacity" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[8px] font-black uppercase text-white truncate drop-shadow-lg">{anime.title_romaji}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        <p className="text-[var(--foreground)] font-bold uppercase tracking-tight text-sm italic">{modalMessage}</p>
      </Modal>
    </AppShell>
  );
}
