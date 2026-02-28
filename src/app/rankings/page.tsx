"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { Trophy, Zap, Loader2, Star, TrendingUp, TrendingDown, Medal, Crown } from "lucide-react";

interface PlayerRow {
    id: string;
    username: string;
    avatar_url: string;
    total_kp: number;
    tier: string;
    level: number;
}

interface SeasonScore {
    user_id: string;
    total_season_kp: number;
    final_rank: number | null;
    badge_tier: string;
    profiles: PlayerRow;
}

interface WeeklyRow {
    team_id: string;
    score: number;
    week_number: number;
    teams: { user_id: string; profiles: PlayerRow };
}

const TIER_COLORS: Record<string, string> = {
    shogun: '#FFD700',
    platinum: '#E5E4E2',
    gold: '#FFD47B',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
};

const TAB_IDS = ['alltime', 'season', 'weekly'] as const;
type TabId = typeof TAB_IDS[number];

export default function RankingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('alltime');
    const [alltimePlayers, setAlltimePlayers] = useState<PlayerRow[]>([]);
    const [seasonScores, setSeasonScores] = useState<SeasonScore[]>([]);
    const [weeklyScores, setWeeklyScores] = useState<WeeklyRow[]>([]);
    const [currentSeason, setCurrentSeason] = useState<any>(null);
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

            if (alltime) setAlltimePlayers(alltime);

            // Fetch active season
            const { data: season } = await supabase
                .from('seasons')
                .select('*')
                .eq('status', 'active')
                .single();

            if (season) {
                setCurrentSeason(season);

                // Season leaderboard
                const { data: ss } = await supabase
                    .from('season_scores')
                    .select('*, profiles(id, username, avatar_url, total_kp, tier, level)')
                    .eq('season_id', season.id)
                    .order('total_season_kp', { ascending: false })
                    .limit(50);

                if (ss) setSeasonScores(ss as any);

                // Weekly (last week's scores)
                const { data: ws } = await supabase
                    .from('weekly_scores')
                    .select('team_id, score, week_number, teams(user_id, profiles(id, username, avatar_url, total_kp, tier, level))')
                    .eq('week_number', season.week_number ?? 1)
                    .order('score', { ascending: false })
                    .limit(50);

                if (ws) setWeeklyScores(ws as any);
            }

            setLoading(false);
        };

        init();
    }, []);

    const renderPodiumAndTable = (
        players: { id: string; username: string; avatar_url: string; kp: number; tier?: string; badge?: string }[]
    ) => {
        const top3 = players.slice(0, 3);
        const others = players.slice(3);
        const podiumOrder = [];
        if (top3[1]) podiumOrder.push({ ...top3[1], pos: 2 });
        if (top3[0]) podiumOrder.push({ ...top3[0], pos: 1 });
        if (top3[2]) podiumOrder.push({ ...top3[2], pos: 3 });

        const podiumHeights = { 1: 'h-48', 2: 'h-36', 3: 'h-28' };
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
                                    alt={p.username}
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
                                className={`w-full ${podiumHeights[p.pos as keyof typeof podiumHeights]} rounded-t-2xl flex items-start justify-center pt-4`}
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
                                                    alt={player.username}
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

    const alltimeData = alltimePlayers.map(p => ({ ...p, kp: p.total_kp }));
    const seasonData = seasonScores.map(s => ({
        id: s.profiles?.id,
        username: s.profiles?.username,
        avatar_url: s.profiles?.avatar_url,
        kp: s.total_season_kp,
        tier: s.profiles?.tier,
        badge: s.badge_tier,
    }));
    const weeklyData = weeklyScores.map(w => ({
        id: (w.teams as any)?.profiles?.id,
        username: (w.teams as any)?.profiles?.username,
        avatar_url: (w.teams as any)?.profiles?.avatar_url,
        kp: w.score,
        tier: (w.teams as any)?.profiles?.tier,
    }));

    return (
        <AppShell>
            <div className="space-y-10">
                {/* Header */}
                <div className="text-center space-y-3">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-3 mb-2"
                    >
                        <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                            <Trophy size={20} />
                        </div>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]"
                    >
                        Rankings
                    </motion.h1>
                    <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-[0.3em]">
                        {currentSeason ? `${currentSeason.name} · Week ${currentSeason.week_number}` : 'Global Leaderboards'}
                    </p>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-2 p-1 bg-[var(--surface)] rounded-2xl w-fit mx-auto border border-[var(--border)] shadow-sm">
                    {([
                        { id: 'alltime', label: 'All-Time', icon: Star },
                        { id: 'season', label: currentSeason?.name ?? 'Season', icon: Zap },
                        { id: 'weekly', label: `Week ${currentSeason?.week_number ?? '—'}`, icon: TrendingUp },
                    ] as { id: TabId; label: string; icon: any }[]).map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${activeTab === tab.id ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                            >
                                <Icon size={12} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-40">
                        <Loader2 className="animate-spin text-accent" size={48} />
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                        >
                            {activeTab === 'alltime' && renderPodiumAndTable(alltimeData)}
                            {activeTab === 'season' && (
                                seasonData.length > 0
                                    ? renderPodiumAndTable(seasonData as any)
                                    : (
                                        <div className="text-center py-32 space-y-4 bg-[var(--surface-hover)] rounded-[2rem] border border-dashed border-[var(--border)]">
                                            <Trophy size={48} className="text-[var(--muted)] opacity-50 mx-auto" />
                                            <p className="font-black uppercase text-sm text-[var(--muted)] tracking-widest">
                                                Season leaderboard will populate after Week 1 scoring.
                                            </p>
                                        </div>
                                    )
                            )}
                            {activeTab === 'weekly' && (
                                weeklyData.length > 0
                                    ? renderPodiumAndTable(weeklyData as any)
                                    : (
                                        <div className="text-center py-32 space-y-4 bg-[var(--surface-hover)] rounded-[2rem] border border-dashed border-[var(--border)]">
                                            <TrendingUp size={48} className="text-[var(--muted)] opacity-50 mx-auto" />
                                            <p className="font-black uppercase text-sm text-[var(--muted)] tracking-widest">
                                                Weekly scores post every Friday at midnight UTC.
                                            </p>
                                        </div>
                                    )
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </AppShell>
    );
}
