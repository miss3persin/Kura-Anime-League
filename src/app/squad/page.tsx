"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client"; // Still needed for session
import {
    Loader2, Shield, CheckCircle, AlertCircle, RefreshCw, Plus, Info
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getHistoryChange } from "@/lib/hype";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import { useSeasonTimeline } from "@/lib/hooks/useSeasonTimeline";

// Import new components and API types
import { SquadHeader } from "@/components/squad/SquadHeader";
import { AnimeSquadRoster } from "@/components/squad/AnimeSquadRoster";
import { CharacterSquadRoster } from "@/components/squad/CharacterSquadRoster";
import { type SquadData, type SquadAnimePick, type SquadCharacterPick } from "@/app/api/squad/route"; // SquadData from new API

type Status = "loading" | "error" | "success" | "no_squad";

type SquadApiResponse =
    | SquadData
    | {
        squadData: null;
        code?: "NO_ACTIVE_SEASON" | "NO_TEAM";
        message?: string;
    };

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export default function SquadPage() {
    const router = useRouter();
    const [status, setStatus] = useState<Status>("loading");
    const [squadData, setSquadData] = useState<SquadData | null>(null);
    const [upcomingSquad, setUpcomingSquad] = useState<SquadData | null>(null);
    const [selectedSeason, setSelectedSeason] = useState<'active' | 'upcoming'>('active');
    const [seasonMessages, setSeasonMessages] = useState<{ active?: string; upcoming?: string }>({});
    const [user, setUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

    // Transfer mode states
    const [transferMode, setTransferMode] = useState(false);
    const [transferType, setTransferType] = useState<'anime' | 'character'>('anime');
    const [transferOutAnime, setTransferOutAnime] = useState<SquadAnimePick | null>(null);
    const [transferOutCharacter, setTransferOutCharacter] = useState<{ pickType: 'STAR_CHAR' | 'WAIFU_HUSBANDO'; character: SquadCharacterPick | null } | null>(null);
    const [marketAnime, setMarketAnime] = useState<SquadAnimePick[]>([]); // For available anime to pick
    const [marketCharacters, setMarketCharacters] = useState<SquadCharacterPick[]>([]);
    const [isFetchingMarket, setIsFetchingMarket] = useState(false);
    const { seasonInfo, loading: seasonLoading } = useSeasonTimeline();
    const activeSeasonId = seasonInfo?.activeSeason?.id != null ? String(seasonInfo.activeSeason.id) : null;
    const upcomingSeasonId = seasonInfo?.upcomingSeason?.id != null ? String(seasonInfo.upcomingSeason.id) : null;


    const fetchSquadData = useCallback(async (userId: string, seasonId?: string | null, bucket: 'active' | 'upcoming' = 'active') => {
        setStatus("loading");
        try {
            const qs = new URLSearchParams({ userId });
            if (seasonId) qs.append('seasonId', seasonId);
            const response = await fetch(`/api/squad?${qs.toString()}`);
            if (!response.ok) {
                const errorBody = await response.json();
                console.error("Squad API Error:", errorBody);
                throw new Error(`Failed to fetch squad data: ${errorBody.details || response.statusText}`);
            }
            const data = await response.json() as SquadApiResponse;

            if ('squadData' in data && data.squadData === null) {
                const emptyStateMessage = data.code === 'NO_ACTIVE_SEASON'
                    ? 'There is no active season right now.'
                    : 'You have not created a team for this season yet.';
                setSeasonMessages(prev => (bucket === 'upcoming'
                    ? { ...prev, upcoming: data.message || emptyStateMessage }
                    : { ...prev, active: data.message || emptyStateMessage }));
                setStatus("success"); // keep UI interactive for season toggle
            } else {
                if (bucket === 'upcoming') {
                    setUpcomingSquad(data as SquadData);
                } else {
                    setSquadData(data as SquadData);
                }
                setStatus("success");
            }
        } catch (error: unknown) {
            console.error("Error fetching squad:", error);
            setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to load squad.') });
            setStatus("error");
        }
    }, []);

    // Initial load and session check
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setStatus("error"); // No user, cannot load squad
                return;
            }
            setUser(session.user);

        };
        init();
    }, [fetchSquadData]);

    useEffect(() => {
        if (!seasonInfo) return;
        if (seasonInfo.phase === 'draft_open' && upcomingSeasonId) {
            setSelectedSeason('upcoming');
        } else if (activeSeasonId) {
            setSelectedSeason('active');
        }
    }, [seasonInfo, activeSeasonId, upcomingSeasonId]);

    useEffect(() => {
        if (!user || seasonLoading) return;
        if (activeSeasonId && !squadData) {
            void fetchSquadData(user.id, activeSeasonId, 'active');
        }
        if (upcomingSeasonId && upcomingSeasonId !== activeSeasonId && !upcomingSquad) {
            void fetchSquadData(user.id, upcomingSeasonId, 'upcoming');
        }
    }, [user, seasonLoading, activeSeasonId, upcomingSeasonId, squadData, upcomingSquad, fetchSquadData]);

    // Fetch missing view when user toggles
    useEffect(() => {
        if (!user) return;
        if (selectedSeason === 'upcoming' && !upcomingSquad && upcomingSeasonId) {
            void fetchSquadData(user.id, upcomingSeasonId, 'upcoming');
        }
        if (selectedSeason === 'active' && !squadData && activeSeasonId) {
            void fetchSquadData(user.id, activeSeasonId, 'active');
        }
    }, [selectedSeason, user, upcomingSquad, squadData, upcomingSeasonId, activeSeasonId, fetchSquadData]);

    const handleAssignRole = useCallback(async (
        animeId: number | null,
        role: 'captain' | 'vice_captain' | 'clear_captain' | 'clear_vice_captain'
    ) => {
        const activeData = selectedSeason === 'active' ? squadData : upcomingSquad;
        if (!user || !activeData) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/squad/assign-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: activeData.team_id, animeId, role, userId: user.id }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.details || errorBody.error || 'Failed to assign role.');
            }

            // Refetch squad data to update UI
            await fetchSquadData(
                user.id,
                selectedSeason === 'active' ? activeSeasonId ?? undefined : upcomingSeasonId ?? undefined,
                selectedSeason
            );
            setMessage({ type: 'success', text: 'Role updated successfully!' });
        } catch (error: unknown) {
            console.error("Assign role error:", error);
            setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to update role.') });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    }, [user, squadData, upcomingSquad, selectedSeason, activeSeasonId, upcomingSeasonId, fetchSquadData]);

    const handleTransfer = useCallback(async (animeIn: SquadAnimePick) => {
        const activeData = selectedSeason === 'active' ? squadData : upcomingSquad;
        if (!user || !activeData || !transferOutAnime) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/squad/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId: activeData.team_id,
                    userId: user.id,
                    animeOutId: transferOutAnime.id,
                    animeInId: animeIn.id,
                    currentWeekNumber: activeData.current_week_number,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.details || errorBody.error || 'Transfer failed.');
            }

            // Refetch squad data to update UI
            await fetchSquadData(
                user.id,
                selectedSeason === 'active' ? activeSeasonId ?? undefined : upcomingSeasonId ?? undefined,
                selectedSeason
            );
            setMessage({ type: 'success', text: 'Transfer completed successfully!' });
            setTransferMode(false);
            setTransferOutAnime(null);
        } catch (error: unknown) {
            console.error("Transfer error:", error);
            setMessage({ type: 'error', text: getErrorMessage(error, 'Transfer failed.') });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 4000);
        }
    }, [user, squadData, upcomingSquad, selectedSeason, activeSeasonId, upcomingSeasonId, transferOutAnime, fetchSquadData]);

    const handleCharacterTransfer = useCallback(async (characterIn: SquadCharacterPick) => {
        const activeData = selectedSeason === 'active' ? squadData : upcomingSquad;
        if (!user || !activeData || !transferOutCharacter || !transferOutCharacter.character) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/squad/transfer-character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId: activeData.team_id,
                    userId: user.id,
                    characterOutId: transferOutCharacter.character?.id,
                    characterInId: characterIn.id,
                    pickType: transferOutCharacter.pickType,
                    currentWeekNumber: activeData.current_week_number,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.details || errorBody.error || 'Transfer failed.');
            }

            await fetchSquadData(
                user.id,
                selectedSeason === 'active' ? activeSeasonId ?? undefined : upcomingSeasonId ?? undefined,
                selectedSeason
            );
            setMessage({ type: 'success', text: 'Character transfer completed successfully!' });
            setTransferMode(false);
            setTransferOutCharacter(null);
        } catch (error: unknown) {
            console.error("Transfer error:", error);
            setMessage({ type: 'error', text: getErrorMessage(error, 'Transfer failed.') });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 4000);
        }
    }, [user, squadData, upcomingSquad, selectedSeason, activeSeasonId, upcomingSeasonId, transferOutCharacter, fetchSquadData]);

    // Fetch market anime when entering transfer mode
    useEffect(() => {
        const activeData = selectedSeason === 'active' ? squadData : upcomingSquad;
        if (transferMode && transferType === 'anime' && marketAnime.length === 0 && !isFetchingMarket) {
            const fetchMarket = async () => {
                setIsFetchingMarket(true);
                try {
                    const response = await fetch('/api/market?sort=change&direction=desc&limit=250', {
                        cache: 'no-store'
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload.error || 'Failed to load market.');
                    }

                    const existingAnimeIds = activeData?.anime_picks.map(p => p.id) || [];
                    const filteredMarket = ((payload.items as SquadAnimePick[] | undefined) || [])
                        .filter(anime => !existingAnimeIds.includes(anime.id))
                        .map(anime => ({
                            ...anime,
                            is_captain: false, // Market anime can't be captain/vc
                            is_vice_captain: false,
                        })) as SquadAnimePick[];
                    setMarketAnime(filteredMarket);
                } catch (error: unknown) {
                    console.error("Failed to fetch market anime:", error);
                    setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to load transfer market.') });
                } finally {
                    setIsFetchingMarket(false);
                }
            };
            fetchMarket();
        } else if (!transferMode && marketAnime.length > 0) {
            setMarketAnime([]); // Clear market when exiting transfer mode
        }
    }, [transferMode, transferType, selectedSeason, squadData, upcomingSquad, squadData?.anime_picks, upcomingSquad?.anime_picks, isFetchingMarket, marketAnime.length]);

    useEffect(() => {
        const activeData = selectedSeason === 'active' ? squadData : upcomingSquad;
        const seasonId = selectedSeason === 'active' ? activeSeasonId : upcomingSeasonId;
        if (transferMode && transferType === 'character' && marketCharacters.length === 0 && !isFetchingMarket) {
            const fetchMarket = async () => {
                setIsFetchingMarket(true);
                try {
                    const qs = seasonId ? `?seasonId=${seasonId}` : '';
                    const response = await fetch(`/api/squad/character-market${qs}`, { cache: 'no-store' });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload.error || 'Failed to load character market.');
                    }

                    const existingIds = activeData?.character_picks.map(c => c.id) || [];
                    const filtered = ((payload.items as SquadCharacterPick[] | undefined) || [])
                        .filter(ch => !existingIds.includes(ch.id));
                    setMarketCharacters(filtered);
                } catch (error: unknown) {
                    console.error("Failed to fetch character market:", error);
                    setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to load character market.') });
                } finally {
                    setIsFetchingMarket(false);
                }
            };
            fetchMarket();
        } else if (!transferMode && marketCharacters.length > 0) {
            setMarketCharacters([]);
        }
    }, [transferMode, transferType, marketCharacters.length, isFetchingMarket, squadData, upcomingSquad, squadData?.character_picks, upcomingSquad?.character_picks, selectedSeason, activeSeasonId, upcomingSeasonId]);

    useEffect(() => {
        setTransferMode(false);
        setTransferOutAnime(null);
        setTransferOutCharacter(null);
        setMarketAnime([]);
        setMarketCharacters([]);
    }, [selectedSeason]);

    const activeView = selectedSeason === 'active' ? squadData : upcomingSquad;

    const renderContent = () => {
        switch (status) {
            case "loading":
                return (
                    <div className="flex items-center justify-center py-64">
                        <Loader2 className="animate-spin text-accent" size={48} />
                    </div>
                );
            case "error":
                return (
                    <div className="flex flex-col items-center justify-center py-48 space-y-8 bg-[var(--surface)] rounded-[3rem] border border-dashed border-[var(--border)] p-12 text-center shadow-xl">
                        <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center text-accent ring-4 ring-accent/10">
                            <Shield size={40} />
                        </div>
                        <div className="space-y-4 max-w-md">
                            <h3 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Error Loading Squad</h3>
                            <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                                {user ? (message?.text || 'There was an issue loading your squad data. Please try again.') : 'You must be authenticated to manage your tactical lineup.'}
                            </p>
                        </div>
                        {!user && (
                            <button onClick={() => router.push('/login')} className="px-10 py-5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl">
                                Log In to Manage Squad
                            </button>
                        )}
                    </div>
                );
            case "no_squad": // Handle no active season or no squad
                return (
                    <div className="flex flex-col items-center justify-center py-48 space-y-8 bg-[var(--surface)] rounded-[3rem] border border-dashed border-[var(--border)] p-12 text-center shadow-xl">
                        <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center text-accent ring-4 ring-accent/10">
                            <Shield size={40} />
                        </div>
                        <div className="space-y-4 max-w-md">
                            <h3 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">No Team Yet</h3>
                            <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                                {message?.text || 'You have not created a team for the current season yet.'}
                            </p>
                        </div>
                        <button onClick={() => router.push('/draft')} className="px-10 py-5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl">
                                Go to Draft
                            </button>
                    </div>
                );
            case "success":
                return (
                    <div className="space-y-6 md:space-y-10">
                        {/* Season Switcher */}
                        <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedSeason('active')}
                              className={cn("px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                selectedSeason === 'active' ? 'bg-accent text-white border-accent' : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]')}
                            >
                              Active Season
                            </button>
                            <button
                              onClick={() => setSelectedSeason('upcoming')}
                              className={cn("px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                selectedSeason === 'upcoming' ? 'bg-accent text-white border-accent' : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]')}
                            >
                              Upcoming Draft
                            </button>
                        </div>

                        {/* Header HUD */}
                        {activeView ? (
                            <SquadHeader squadData={activeView} />
                        ) : (
                            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-[2rem] p-6 md:p-8 text-center space-y-3">
                                <Shield className="mx-auto text-[var(--muted)]" size={32} />
                                <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                                    {selectedSeason === 'active'
                                        ? (seasonMessages.active || 'No team found for the active season.')
                                        : (seasonMessages.upcoming || 'No team found for the upcoming draft.')}
                                </p>
                                <button onClick={() => router.push('/draft')} className="px-6 py-3 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em]">
                                    Go to Draft
                                </button>
                            </div>
                        )}

                        {(activeView?.locked_anime_at || activeView?.locked_characters_at || activeView?.locked_at) && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
                                <div className="flex items-center gap-2">
                                    <Shield size={14} />
                                    <span>Locks active. Transfers needed for changes.</span>
                                </div>
                                <div className="flex flex-wrap gap-3 text-[8px] md:text-[9px] text-yellow-200">
                                    {activeView?.locked_anime_at && <span>Anime locked: {new Date(activeView.locked_anime_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                                    {activeView?.locked_characters_at && <span>Characters locked: {new Date(activeView.locked_characters_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                                    {!activeView?.locked_anime_at && !activeView?.locked_characters_at && activeView?.locked_at && <span>Locked: {new Date(activeView.locked_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                                </div>
                            </motion.div>
                        )}

                        {message && message.type !== 'info' && ( // Only show error/success messages here
                            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={cn(
                                "p-4 rounded-xl border text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-3",
                                message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                'bg-red-500/10 border-red-500/20 text-red-500' // Error message
                            )}>
                                {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {message.text}
                            </motion.div>
                        )}

                        {activeView && (
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-10">
                            <div className="xl:col-span-2 space-y-8 md:space-y-10">
                                {/* Anime Lineup */}
                                {activeView && (
                                    <>
                                      <AnimeSquadRoster
                                          animePicks={activeView.anime_picks}
                                          onAssignRole={handleAssignRole}
                                          transferMode={transferMode && transferType === 'anime'}
                                          onSelectForTransfer={(animeId) => {
                                              if (transferType !== 'anime') return;
                                              const selected = activeView.anime_picks.find(a => a.id === animeId);
                                              setTransferOutAnime(selected || null);
                                          }}
                                          transferOut={transferOutAnime}
                                          isSaving={isSaving}
                                      />

                                      {/* Character Recruits */}
                                      <CharacterSquadRoster
                                        characterPicks={activeView.character_picks}
                                        transferMode={transferMode && transferType === 'character'}
                                        selectedPickType={transferOutCharacter?.pickType ?? null}
                                        onSelectForTransfer={(pickType, characterId) => {
                                          if (transferType !== 'character') return;
                                          const character = activeView.character_picks.find(c => c.id === characterId) || null;
                                          setTransferOutCharacter({ pickType, character });
                                        }}
                                      />
                                    </>
                                )}
                            </div>

                            {/* Sidebar - Market */}
                            <div className="space-y-4 md:space-y-6">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">
                                        {transferMode ? (transferType === 'anime' ? 'Market Selection' : 'Character Market') : 'Squad Actions'}
                                    </h3>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        onClick={() => {
                                            setTransferMode(!transferMode);
                                            if (transferMode) {
                                                setTransferOutAnime(null);
                                                setTransferOutCharacter(null);
                                            }
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                            transferMode ? 'bg-yellow-500 text-black' : 'bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)]'
                                        )}
                                        disabled={isSaving}
                                    >
                                        <RefreshCw size={14} />
                                        {transferMode ? 'Exit Transfer' : 'Initiate Transfer'}
                                    </motion.button>
                                </div>

                                {transferMode && transferType === 'anime' && transferOutAnime && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-blue-500/10 border border-blue-500/20 text-blue-500 p-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <Info size={14} />
                                        Replacing: {transferOutAnime.title_english || transferOutAnime.title_romaji}
                                    </motion.div>
                                )}
                                {transferMode && transferType === 'character' && transferOutCharacter && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-pink-500/10 border border-pink-500/20 text-pink-400 p-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <Info size={14} />
                                        Replacing: {transferOutCharacter.character?.name || 'Character'} ({transferOutCharacter.pickType === 'STAR_CHAR' ? 'Featured' : 'Character'})
                                    </motion.div>
                                )}

                                {transferMode && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setTransferType('anime'); setTransferOutCharacter(null); }}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                                transferType === 'anime' ? 'bg-accent text-white border-accent' : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]'
                                            )}
                                        >
                                            Shows
                                        </button>
                                        <button
                                            onClick={() => { setTransferType('character'); setTransferOutAnime(null); }}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                                transferType === 'character' ? 'bg-accent text-white border-accent' : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]'
                                            )}
                                        >
                                            Characters
                                        </button>
                                    </div>
                                )}

                                {/* Market List for Transfers */}
                                {transferMode && isFetchingMarket && (
                                    <div className="flex items-center justify-center py-10 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                                        <Loader2 className="animate-spin text-accent" size={24} />
                                    </div>
                                )}
                                {transferMode && !isFetchingMarket && transferType === 'anime' && (
                                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-[2rem] overflow-hidden shadow-xl p-4 md:p-6 space-y-4 h-80 overflow-y-auto">
                                        {marketAnime.length > 0 ? (
                                            marketAnime.map((anime) => {
                                                const change = getHistoryChange(anime.hype_history, 1000 * 60 * 60 * 24, anime.cost_kp);
                                                const isPositiveChange = change.percent >= 0;

                                                return (
                                                    <motion.button
                                                        key={anime.id}
                                                        whileHover={{ x: 5 }}
                                                        onClick={() => handleTransfer(anime)}
                                                        disabled={isSaving}
                                                        className="flex items-center justify-between gap-3 w-full p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                                            <img
                                                                src={anime.cover_image}
                                                                className="w-8 h-12 md:w-10 md:h-14 object-cover rounded-lg shadow-lg shrink-0"
                                                                alt="thumb"
                                                            />
                                                            <div className="min-w-0 text-left">
                                                                <p className="text-[9px] md:text-[10px] font-black uppercase truncate w-24 md:w-32 text-[var(--foreground)]">{anime.title_english || anime.title_romaji}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-[7px] font-bold text-[var(--muted)] uppercase tracking-widest">{anime.cost_kp.toLocaleString()} KP</p>
                                                                    <p className={cn(
                                                                        "text-[7px] font-black uppercase tracking-widest",
                                                                        isPositiveChange ? 'text-green-500' : 'text-red-500'
                                                                    )}>
                                                                        {isPositiveChange ? '+' : '-'}{Math.abs(change.percent).toFixed(2)}%
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Plus size={18} className="text-green-500 shrink-0" />
                                                    </motion.button>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center text-[var(--muted)] text-sm py-8">No anime available for transfer.</div>
                                        )}
                                        <button onClick={() => router.push('/hype')} className="w-full py-3 md:py-4 bg-[var(--background)] hover:bg-accent hover:text-white text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--muted)] transition-all rounded-lg mt-2 md:mt-4">View All Shows</button>
                                    </div>
                                )}

                                {transferMode && !isFetchingMarket && transferType === 'character' && (
                                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-[2rem] overflow-hidden shadow-xl p-4 md:p-6 space-y-4 h-80 overflow-y-auto">
                                        {marketCharacters.length > 0 ? (
                                            marketCharacters.map((ch) => (
                                                <motion.button
                                                    key={ch.id}
                                                    whileHover={{ x: 5 }}
                                                    onClick={() => handleCharacterTransfer(ch)}
                                                    disabled={isSaving || !transferOutCharacter}
                                                    className="flex items-center justify-between gap-3 w-full p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                                        <img
                                                            src={ch.image}
                                                            className="w-8 h-12 md:w-10 md:h-14 object-cover rounded-lg shadow-lg shrink-0"
                                                            alt="thumb"
                                                        />
                                                        <div className="min-w-0 text-left">
                                                            <p className="text-[9px] md:text-[10px] font-black uppercase truncate w-24 md:w-32 text-[var(--foreground)]">{ch.name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[7px] font-bold text-[var(--muted)] uppercase tracking-widest">{typeof ch.price === "number" ? ch.price.toLocaleString() : "--"} KP</p>
                                                                <p className="text-[7px] font-bold text-pink-500 uppercase tracking-widest">{ch.role}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Plus size={18} className="text-pink-400 shrink-0" />
                                                </motion.button>
                                            ))
                                        ) : (
                                            <div className="text-center text-[var(--muted)] text-sm py-8">No characters available for transfer.</div>
                                        )}
                                        <button onClick={() => router.push('/draft')} className="w-full py-3 md:py-4 bg-[var(--background)] hover:bg-accent hover:text-white text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--muted)] transition-all rounded-lg mt-2 md:mt-4">Go to Draft</button>
                                    </div>
                                )}

                                {/* Default state when not in transfer mode (e.g., info about current week or next draft) */}
                                {!transferMode && (
                                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-[2rem] overflow-hidden shadow-xl p-4 md:p-6 space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Team Management</h4>
                                        <p className="text-sm text-[var(--foreground)]">
                                            Set your Captain and Vice-Captain roles, or start a transfer to replace a show.
                                        </p>
                                        <button onClick={() => router.push('/draft')} className="w-full py-3 md:py-4 bg-[var(--background)] hover:bg-accent hover:text-white text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--muted)] transition-all rounded-lg mt-2 md:mt-4">Go to Draft</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        )}
                    </div>
                );
        }
    };

    return <AppShell>{renderContent()}</AppShell>;
}
