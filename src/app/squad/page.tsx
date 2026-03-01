"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import {
    Crown, Zap, ArrowLeftRight, TrendingUp, TrendingDown,
    Loader2, Star, Heart, RefreshCw, Info, Plus, Shield, CheckCircle, AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Anime {
    id: number;
    title_romaji: string;
    title_english?: string;
    cover_image: string;
    cost_kp: number;
    average_score: number;
    hype_score: number;
    hype_change: number;
    genres: string[];
}

interface Character {
    id: number;
    name: string;
    image: string;
    role: string;
    gender: string;
    price: number;
    favorites: number;
}

interface Team {
    id: string;
    remaining_kp: number;
    captain_anime_id: number | null;
    vice_captain_anime_id: number | null;
    transfers_used: number;
    free_transfers: number;
    week_number: number;
}

interface User {
    id: string;
    email?: string;
}

interface SquadTeam extends Team {
    team_picks: { anime_id: number }[];
    character_picks: { character_id: number; pick_type: string }[];
}

export default function SquadPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [team, setTeam] = useState<SquadTeam | null>(null);
    const [myPicks, setMyPicks] = useState<Anime[]>([]);
    const [myCharacters, setMyCharacters] = useState<(Character & { pick_type: string })[]>([]);
    const [allAnime, setAllAnime] = useState<Anime[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [transferMode, setTransferMode] = useState(false);
    const [transferOut, setTransferOut] = useState<Anime | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [weeklyScore, setWeeklyScore] = useState<number | null>(null);

    const fetchSquad = useCallback(async (userId: string) => {
        setLoading(true);

        const { data: season } = await supabase
            .from('seasons').select('id').eq('status', 'active').single();

        const { data: rawTeamData } = await supabase
            .from('teams')
            .select('*, team_picks(anime_id), character_picks(character_id, pick_type)')
            .eq('user_id', userId)
            .eq('season_id', season?.id)
            .maybeSingle();

        const { data: animeAll } = await supabase
            .from('anime_cache')
            .select('id, title_romaji, title_english, cover_image, cost_kp, average_score, hype_score, hype_change, genres')
            .order('hype_score', { ascending: false });

        if (animeAll) setAllAnime(animeAll as unknown as Anime[]);

        if (rawTeamData) {
            const teamData = rawTeamData as unknown as SquadTeam;
            setTeam(teamData);
            
            const pickIds = teamData.team_picks.map(p => p.anime_id);
            const picks = (animeAll as unknown as Anime[] || []).filter(a => pickIds.includes(a.id));
            setMyPicks(picks);

            if (teamData.character_picks?.length > 0) {
                const charIds = teamData.character_picks.map(p => p.character_id);
                const { data: charDetails } = await supabase
                    .from('character_cache')
                    .select('*')
                    .in('id', charIds);
                
                if (charDetails) {
                    const mapped = teamData.character_picks.map(p => {
                        const detail = charDetails.find(c => c.id === p.character_id);
                        return detail ? { ...detail, pick_type: p.pick_type } : null;
                    }).filter(Boolean) as (Character & { pick_type: string })[];
                    setMyCharacters(mapped);
                }
            }
        }
        setLoading(false);
    }, []);

    const init = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setLoading(false); return; }
        setUser(session.user as User);
        await fetchSquad(session.user.id);

        const { data: ws } = await supabase
            .from('weekly_scores')
            .select('score, week_number')
            .order('week_number', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (ws) setWeeklyScore(ws.score);
    }, [fetchSquad]);

    useEffect(() => {
        init();
    }, [init]);

    const setCapData = useCallback(async (field: 'captain_anime_id' | 'vice_captain_anime_id', animeId: number | null) => {
        if (!team) return;
        if (field === 'vice_captain_anime_id' && animeId === team.captain_anime_id) {
            setMessage({ type: 'error', text: 'Captain and Vice-Captain cannot be the same!' });
            return;
        }
        if (field === 'captain_anime_id' && animeId === team.vice_captain_anime_id) {
            setMessage({ type: 'error', text: 'This anime is already your Vice-Captain!' });
            return;
        }

        setSaving(true);
        const { error } = await supabase.from('teams').update({ [field]: animeId }).eq('id', team.id);
        if (!error) {
            setTeam(prev => prev ? { ...prev, [field]: animeId } : prev);
            setMessage({ type: 'success', text: 'Tactical roles updated!' });
        } else {
            setMessage({ type: 'error', text: 'System interference. Try again.' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    }, [team]);

    const handleTransfer = async (incomingAnime: Anime) => {
        if (!team || !transferOut || !user) return;
        const kpDiff = transferOut.cost_kp - incomingAnime.cost_kp;
        const freeLeft = team.free_transfers - team.transfers_used;
        const penalty = freeLeft <= 0 ? 300 : 0;

        if (team.remaining_kp + kpDiff < penalty) {
            setMessage({ type: 'error', text: 'Insufficient KuraPoints for this transfer.' });
            return;
        }

        setSaving(true);
        try {
            await supabase.from('team_picks').delete().eq('team_id', team.id).eq('anime_id', transferOut.id);
            await supabase.from('team_picks').insert({ team_id: team.id, anime_id: incomingAnime.id });

            const updates: Partial<SquadTeam> = {
                remaining_kp: team.remaining_kp + kpDiff - penalty,
                transfers_used: team.transfers_used + 1
            };
            if (team.captain_anime_id === transferOut.id) updates.captain_anime_id = null;
            if (team.vice_captain_anime_id === transferOut.id) updates.vice_captain_anime_id = null;

            await supabase.from('teams').update(updates as Record<string, unknown>).eq('id', team.id);
            await supabase.from('transfers').insert({
                team_id: team.id, anime_out_id: transferOut.id, anime_in_id: incomingAnime.id,
                kp_cost: penalty, week_number: team.week_number || 1
            });

            setMessage({ type: 'success', text: 'Squad synchronized. Transfer complete.' });
            setTransferMode(false);
            setTransferOut(null);
            await fetchSquad(user.id);
        } catch (err: unknown) {
            setMessage({ type: 'error', text: 'Transfer failed. League servers timed out.' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 4000);
        }
    };

    if (loading) {
        return (
            <AppShell>
                <div className="flex items-center justify-center py-64">
                    <Loader2 className="animate-spin text-accent" size={48} />
                </div>
            </AppShell>
        );
    }

    if (!user) {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center py-48 space-y-8 bg-[var(--surface)] rounded-[3rem] border border-dashed border-[var(--border)] p-12 text-center shadow-xl">
                    <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center text-accent ring-4 ring-accent/10">
                        <Shield size={40} />
                    </div>
                    <div className="space-y-4 max-w-md">
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Squad Hidden</h3>
                        <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                            You must be authenticated to manage your tactical lineup and execute transfers.
                        </p>
                    </div>
                    <button onClick={() => router.push('/login')} className="px-10 py-5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl">
                        Log In to Manage Squad
                    </button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-10">
                {/* Header HUD */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[var(--surface)] p-8 rounded-[2rem] border border-[var(--border)] shadow-2xl backdrop-blur-md">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">My Squad</h1>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Week {team?.week_number || 1}</span>
                                    <div className="w-1 h-1 rounded-full bg-[var(--border)]"></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-accent">{team?.remaining_kp.toLocaleString() || 0} KP Remaining</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl px-6 py-3 flex items-center gap-4 shadow-sm">
                            <div className="text-center border-r border-[var(--border)] pr-4">
                                <p className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Free Transfers</p>
                                <p className="text-sm font-black text-[var(--foreground)]">{Math.max(0, (team?.free_transfers || 2) - (team?.transfers_used || 0))}</p>
                            </div>
                            <button onClick={() => setTransferMode(!transferMode)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${transferMode ? 'bg-yellow-500 text-black' : 'hover:bg-[var(--surface-hover)] text-[var(--muted)]'}`}>
                                <ArrowLeftRight size={14} />
                                {transferMode ? 'Cancel' : 'Manage Transfers'}
                            </button>
                        </div>
                        {weeklyScore && (
                            <div className="bg-accent text-white px-6 py-4 rounded-2xl shadow-lg flex flex-col items-center">
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">Last Week</span>
                                <span className="text-xl font-black italic">{weeklyScore} PTS</span>
                            </div>
                        )}
                    </div>
                </div>

                {message && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                        {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        {message.text}
                    </motion.div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                    <div className="xl:col-span-2 space-y-10">
                        {/* Anime Lineup */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">My Team</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {myPicks.map((anime) => {
                                    const isCaptain = team?.captain_anime_id === anime.id;
                                    const isVC = team?.vice_captain_anime_id === anime.id;
                                    const isTarget = transferOut?.id === anime.id;
                                    return (
                                        <div key={anime.id} className={`bg-[var(--surface)] border rounded-3xl p-5 flex items-center gap-5 transition-all shadow-sm ${isTarget ? 'border-yellow-500 bg-yellow-500/5' : 'border-[var(--border)]'}`}>
                                            <div className="relative w-20 h-28 shrink-0 group">
                                                <img src={anime.cover_image} className="w-full h-full object-cover rounded-2xl shadow-xl transition-transform group-hover:scale-105" alt="cover" />
                                                {isCaptain && <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-yellow-500 text-black flex items-center justify-center border-2 border-black shadow-lg"><Crown size={16} /></div>}
                                                {isVC && <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-slate-400 text-black flex items-center justify-center border-2 border-black shadow-lg"><span className="text-[10px] font-black">VC</span></div>}
                                            </div>
                                            <div className="grow min-w-0 space-y-3">
                                                <div>
                                                    <h4 className="text-sm font-black uppercase truncate text-[var(--foreground)] italic">{anime.title_english || anime.title_romaji}</h4>
                                                    <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest truncate opacity-60">{anime.genres?.[0] || 'Team Pick'}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!transferMode ? (
                                                        <>
                                                            <button onClick={() => setCapData('captain_anime_id', isCaptain ? null : anime.id)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${isCaptain ? 'bg-yellow-500 text-black' : 'bg-[var(--surface-hover)] text-[var(--muted)] hover:text-yellow-500'}`}>Captain</button>
                                                            <button onClick={() => setCapData('vice_captain_anime_id', isVC ? null : anime.id)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${isVC ? 'bg-slate-400 text-black' : 'bg-[var(--surface-hover)] text-[var(--muted)] hover:text-slate-400'}`}>VC</button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => setTransferOut(isTarget ? null : anime)} className={`w-full py-2 rounded-xl text-[8px] font-black uppercase border transition-all ${isTarget ? 'bg-yellow-500 text-black' : 'bg-[var(--background)] text-[var(--muted)] hover:text-yellow-500'}`}>Replace</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Character Recruits */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] flex items-center gap-3">
                                <Star size={20} className="text-accent fill-accent" /> Special Recruits
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {['STAR_CHAR', 'WAIFU_HUSBANDO'].map((type) => {
                                    const char = myCharacters.find(c => c.pick_type === type);
                                    return (
                                        <div key={type} className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-5 flex items-center gap-5 shadow-sm">
                                            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/5 bg-[var(--background)] shrink-0">
                                                {char ? (
                                                    <img src={char.image} className="w-full h-full object-cover" alt="char" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--muted)]/20"><Plus size={32} /></div>
                                                )}
                                            </div>
                                            <div className="min-w-0 grow">
                                                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-accent mb-1">{type === 'STAR_CHAR' ? 'Star Recruit' : 'Waifu / Husbando'}</p>
                                                {char ? (
                                                    <div className="space-y-1">
                                                        <h4 className="text-sm font-black uppercase truncate text-[var(--foreground)] italic">{char.name}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest">{char.role}</span>
                                                            <Heart size={8} className="text-pink-500 fill-pink-500" />
                                                            <span className="text-[8px] font-bold text-pink-500">{char.favorites.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => router.push('/draft')} className="text-[10px] font-black uppercase text-[var(--muted)] hover:text-accent transition-colors">Pick a Character</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Trends */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">
                            {transferMode ? 'Market Selection' : 'Market Trends'}
                        </h3>
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] overflow-hidden shadow-xl p-6 space-y-4">
                            {allAnime.slice(0, 8).map((anime) => {
                                const alreadyOwn = myPicks.some(p => p.id === anime.id);
                                if (!transferMode && alreadyOwn) return null;
                                return (
                                    <div key={anime.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img src={anime.cover_image} className="w-10 h-14 object-cover rounded-lg shadow-lg" alt="thumb" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase truncate w-32 text-[var(--foreground)]">{anime.title_english || anime.title_romaji}</p>
                                                <p className="text-[7px] font-bold text-[var(--muted)] uppercase tracking-widest">{anime.cost_kp.toLocaleString()} KP</p>
                                            </div>
                                        </div>
                                        {transferMode && transferOut && !alreadyOwn ? (
                                            <button onClick={() => handleTransfer(anime)} className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:scale-110 shadow-lg shadow-accent/20"><CheckCircle size={18} /></button>
                                        ) : (
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-accent italic">{anime.hype_score}</p>
                                                <div className={`flex items-center justify-end gap-0.5 ${anime.hype_change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {anime.hype_change >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                                                    <span className="text-[8px] font-black">{Math.abs(anime.hype_change)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <button onClick={() => router.push('/hype')} className="w-full py-4 bg-[var(--surface-hover)] hover:bg-accent hover:text-white text-[8px] font-black uppercase tracking-widest text-[var(--muted)] transition-all rounded-xl mt-4">Full Index</button>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
