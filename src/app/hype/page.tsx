"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import {
    TrendingUp, TrendingDown, Activity, Zap,
    BarChart3, RefreshCw, Loader2, Search, ArrowDownUp
} from "lucide-react";

interface AnimeHype {
    id: number;
    title_romaji: string;
    cover_image: string;
    hype_score: number;
    hype_change: number;
    cost_kp: number;
    average_score: number;
    status: string;
    hype_history?: { timestamp: string; price: number; cost_kp?: number; hype?: number }[];
}

type TimeRangeKey = "1h" | "24h" | "7d";

const TIME_RANGES: { key: TimeRangeKey; label: string; ms: number }[] = [
    { key: "1h", label: "1H", ms: 1000 * 60 * 60 },
    { key: "24h", label: "24H", ms: 1000 * 60 * 60 * 24 },
    { key: "7d", label: "7D", ms: 1000 * 60 * 60 * 24 * 7 },
];

type AnimeModalProps = {
    anime: AnimeHype;
    onClose: () => void;
};

const formatHistoryEntry = (entry: { timestamp: string; price: number; cost_kp?: number; hype?: number }) => {
    const date = new Date(entry.timestamp);
    const isValid = !Number.isNaN(date.getTime());
    return {
        label: isValid ? date.toLocaleString() : "Live",
        price: entry.price?.toLocaleString?.() ?? (entry.cost_kp ? entry.cost_kp.toLocaleString() : "—"),
        hype: entry.hype ?? "—"
    };
};

const computeHistoryInsights = (history?: { timestamp: string; price: number }[]) => {
    if (!history || !history.length) {
        return { high: null, low: null, avg: null, volatility: null };
    }
    const prices = history.map((entry) => entry.price ?? 0);
    const highs = Math.max(...prices);
    const lows = Math.min(...prices);
    const avg = Math.round(prices.reduce((sum, val) => sum + val, 0) / prices.length);
    const volatility = Math.round(
        Math.sqrt(prices.reduce((acc, price) => acc + Math.pow(price - avg, 2), 0) / prices.length)
    );
    return { high: highs, low: lows, avg, volatility };
};

function AnimeDetailModal({ anime, onClose }: AnimeModalProps) {
    const history = anime.hype_history ?? [];
    const previewData = history.slice(0, 4);
    const latest = formatHistoryEntry(history[0] ?? { timestamp: new Date().toISOString(), price: anime.cost_kp ?? 0, hype: anime.hype_score });
    const previous = history[1];
    const historyInsights = computeHistoryInsights(history);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 mx-auto w-full max-w-3xl rounded-3xl border border-white/20 bg-[var(--surface)] p-6 shadow-2xl max-h-[85vh] overflow-hidden">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-[var(--muted)]">Anime Insight</p>
                        <h3 className="text-2xl font-black uppercase tracking-tight text-[var(--foreground)]">{anime.title_romaji}</h3>
                        <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--muted)]">{anime.status ?? "Status unknown"}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)] transition hover:border-accent hover:text-white"
                    >
                        Dismiss
                    </button>
                </div>
                <div className="mt-6 grid gap-6 sm:grid-cols-[220px,1fr] max-h-[70vh]">
                    <div>
                        <div className="relative h-64 overflow-hidden rounded-2xl border border-white/10">
                            <img src={anime.cover_image} alt={`${anime.title_romaji} cover`} className="h-full w-full object-cover" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.4em]">
                            <span className="rounded-full border border-emerald-500/40 bg-black/40 px-3 py-1 text-emerald-300">Hype {anime.hype_score}</span>
                            <span className="rounded-full border border-sky-500/40 bg-black/40 px-3 py-1 text-sky-300">
                                {anime.cost_kp?.toLocaleString() ?? "–"} KP
                            </span>
                        </div>
                    </div>
                    <div className="space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "calc(70vh - 140px)" }}>
                        <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">
                            <div className="flex items-center justify-between text-white">
                                <span>Latest Snapshot</span>
                                <span>{latest.label}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Price</span>
                                <span className="font-black">{latest.price} KP</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Hype score</span>
                                <span className="font-black">{latest.hype}</span>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">
                            <p className="text-[10px] text-[var(--muted)]">History preview</p>
                            <div className="mt-3 grid gap-2 text-[13px]">
                                {previewData.length ? (
                                    previewData.map((entry, index) => {
                                        const item = formatHistoryEntry(entry);
                                        return (
                                            <div key={`${anime.id}-hist-${index}`} className="flex items-center justify-between text-white">
                                                <span>{item.label}</span>
                                                <span className="font-black">{item.price} KP</span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-[10px] text-[var(--muted)]">No prior history yet.</p>
                                )}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">
                            <p className="text-[10px] text-[var(--muted)]">Additional metrics</p>
                            <div className="mt-3 grid gap-2 text-white">
                                <div className="flex justify-between">
                                    <span>Average score</span>
                                    <span className="font-black">{anime.average_score ?? "—"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Hype change</span>
                                    <span className={`font-black ${anime.hype_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        {anime.hype_change >= 0 ? "+" : ""}
                                        {anime.hype_change}
                                    </span>
                                </div>
                                {previous && (
                                    <div className="flex justify-between text-sm text-[var(--muted)]">
                                        <span>Previous snapshot</span>
                                        <span>{new Date(previous.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-[11px] uppercase tracking-[0.3em] text-[var(--muted)]">
                            <p className="text-[10px] text-[var(--muted)]">Derived insights</p>
                            <div className="mt-3 grid gap-2 text-white">
                                <div className="flex justify-between">
                                    <span>High recorded price</span>
                                    <span className="font-black">{historyInsights.high?.toLocaleString() ?? "—"} KP</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Lowest price</span>
                                    <span className="font-black">{historyInsights.low?.toLocaleString() ?? "—"} KP</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Avg (preview)</span>
                                    <span className="font-black">{historyInsights.avg?.toLocaleString() ?? "—"} KP</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Volatility (std dev)</span>
                                    <span className="font-black">{historyInsights.volatility?.toLocaleString() ?? "—"} KP</span>
                                </div>
                                <div className="text-[10px] text-[var(--muted)]">
                                    These insights combine the latest ~100 snapshots so you can tell if the anime has been stabilizing or swinging wildly.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getHistoryChange(history: AnimeHype["hype_history"], rangeMs: number, currentPrice: number) {
    if (!history || history.length === 0) {
        return { percent: 0, delta: 0 };
    }

    const sortedHistory = [...history].sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime;
    });

    const nowEntry = sortedHistory[0];
    const nowTime = isNaN(new Date(nowEntry.timestamp).getTime())
        ? Date.now()
        : new Date(nowEntry.timestamp).getTime();
    const targetTime = nowTime - rangeMs;

    const prevEntry =
        sortedHistory.find((entry) => {
            const entryTime = new Date(entry.timestamp).getTime();
            return !isNaN(entryTime) && entryTime <= targetTime;
        }) || sortedHistory[sortedHistory.length - 1];

    const prevPrice = prevEntry?.price ?? prevEntry?.cost_kp ?? currentPrice;
    const delta = currentPrice - prevPrice;
    const percent = prevPrice ? Math.round((delta / prevPrice) * 100) : 0;

    return { percent, delta };
}

export default function HypeIndexPage() {
    const [data, setData] = useState<AnimeHype[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [activeRange, setActiveRange] = useState<TimeRangeKey>("24h");
    const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
    const [selectedAnime, setSelectedAnime] = useState<AnimeHype | null>(null);
    const rangeInfo = TIME_RANGES.find(range => range.key === activeRange) ?? TIME_RANGES[1];

    const fetchData = useCallback(async ({ skipLoading, direction }: { skipLoading?: boolean; direction?: "asc" | "desc" } = {}) => {
        if (!skipLoading) {
            setLoading(true);
        }

        try {
            const orderDirection = direction ?? sortDirection;
            const { data: anime, error } = await supabase
                .from('anime_cache')
                .select('*')
                .order('hype_score', { ascending: orderDirection === 'asc' });

            if (error) throw error;

            if (anime) setData(anime as unknown as AnimeHype[]);
        } catch (error) {
            console.error('Failed to load hype index:', error);
        } finally {
            if (!skipLoading) {
                setLoading(false);
            }
        }
    }, [sortDirection]);

    const refreshIndex = async () => {
        setRefreshing(true);
        try {
            await fetch("/api/hype/refresh", { cache: "no-store" });
        } catch (error) {
            console.error("Failed to trigger backend hype refresh", error);
        }
        try {
            await fetchData({ skipLoading: true });
        } finally {
            setRefreshing(false);
        }
    };

    const toggleSortDirection = async () => {
        const nextDirection = sortDirection === 'desc' ? 'asc' : 'desc';
        setSortDirection(nextDirection);
        await fetchData({ skipLoading: true, direction: nextDirection });
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filtered = data.filter(a =>
        a.title_romaji.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AppShell>
            <div className="space-y-10">
                {/* Header HUD */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">Hype Index</h1>
                            <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-1">
                                Real-time anime stock market trending
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full md:flex-row md:items-center md:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] transition-colors group-focus-within:text-accent" size={16} />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Find a ticker..."
                                    className="bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-2xl pl-12 pr-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-accent/40 focus:bg-accent/5 transition-all w-full md:w-64"
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                            {TIME_RANGES.map(range => (
                                <button
                                    key={range.key}
                                    onClick={() => setActiveRange(range.key)}
                                    className={`px-4 py-2 text-[9px] font-black uppercase tracking-[0.4em] rounded-2xl transition-all ${activeRange === range.key ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'border border-[var(--border)] text-[var(--muted)] hover:border-accent/40 hover:text-[var(--foreground)]'}`}
                                >
                                    {range.label}
                                </button>
                            ))}
                            <button
                                onClick={toggleSortDirection}
                                className="flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-[0.4em] rounded-2xl transition-all border border-[var(--border)] text-[var(--muted)] hover:border-accent/40 hover:text-[var(--foreground)]"
                            >
                                <ArrowDownUp size={14} className="text-[var(--muted)]" />
                                <span>{sortDirection === 'desc' ? 'Hype ↓' : 'Hype ↑'}</span>
                            </button>
                            <button
                                onClick={refreshIndex}
                                disabled={refreshing}
                                className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-[var(--muted)] hover:text-[var(--foreground)] hover:border-accent/20 transition-all cursor-pointer shadow-sm"
                            >
                                {refreshing ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Legend / Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Bullish', desc: 'Anime trending upwards in community buzz.', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
                        { label: 'Volatile', desc: 'High hype but rapid price movement expected.', icon: Zap, color: 'text-accent', bg: 'bg-accent/10 border-accent/20' },
                        { label: 'Blue Chip', desc: 'Consistently high scores and popularity.', icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
                    ].map((item, i) => (
                        <div key={i} className={`p-6 rounded-3xl border ${item.bg} flex items-start gap-4 shadow-sm`}>
                            <div className={`p-3 rounded-xl bg-black/20 ${item.color}`}>
                                <item.icon size={20} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-black uppercase tracking-tighter text-[var(--foreground)]">{item.label}</p>
                                <p className="text-[10px] font-bold text-[var(--muted)] leading-relaxed uppercase tracking-widest">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Ticker Table */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-xl transition-all">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[var(--background)] border-b border-[var(--border)]">
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">#</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Anime / Ticker</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Hype Score</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">{rangeInfo.label} Change</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Market Price</th>
                                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] text-right md:text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-24 text-center">
                                            <Loader2 className="animate-spin mx-auto text-accent mb-4" size={32} />
                                            <p className="text-[10px] font-black uppercase text-[var(--muted)] tracking-[0.3em]">Downloading Market Data...</p>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-24 text-center text-[var(--muted)] font-black uppercase text-xs tracking-widest italic">No matching tickers found</td>
                                    </tr>
                                ) : filtered.map((anime, index) => {
                                    const rowNumber = index + 1;
                                    const currentPrice = anime.cost_kp ?? 2500;
                                    const change = getHistoryChange(anime.hype_history, rangeInfo.ms, currentPrice);
                                    const isPositive = change.percent >= 0;

                                return (
                                    <motion.tr
                                        key={anime.id}
                                        initial={{ opacity: 0 }}
                                        whileInView={{ opacity: 1 }}
                                        className="hover:bg-accent/[0.02] transition-colors group cursor-pointer"
                                        onClick={() => setSelectedAnime(anime)}
                                    >
                                        <td className="px-8 py-5">
                                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">{rowNumber}</span>
                                        </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative w-12 h-16 flex-shrink-0">
                                                        <img src={anime.cover_image} alt={`${anime.title_romaji} cover image`} className="w-full h-full object-cover rounded-xl shadow-lg border border-[var(--border)] group-hover:scale-105 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black uppercase tracking-tight text-[var(--foreground)] group-hover:text-accent transition-colors truncate w-48 italic leading-tight">{anime.title_romaji}</p>
                                                        <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest mt-1">Ticker: ${anime.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-20 bg-[var(--background)] h-1.5 rounded-full overflow-hidden border border-[var(--border)]">
                                                        <div className="h-full bg-accent" style={{ width: `${(anime.hype_score / 1000) * 100}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-black italic text-accent">{anime.hype_score}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col gap-1">
                                                    <div className={`flex items-center gap-1.5 font-black text-xs italic ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                        {change.percent >= 0 ? '+' : ''}{change.percent}%
                                                    </div>
                                                    <span className="text-[7px] uppercase tracking-[0.5em] text-[var(--muted)]">
                                                        Δ{change.delta.toLocaleString()} KP
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    <Zap size={14} className="text-yellow-500" />
                                                    <span className="text-xs font-black text-[var(--foreground)] italic tracking-tighter">{currentPrice.toLocaleString()} KP</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right md:text-left">
                                                <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.1em] border ${anime.status === 'RELEASING' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
                                                    anime.status === 'HIATUS' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                                                        'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--muted)]'
                                                    }`}>
                                                    {anime.status || 'FINISHED'}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {selectedAnime && <AnimeDetailModal anime={selectedAnime} onClose={() => setSelectedAnime(null)} />}
        </AppShell>
    );
}
