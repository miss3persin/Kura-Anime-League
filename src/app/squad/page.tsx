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

// Import new components and API types
import { SquadHeader } from "@/components/squad/SquadHeader";
import { AnimeSquadRoster } from "@/components/squad/AnimeSquadRoster";
import { CharacterSquadRoster } from "@/components/squad/CharacterSquadRoster";
import { type SquadData, type SquadAnimePick } from "@/app/api/squad/route"; // SquadData from new API

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
    const [user, setUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

    // Transfer mode states
    const [transferMode, setTransferMode] = useState(false);
    const [transferOutAnime, setTransferOutAnime] = useState<SquadAnimePick | null>(null);
    const [marketAnime, setMarketAnime] = useState<SquadAnimePick[]>([]); // For available anime to pick
    const [isFetchingMarket, setIsFetchingMarket] = useState(false);


    const fetchSquadData = useCallback(async (userId: string) => {
        setStatus("loading");
        try {
            const response = await fetch(`/api/squad?userId=${userId}`);
            if (!response.ok) {
                const errorBody = await response.json();
                console.error("Squad API Error:", errorBody);
                throw new Error(`Failed to fetch squad data: ${errorBody.details || response.statusText}`);
            }
            const data = await response.json() as SquadApiResponse;

            if ('squadData' in data && data.squadData === null) {
                const emptyStateMessage = data.code === 'NO_ACTIVE_SEASON'
                    ? 'There is no active season right now.'
                    : 'You have not created a team for the current season yet.';
                setMessage({ type: 'info', text: data.message || emptyStateMessage });
                setStatus("no_squad");
            } else {
                setSquadData(data as SquadData);
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
            fetchSquadData(session.user.id);
        };
        init();
    }, [fetchSquadData]);

    const handleAssignRole = useCallback(async (
        animeId: number | null,
        role: 'captain' | 'vice_captain' | 'clear_captain' | 'clear_vice_captain'
    ) => {
        if (!user || !squadData) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/squad/assign-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: squadData.team_id, animeId, role, userId: user.id }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.details || errorBody.error || 'Failed to assign role.');
            }

            // Refetch squad data to update UI
            await fetchSquadData(user.id);
            setMessage({ type: 'success', text: 'Role updated successfully!' });
        } catch (error: unknown) {
            console.error("Assign role error:", error);
            setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to update role.') });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    }, [user, squadData, fetchSquadData]);

    const handleTransfer = useCallback(async (animeIn: SquadAnimePick) => {
        if (!user || !squadData || !transferOutAnime) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/squad/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId: squadData.team_id,
                    userId: user.id,
                    animeOutId: transferOutAnime.id,
                    animeInId: animeIn.id,
                    currentWeekNumber: squadData.current_week_number,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.details || errorBody.error || 'Transfer failed.');
            }

            // Refetch squad data to update UI
            await fetchSquadData(user.id);
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
    }, [user, squadData, transferOutAnime, fetchSquadData]);

    // Fetch market anime when entering transfer mode
    useEffect(() => {
        if (transferMode && !isFetchingMarket) {
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

                    const existingAnimeIds = squadData?.anime_picks.map(p => p.id) || [];
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
        } else if (!transferMode) {
            setMarketAnime([]); // Clear market when exiting transfer mode
        }
    }, [transferMode, squadData, isFetchingMarket]);

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
                // squadData is guaranteed to exist here
                return (
                    <div className="space-y-6 md:space-y-10">
                        {/* Header HUD */}
                        <SquadHeader squadData={squadData!} />

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

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-10">
                            <div className="xl:col-span-2 space-y-8 md:space-y-10">
                                {/* Anime Lineup */}
                                <AnimeSquadRoster
                                    animePicks={squadData!.anime_picks}
                                    onAssignRole={handleAssignRole}
                                    transferMode={transferMode}
                                    onSelectForTransfer={(animeId) => {
                                        const selected = squadData!.anime_picks.find(a => a.id === animeId);
                                        setTransferOutAnime(selected || null);
                                    }}
                                    transferOut={transferOutAnime}
                                    isSaving={isSaving}
                                />

                                {/* Character Recruits */}
                                <CharacterSquadRoster characterPicks={squadData!.character_picks} />
                            </div>

                            {/* Sidebar - Market */}
                            <div className="space-y-4 md:space-y-6">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">
                                        {transferMode ? 'Market Selection' : 'Squad Actions'}
                                    </h3>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        onClick={() => setTransferMode(!transferMode)}
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

                                {transferMode && transferOutAnime && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-blue-500/10 border border-blue-500/20 text-blue-500 p-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <Info size={14} />
                                        Replacing: {transferOutAnime.title_english || transferOutAnime.title_romaji}
                                    </motion.div>
                                )}

                                {/* Market List for Transfers */}
                                {transferMode && isFetchingMarket && (
                                    <div className="flex items-center justify-center py-10 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                                        <Loader2 className="animate-spin text-accent" size={24} />
                                    </div>
                                )}
                                {transferMode && !isFetchingMarket && (
                                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-[2rem] overflow-hidden shadow-xl p-4 md:p-6 space-y-4">
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
                                                            <img src={anime.cover_image} className="w-8 h-12 md:w-10 md:h-14 object-cover rounded-lg shadow-lg shrink-0" alt="thumb" />
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
                    </div>
                );
        }
    };

    return <AppShell>{renderContent()}</AppShell>;
}
