"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { NeonButton } from "@/components/ui/neon-button";
import {
  Zap, CheckCircle,
  Loader2, Search, RefreshCw,
  Shield, Heart, LayoutGrid, Star, Info
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
  is_eligible: boolean;
}

interface Character {
  id: number;
  name: string;
  image: string;
  anime_id: number;
  gender?: string;
  role: string;
  price: number;
  favorites: number;
  about?: string;
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
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  
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
        month: "short", day: "numeric", hour: "numeric", minute: "numeric"
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

  const fetchCharacters = useCallback(async (animeIds?: number[]) => {
    let query = supabase
      .from('character_cache')
      .select('*')
      .in('gender', ['Male', 'Female']);

    if (animeIds && animeIds.length > 0) {
      query = query.in('anime_id', animeIds);
    }

    const { data } = await query
      .order('favorites', { ascending: false })
      .limit(50);
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
        const [animeForSeason, upcomingAnime] = await Promise.all([
          fetchAnimeBySeason(
            activeSeasonId ?? upcomingSeasonId,
            activeSeasonName ?? upcomingSeasonName
          ).catch((e) => { console.error("Anime fetch error:", e); return []; }),
          upcomingSeasonId || upcomingSeasonName
            ? fetchAnimeBySeason(upcomingSeasonId, upcomingSeasonName).catch((e) => { console.error("Upcoming anime fetch error:", e); return []; })
            : Promise.resolve([]),
        ]);

        const animeIds = animeForSeason.map(a => a.id);
        const characters = await fetchCharacters(animeIds).catch((e) => { console.error("Character fetch error:", e); return []; });

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

      const targetId = (seasonInfo.draftSeason?.id ?? seasonInfo.activeSeason?.id ?? seasonInfo.upcomingSeason?.id) as string | number | null;
      const targetName = seasonInfo.draftSeason?.name ?? seasonInfo.activeSeason?.name ?? seasonInfo.upcomingSeason?.name;

      await refreshSeasonData({
        activeSeasonId: targetId,
        activeSeasonName: targetName,
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
        showAlert("Sync Complete", `Archived data synchronized.`);
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
      setBudget(prev => prev + anime.cost_kp);
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
      setBudget(prev => prev - anime.cost_kp);
    }
  };

  const toggleSelectCharacter = (char: Character, type: 'star' | 'waifu') => {
    if (type === 'star') {
      if (starCharId === char.id) {
        setStarCharId(null);
        setBudget(prev => prev + char.price);
      } else {
        if (budget < char.price) {
          showAlert("Insufficient KP", "Not enough KuraPoints to recruit this star.");
          return;
        }
        if (starCharId) {
          const oldChar = characterList.find(c => c.id === starCharId);
          setBudget(prev => prev + (oldChar?.price || 0) - char.price);
        } else {
          setBudget(prev => prev - char.price);
        }
        setStarCharId(char.id);
      }
    } else {
      if (waifuId === char.id) {
        setWaifuId(null);
        setBudget(prev => prev + char.price);
      } else {
        if (budget < char.price) {
          showAlert("Insufficient KP", "Not enough KuraPoints for this waifu/husbando.");
          return;
        }
        if (waifuId) {
          const oldChar = characterList.find(c => c.id === waifuId);
          setBudget(prev => prev + (oldChar?.price || 0) - char.price);
        } else {
          setBudget(prev => prev - char.price);
        }
        setWaifuId(char.id);
      }
    }
  };

  const handleSaveTeam = async () => {
    if (!user) {
      showAlert("Login Required", "Please log in to save your team.");
      return;
    }
    if (selectedAnimeIds.length === 0) {
      showAlert("Draft Picks Needed", "Select at least one series before locking.");
      return;
    }

    setSaving(true);
    try {
      const currentSeasonId = seasonInfo?.draftSeason?.id ?? seasonInfo?.activeSeason?.id;
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
      const castedTeamId = teamData.id;

      await supabase.from('team_picks').delete().eq('team_id', castedTeamId);
      const picks = selectedAnimeIds.map(id => ({ team_id: castedTeamId, anime_id: id }));
      await supabase.from('team_picks').insert(picks);

      await supabase.from('character_picks').delete().eq('team_id', castedTeamId);
      const charPicks = [];
      if (starCharId) charPicks.push({ team_id: castedTeamId, character_id: starCharId, pick_type: 'STAR_CHAR' });
      if (waifuId) charPicks.push({ team_id: castedTeamId, character_id: waifuId, pick_type: 'WAIFU_HUSBANDO' });
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
    a.is_eligible && (
    a.title_romaji.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.title_english?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCharacters = characterList.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-10">
        {/* Header HUD */}
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
                  {seasonDisplayName} <span className="mx-3 opacity-30">|</span> 20,000 KP Draft Budget
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
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Available Points</p>
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

        {/* Search & Tabs HUD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
          <div className="flex gap-2 p-1.5 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm">
            <button onClick={() => setActiveTab('anime')} className={getTabButtonClass('anime')}>Anime Series</button>
            <button onClick={() => setActiveTab('characters')} className={getTabButtonClass('characters')}>Star Recruits</button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
              <input
                type="text"
                placeholder={`Search ${activeTab === 'anime' ? 'Series' : 'Recruits'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-2xl pl-12 pr-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-accent/40 focus:bg-accent/5 transition-all w-full md:w-64"
              />
            </div>
            <button onClick={handleSync} disabled={syncing} className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-[var(--muted)] hover:text-[var(--foreground)] transition-all cursor-pointer shadow-sm">
              <RefreshCw className={syncing ? 'animate-spin' : ''} size={20} />
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
                    <img src={anime.cover_image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 brightness-[0.85] group-hover:brightness-100" alt={`${anime.title_english || anime.title_romaji} cover`} />
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
                      <h3 className="text-sm font-black uppercase tracking-tight text-[var(--foreground)] truncate italic leading-tight">
                        {anime.title_english || anime.title_romaji}
                      </h3>
                      <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest truncate opacity-60">
                        {anime.title_english ? anime.title_romaji : (anime.format + ' • ' + (anime.genres?.[0] || 'Original'))}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-[10px] font-black text-[var(--foreground)]">{anime.average_score || '??'}%</span>
                      </div>
                      <button onClick={() => toggleSelectAnime(anime)} disabled={draftClosed} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-[var(--background)] text-[var(--muted)]' : 'bg-accent text-white'}`}>
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
              const isSelected = isStar || isWaifu;
              return (
                <motion.div
                  layout
                  key={char.id}
                  whileHover={{ y: -8 }}
                  className={`group relative bg-[var(--surface)] border rounded-[2rem] overflow-hidden transition-all shadow-xl ${isSelected ? 'border-accent ring-4 ring-accent/10 bg-accent/5' : 'border-[var(--border)]'}`}
                >
                  <div className="aspect-[3/4] overflow-hidden relative cursor-pointer" onClick={() => setSelectedCharacter(char)}>
                    <img src={char.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={`${char.name} profile`} />
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                      <p className="text-[10px] font-black text-white italic">{char.price.toLocaleString()} KP</p>
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 bg-accent/20 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="w-14 h-14 bg-accent text-white rounded-full flex items-center justify-center shadow-2xl">
                          {isStar ? <Star size={32} /> : <Heart size={32} />}
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-4 right-4">
                      <button className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/60 hover:text-white transition-colors">
                        <Info size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4 text-center">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-tight text-[var(--foreground)] italic truncate leading-tight">{char.name}</h3>
                      <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest opacity-60">
                        {char.role} <span className="mx-1">•</span> {char.favorites.toLocaleString()} Faves
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => toggleSelectCharacter(char, 'star')} disabled={draftClosed} className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${isStar ? 'bg-yellow-500 text-black' : 'bg-[var(--surface-hover)] text-[var(--muted)]'}`}>
                        Recruit
                      </button>
                      <button onClick={() => toggleSelectCharacter(char, 'waifu')} disabled={draftClosed} className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${isWaifu ? 'bg-pink-500 text-white' : 'bg-[var(--surface-hover)] text-[var(--muted)]'}`}>
                        {char.role === 'Waifu' ? 'Waifu' : char.role === 'Husbando' ? 'Husbando' : 'Select'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Fixed Summary HUD */}
        <AnimatePresence>
          {selectedAnimeIds.length > 0 && (
            <motion.div 
              initial={{ y: 100 }} 
              animate={{ y: 0 }} 
              exit={{ y: 100 }} 
              className="fixed bottom-10 left-0 right-0 md:left-72 z-50 px-6 pointer-events-none flex justify-center"
            >
              <div className="bg-black/80 backdrop-blur-2xl border-2 border-white/10 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden w-full max-w-4xl pointer-events-auto">
                <div className="flex items-center gap-6 relative z-10">
                  <div className="flex -space-x-4">
                    {selectedAnimeIds.slice(0, 5).map((id) => {
                      const anime = animeList.find(a => a.id === id);
                      return (
                        <div key={id} className="w-14 h-14 rounded-2xl border-4 border-black bg-[var(--surface)] overflow-hidden shadow-xl">
                          <img src={anime?.cover_image} className="w-full h-full object-cover" alt="pick" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Your Team</p>
                    <p className="text-xl font-black italic text-white uppercase tracking-tighter">{selectedAnimeIds.length}/5 Selected</p>
                  </div>
                </div>
                <button onClick={handleSaveTeam} disabled={saving || draftClosed} className="px-10 py-4 bg-accent text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl flex items-center gap-3">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                  {saving ? 'SAVING CHANGES...' : 'CONFIRM TEAM'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        <p className="text-[var(--foreground)] font-bold uppercase tracking-tight text-sm italic">{modalMessage}</p>
      </Modal>

      <Modal 
        isOpen={!!selectedCharacter} 
        onClose={() => setSelectedCharacter(null)} 
        title={selectedCharacter?.name || ""}
        maxWidth="max-w-3xl"
      >
        <div className="flex flex-col md:flex-row gap-10 items-start">
          <div className="w-full md:w-56 aspect-[3/4.5] rounded-3xl overflow-hidden border-4 border-black shadow-2xl flex-shrink-0">
            <img src={selectedCharacter?.image} className="w-full h-full object-cover" alt={selectedCharacter?.name} />
          </div>
          <div className="flex-grow space-y-6">
            <div className="flex flex-wrap gap-2">
              <span className="bg-accent/10 text-accent border border-accent/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedCharacter?.role}</span>
              <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedCharacter?.favorites.toLocaleString()} Faves</span>
              <span className="bg-white/5 text-[var(--muted)] border border-white/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedCharacter?.gender}</span>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Character Bio</p>
              <div className="text-xs leading-relaxed text-[var(--muted)] font-medium max-h-48 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-accent/20">
                {selectedCharacter?.about 
                  ? selectedCharacter.about
                      .replace(/<[^>]*>/g, '') // Remove HTML
                      .replace(/__(.+?)__/g, '$1') // Bold __text__ -> text
                      .replace(/~(.+?)~/g, '$1') // Italic ~text~ -> text
                      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold **text** -> text
                      .replace(/\*(.+?)\*/g, '$1') // Italic *text* -> text
                      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
                      .replace(/\[.*?\]\(.*?\)/g, '$1') // Remove markdown links but keep text
                      .replace(/Height:.*?\n/gi, '') // Remove Height info
                      .replace(/Age:.*?\n/gi, '') // Remove Age info
                      .replace(/Weight:.*?\n/gi, '') // Remove Weight info
                      .replace(/Blood Type:.*?\n/gi, '') // Remove Blood info
                      .trim()
                      .slice(0, 800) + (selectedCharacter.about.length > 800 ? "..." : "")
                  : "No detailed bio available for this character. They are currently part of the seasonal lineup."
                }
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <p className="text-[8px] font-black uppercase text-[var(--muted)] mb-1">Recruitment Cost</p>
                <p className="text-xl font-black text-white italic tracking-tighter">{selectedCharacter?.price.toLocaleString()} KP</p>
              </div>
              <div className="flex items-end justify-end">
                <NeonButton onClick={() => setSelectedCharacter(null)} className="w-full py-3 text-[10px]">Close Intel</NeonButton>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
