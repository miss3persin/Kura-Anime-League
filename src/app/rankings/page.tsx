"use client";

import React, { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { Trophy, Zap, Loader2, Star, TrendingUp, Crown } from "lucide-react";

interface Profile {
    id: string;
    username: string;
    avatar_url: string;
    total_kp: number;
    tier: string;
    level: number;
}

interface PlayerRow extends Profile {
    kp: number;
    badge?: string;
}

interface SeasonScore {
    user_id: string;
    total_season_kp: number;
    badge_tier: string | null;
    profiles: Profile;
}

interface WeeklyRow {
    team_id: string;
    score: number;
    week_number: number;
    teams: {
        user_id: string;
        profiles: Profile;
    };
}

interface SeasonData {
    id: string | number;
    name: string;
    week_number: number;
}

const TAB_IDS = ['alltime', 'season', 'weekly'] as const;
type TabId = typeof TAB_IDS[number];

const TIER_COLORS: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    diamond: '#B9F2FF',
    kura_elite: '#AE00FF',
};

export default function RankingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('alltime');
    const [alltimePlayers, setAlltimePlayers] = useState<PlayerRow[]>([]);
    const [seasonScores, setSeasonScores] = useState<SeasonScore[]>([]);
    const [weeklyScores, setWeeklyScores] = useState<WeeklyRow[]>([]);
    const [currentSeason, setCurrentSeason] = useState<SeasonData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            setLoading(true);

            // Fetch all-time
            const { data: alltime } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, total_kp, tier, level')
                .order('total_kp', { ascending: false })
                .limit(50);

            if (alltime) setAlltimePlayers(alltime.map(p => ({ ...p, kp: p.total_kp } as PlayerRow)));

            // Fetch active season
            const { data: season } = await supabase
                .from('seasons')
                .select('id, name, week_number')
                .eq('status', 'active')
                .single();

            if (season) {
                setCurrentSeason(season as SeasonData);

                // Season leaderboard
                const { data: ss } = await supabase
                    .from('season_scores')
                    .select('*, profiles(id, username, avatar_url, total_kp, tier, level)')
                    .eq('season_id', season.id)
                    .order('total_season_kp', { ascending: false })
                    .limit(50);

                if (ss) setSeasonScores(ss as unknown as SeasonScore[]);

                // Weekly (last week's scores)
                const { data: ws } = await supabase
                    .from('weekly_scores')
                    .select('team_id, score, week_number, teams(user_id, profiles(id, username, avatar_url, total_kp, tier, level))')
                    .eq('week_number', season.week_number ?? 1)
                    .order('score', { ascending: false })
                    .limit(50);

                if (ws) setWeeklyScores(ws as unknown as WeeklyRow[]);
            }

            setLoading(false);
        };

        init();
    }, []);

    const alltimeData = alltimePlayers;
    const seasonData = useMemo(() => seasonScores.map(s => ({
        id: s.profiles?.id,
        username: s.profiles?.username,
        avatar_url: s.profiles?.avatar_url,
        kp: s.total_season_kp,
        tier: s.profiles?.tier,
        badge: s.badge_tier ?? undefined,
    })), [seasonScores]);

    const weeklyData = useMemo(() => weeklyScores.map(w => ({
        id: w.teams?.profiles?.id,
        username: w.teams?.profiles?.username,
        avatar_url: w.teams?.profiles?.avatar_url,
        kp: w.score,
        tier: w.teams?.profiles?.tier,
    })), [weeklyScores]);

    const renderPodiumAndTable = (
        players: { id: string; username: string; avatar_url: string; kp: number; tier?: string; badge?: string }[]
    ) => {
        const top3 = players.slice(0, 3);
        const others = players.slice(3);
        const podiumOrder = [];
        if (top3[1]) podiumOrder.push({ ...top3[1], pos: 2 });
        if (top3[0]) podiumOrder.push({ ...top3[0], pos: 1 });
        if (top3[2]) podiumOrder.push({ ...top3[2], pos: 3 });

        const podiumHeights: Record<number, string> = { 1: 'h-48', 2: 'h-36', 3: 'h-28' };
        const posColors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

        return (
            <>
                {/* Podium */}
                <div className="flex items-end justify-center gap-4 mb-14 mt-4 px-4">
                    {podiumOrder.map((p) => (
                        <motion.div
                            key={p.id}
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: p.pos * 0.1 }}
                            className="flex flex-col items-center gap-3 flex-1 max-w-[180px]"
                        >
                            {p.pos === 1 && (
                                <div className="w-8 h-8 text-yellow-400 flex items-center justify-center">
                                    <Crown size={28} />
                                </div>
                            )}
                            <div
                                className="w-16 h-16 rounded-full overflow-hidden border-4 shadow-2xl"
                                style={{ borderColor: posColors[p.pos] }}
                            >
                                <img
                                    src={p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`}
                                    className="w-full h-full rounded-full bg-zinc-800"
                                    alt={`${p.username} avatar`}
                                />
                            </div>
                            <div className="text-center">
                                <p className="font-black uppercase text-xs truncate w-24 text-center text-[var(--foreground)]">{p.username}</p>
                                <p className="font-black text-lg" style={{ color: posColors[p.pos] }}>
                                    {p.kp.toLocaleString()} <span className="text-[9px] text-[var(--muted)]">KP</span>
                                </p>
                            </div>
                            {/* Platform */}
                            <div
                                className={`w-full ${podiumHeights[p.pos]} rounded-t-2xl flex items-start justify-center pt-4`}
                                style={{ background: `${posColors[p.pos]}18`, borderTop: `3px solid ${posColors[p.pos]}` }}
                            >
                                <span className="text-3xl font-black" style={{ color: posColors[p.pos] }}>#{p.pos}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-xl">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-hover)]">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Rank</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Player</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--muted)] hidden md:table-cell">Tier</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--muted)] text-right">KP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {others.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-[10px] font-black uppercase text-[var(--muted)] tracking-widest">
                                        Awaiting more challengers...
                                    </td>
                                </tr>
                            )}
                            {others.map((player, i) => (
                                <motion.tr
                                    key={player.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="hover:bg-[var(--surface-hover)] transition-colors group"
                                >
                                    <td className="px-6 py-5 font-black text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors text-sm">
                                        #{i + 4}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] overflow-hidden flex-shrink-0">
                                                <img
                                                    src={player.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.username}`}
                                                    alt={`${player.username} small avatar`}
                                                />
                                            </div>
                                            <span className="font-bold uppercase tracking-wider text-sm group-hover:text-[var(--foreground)] transition-colors truncate">
                                                {player.username}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 hidden md:table-cell">
                                        <span
                                            className="text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border"
                                            style={{
                                                color: TIER_COLORS[player.badge ?? player.tier ?? 'bronze'],
                                                borderColor: `${TIER_COLORS[player.badge ?? player.tier ?? 'bronze']}44`,
                                                background: `${TIER_COLORS[player.badge ?? player.tier ?? 'bronze']}11`,
                                            }}
                                        >
                                            {player.badge ?? player.tier ?? 'Bronze'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-right font-black text-base group-hover:text-accent transition-colors">
                                        {player.kp.toLocaleString()}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </>
        );
    };

    return (
        <AppShell>
            <div className="space-y-10">
                {/* Header HUD */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                        <Trophy size={24} />
                    </div>
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">League Standings</h1>
                        <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-1">
                            The definitive global elite hierarchy
                        </p>
                    </div>
                </div>

                {/* Sub-Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex gap-2 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-fit shadow-sm">
                        {TAB_IDS.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                            >
                                {tab === 'alltime' ? 'All-Time Elite' : tab === 'season' ? (currentSeason?.name || 'Seasonal') : 'Last Week'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/5 border border-accent/10">
                            <Zap size={14} className="text-accent" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-accent">Real-time sync active</span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 className="animate-spin text-accent" size={48} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Recalculating Ranks...</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            {activeTab === 'alltime' && renderPodiumAndTable(alltimeData)}
                            {activeTab === 'season' && (
                                seasonScores.length === 0 ? (
                                    <div className="py-40 text-center bg-[var(--surface-hover)] rounded-[3rem] border border-dashed border-[var(--border)]">
                                        <Star size={48} className="mx-auto text-[var(--border)] mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Seasonal Data Synchronizing...</p>
                                    </div>
                                ) : (
                                    renderPodiumAndTable(seasonData as PlayerRow[])
                                )
                            )}
                            {activeTab === 'weekly' && (
                                weeklyScores.length === 0 ? (
                                    <div className="py-40 text-center bg-[var(--surface-hover)] rounded-[3rem] border border-dashed border-[var(--border)]">
                                        <TrendingUp size={48} className="mx-auto text-[var(--border)] mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">Awaiting Next Week&apos;s Results...</p>
                                    </div>
                                ) : (
                                    renderPodiumAndTable(weeklyData as PlayerRow[])
                                )
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </AppShell>
    );
}
