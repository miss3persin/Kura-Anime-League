"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Calendar, CheckCircle, RefreshCw, ChevronRight, LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSeasonTimeline } from "@/lib/hooks/useSeasonTimeline";

interface SeasonInfo {
    phase: string;
    deadline: string | null;
    deadlineLabel: string | null;
    activeSeason: { name?: string | null } | null;
    upcomingSeason: { name?: string | null } | null;
    currentWeek: number;
    totalWeeks: number;
}

const PHASE_CONFIG: Record<string, {
    color: string;
    bg: string;
    border: string;
    icon: LucideIcon;
    badge: string;
    title: (s: SeasonInfo) => string;
    subtitle: (s: SeasonInfo) => string;
}> = {
    draft_open: {
        color: '#00FF9C',
        bg: 'rgba(0,255,156,0.05)',
        border: 'rgba(0,255,156,0.2)',
        icon: Zap,
        badge: '🟢 DRAFT OPEN',
        title: (s) => s.upcomingSeason?.name ?? s.activeSeason?.name ?? 'Draft Open',
        subtitle: () => 'Build your team before the deadline — pick your 5 shows now!',
    },
    season_live: {
        color: '#AE00FF',
        bg: 'rgba(174,0,255,0.05)',
        border: 'rgba(174,0,255,0.2)',
        icon: Zap,
        badge: '🟣 SEASON LIVE',
        title: (s) => `${s.upcomingSeason?.name ?? s.activeSeason?.name ?? 'Season'} — Week ${s.currentWeek}/${s.totalWeeks}`,
        subtitle: () => 'Scores update every Friday. Track your picks on the Hype Index.',
    },
    transfer_review: {
        color: '#FFD700',
        bg: 'rgba(255,215,0,0.05)',
        border: 'rgba(255,215,0,0.2)',
        icon: RefreshCw,
        badge: '🟡 TRANSFER REVIEW',
        title: (s) => `${s.upcomingSeason?.name ?? s.activeSeason?.name ?? 'Season'} Ended`,
        subtitle: () => 'Decide which picks carry over. The new season draft opens soon.',
    },
    pre_draft: {
        color: '#64748b',
        bg: 'rgba(100,116,139,0.05)',
        border: 'rgba(100,116,139,0.15)',
        icon: Calendar,
        badge: '📅 COMING SOON',
        title: (s) => `${s.upcomingSeason?.name ?? 'Next Season'} Draft Opens Soon`,
        subtitle: () => 'Browse upcoming shows and plan your team in advance.',
    },
    off_season: {
        color: '#64748b',
        bg: 'rgba(100,116,139,0.05)',
        border: 'rgba(100,116,139,0.15)',
        icon: CheckCircle,
        badge: '⬜ OFF SEASON',
        title: () => 'Between Seasons',
        subtitle: () => 'No active season. The next draft window will open soon — stay tuned.',
    },
    ended: {
        color: '#64748b',
        bg: 'rgba(100,116,139,0.05)',
        border: 'rgba(100,116,139,0.15)',
        icon: CheckCircle,
        badge: '✅ SEASON COMPLETE',
        title: (s) => `${s.activeSeason?.name ?? 'Season'} Complete`,
        subtitle: () => 'Awards have been distributed. The next draft window opens soon.',
    },
};

export function useCountdown(deadline: string | null) {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!deadline) return;
        const tick = () => {
            const diff = new Date(deadline).getTime() - Date.now();
            if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
            setTimeLeft({
                days: Math.floor(diff / 86400000),
                hours: Math.floor((diff % 86400000) / 3600000),
                minutes: Math.floor((diff % 3600000) / 60000),
                seconds: Math.floor((diff % 60000) / 1000),
            });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [deadline]);

    return timeLeft;
}

type SeasonPhaseBannerProps = {
    showTimelineEntries?: boolean;
};

export function SeasonPhaseBanner({ showTimelineEntries = true }: SeasonPhaseBannerProps) {
    const router = useRouter();
    const {
        loading,
        seasonInfo,
        timelineEntries
    } = useSeasonTimeline();
    const countdown = useCountdown(seasonInfo?.deadline ?? null);
    const [visible, setVisible] = useState(true);

    if (loading || !seasonInfo) return null;
    const info = seasonInfo;

    const cfg = PHASE_CONFIG[info.phase] ?? PHASE_CONFIG['ended'];
    const Icon = cfg.icon;

    const ctaLabel = info.phase === 'draft_open' ? 'Build Your Team' :
        info.phase === 'season_live' ? 'View Hype Index' :
            info.phase === 'transfer_review' ? 'Manage Squad' :
                info.phase === 'pre_draft' ? 'Browse Shows' : null;
    const ctaHref = info.phase === 'draft_open' ? '/draft' :
        info.phase === 'season_live' ? '/hype' :
            info.phase === 'transfer_review' ? '/squad' :
                info.phase === 'pre_draft' ? '/hype' : null;

    return (
        <>
            {visible && (
                <AnimatePresence>
                    <motion.div
                        key="season-banner"
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className="relative rounded-[2rem] px-8 py-6 border flex flex-col sm:flex-row sm:items-center gap-5 overflow-hidden transition-colors"
                        style={{
                            backgroundColor: 'var(--surface)',
                            borderColor: cfg.border
                        }}
                    >
                        <button
                            onClick={() => setVisible(false)}
                            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-all z-20 cursor-pointer"
                        >
                            <span className="text-xs font-black leading-none">×</span>
                        </button>
                        <div
                            className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
                            style={{ background: cfg.color }}
                        />

                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                            style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}33` }}
                        >
                            <Icon size={22} style={{ color: cfg.color }} />
                        </div>

                        <div className="flex-grow min-w-0 z-10">
                            <div className="flex items-center gap-3 mb-1">
                                <span
                                    className="text-[9px] font-black uppercase tracking-[0.25em] px-3 py-1 rounded-full"
                                    style={{ background: `${cfg.color}15`, color: cfg.color }}
                                >
                                    {cfg.badge}
                                </span>
                                {info.phase === 'season_live' && (
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: info.totalWeeks }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="h-1 rounded-full transition-all"
                                                style={{
                                                    width: i < info.currentWeek ? '14px' : '6px',
                                                    background: i < info.currentWeek ? cfg.color : 'var(--border)',
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="font-black text-[var(--foreground)] uppercase tracking-tight text-base leading-none mb-1">
                                {cfg.title(info)}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                                {cfg.subtitle(info)}
                            </p>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0 z-10">
                            {info.deadline && (
                                <div className="text-right hidden sm:block">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)] mb-1">
                                        {info.deadlineLabel}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        {[
                                            { v: countdown.days, l: 'd' },
                                            { v: countdown.hours, l: 'h' },
                                            { v: countdown.minutes, l: 'm' },
                                            { v: countdown.seconds, l: 's' },
                                        ].map(({ v, l }) => (
                                            <div
                                                key={l}
                                                className="w-10 h-10 rounded-xl flex flex-col items-center justify-center border border-[var(--border)] bg-[var(--surface-hover)]"
                                            >
                                                <span className="text-sm font-black leading-none" style={{ color: cfg.color }}>
                                                    {String(v).padStart(2, '0')}
                                                </span>
                                                <span className="text-[7px] font-black uppercase text-[var(--muted)]">{l}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {ctaLabel && ctaHref && (
                                <button
                                    onClick={() => router.push(ctaHref)}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:opacity-90 text-white flex-shrink-0 shadow-lg"
                                    style={{ background: cfg.color }}
                                >
                                    {ctaLabel}
                                    <ChevronRight size={12} />
                                </button>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}
            {showTimelineEntries && (
                <div className="mt-6 bg-[var(--surface-hover)] border border-[var(--border)] rounded-[2rem] p-6 space-y-6 shadow-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {timelineEntries.map(entry => (
                            <div key={entry.field} className="flex items-center justify-between bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-4 py-3">
                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--muted)]">{entry.label}</span>
                                <span className="text-[9px] font-black text-[var(--foreground)]">
                                    {entry.value ? new Date(entry.value).toLocaleString().replace(/\//g, '-') : "TBD"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
