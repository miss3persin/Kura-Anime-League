"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import {
    TrendingUp, TrendingDown, Activity, Zap,
    BarChart3, RefreshCw, Loader2, Search, ArrowDownUp
} from "lucide-react";

interface AnimeHype {
    id: number;
    title_romaji: string;
    title_english?: string;
    cover_image: string;
    hype_score: number;
    hype_change: number;
    cost_kp: number;
    average_score: number;
    status: string;
    is_eligible?: boolean;
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
    const historyInsights = computeHistoryInsights(history);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 mx-auto w-full max-w-4xl rounded-3xl border border-white/20 bg-[var(--surface)] p-8 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex items-start justify-between gap-6 mb-6">
                    <div className="flex gap-6 items-center min-w-0">
                        <div className="relative w-24 h-[100px] flex-shrink-0 overflow-hidden rounded-2xl border-2 border-black shadow-lg">
                            <img 
                                src={anime.cover_image} 
                                alt={anime.title_english || anime.title_romaji} 
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.4em] text-accent font-black mb-1">Show Details</p>
                            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--foreground)] italic leading-tight truncate pr-4">
                                {anime.title_english || anime.title_romaji}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] font-bold truncate max-w-[200px]">{anime.title_english ? anime.title_romaji : 'Seasonal Series'}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${anime.status === 'RELEASING' ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--muted)]'}`}>
                                    {anime.status || 'FINISHED'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] transition hover:border-accent hover:text-white hover:bg-accent/10"
                    >
                        Dismiss
                    </button>
                </div>

                <div className="grid gap-8 sm:grid-cols-[200px,1fr] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="space-y-4">
                        <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--muted)] border-b border-[var(--border)] pb-2">Series Stats</p>
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest">Hype</span>
                                    <span className="text-xs font-black text-accent italic">{anime.hype_score}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest">Cost</span>
                                    <span className="text-xs font-black text-white italic">{anime.cost_kp?.toLocaleString()} KP</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest">Rating</span>
                                    <span className="text-xs font-black text-yellow-500 italic">{anime.average_score || '??'}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl border border-accent/20 bg-accent/5">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white mb-2">Analysis</p>
                            <p className="text-[10px] text-[var(--muted)] leading-relaxed font-medium">
                                Show values update daily based on community activity.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">About the Series</p>
                            <div className="text-[12px] text-[var(--muted)] leading-relaxed font-medium bg-white/[0.02] p-5 rounded-2xl border border-white/5">
                                {(anime as any).description?.replace(/<[^>]*>/g, '') || "No synopsis available."}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                                <p className="font-black text-white border-b border-white/5 pb-2">Price Ranges</p>
                                <div className="flex justify-between items-center">
                                    <span>High Point</span>
                                    <span className="font-black text-white">{historyInsights.high?.toLocaleString() ?? latest.price} KP</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>Low Point</span>
                                    <span className="font-black text-white">{historyInsights.low?.toLocaleString() ?? latest.price} KP</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-white/5 pt-2">
                                    <span>Avg Value</span>
                                    <span className="font-black text-accent">{historyInsights.avg?.toLocaleString() ?? latest.price} KP</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                                <p className="font-black text-white border-b border-white/5 pb-2">Price History</p>
                                <div className="space-y-2">
                                    {previewData.length ? (
                                        previewData.map((entry, index) => {
                                            const item = formatHistoryEntry(entry);
                                            return (
                                                <div key={`${anime.id}-hist-${index}`} className="flex items-center justify-between text-white/80">
                                                    <span>{item.label.split(',')[0]}</span>
                                                    <span className="font-black italic">{item.price} KP</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-[9px] text-[var(--muted)] italic">No history yet.</p>
                                    )}
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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
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
        setCurrentPage(1);
        await fetchData({ skipLoading: true, direction: nextDirection });
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filtered = data.filter(a =>
        !(a as any).is_adult && (
            a.title_romaji.toLowerCase().includes(search.toLowerCase()) ||
            a.title_english?.toLowerCase().includes(search.toLowerCase())
        )
    );

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <AppShell>
            <div className="space-y-10 pb-20">
                {/* Header HUD */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent shadow-lg shadow-accent/10">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] leading-none">Hype Index</h1>
                            <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-2 opacity-60">
                                Real-time operational intelligence • Market trending
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full md:flex-row md:items-center md:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] transition-colors group-focus-within:text-accent" size={16} />
                                <input
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                    placeholder="Find a ticker..."
                                    className="bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-2xl pl-12 pr-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-accent/40 focus:bg-accent/5 transition-all w-full md:w-64 shadow-sm"
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                            {TIME_RANGES.map(range => (
                                <button
                                    key={range.key}
                                    onClick={() => setActiveRange(range.key)}
                                    className={`px-4 py-2 text-[9px] font-black uppercase tracking-[0.4em] rounded-2xl transition-all ${activeRange === range.key ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'border border-[var(--border)] text-[var(--muted)] hover:border-accent/40 hover:text-[var(--foreground)] bg-[var(--surface)]'}`}
                                >
                                    {range.label}
                                </button>
                            ))}
                            <button
                                onClick={toggleSortDirection}
                                className="flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-[0.4em] rounded-2xl transition-all border border-[var(--border)] text-[var(--muted)] hover:border-accent/40 hover:text-[var(--foreground)] bg-[var(--surface)]"
                            >
                                <ArrowDownUp size={14} className="text-[var(--muted)]" />
                                <span>{sortDirection === 'desc' ? 'Hype ↓' : 'Hype ↑'}</span>
                            </button>
                            <button
                                onClick={refreshIndex}
                                disabled={refreshing}
                                className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-[var(--muted)] hover:text-[var(--foreground)] hover:border-accent/20 transition-all cursor-pointer shadow-sm disabled:opacity-50"
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
                        <div key={i} className={`p-6 rounded-3xl border ${item.bg} flex items-start gap-4 shadow-xl transition-transform hover:-translate-y-1`}>
                            <div className={`p-3 rounded-xl bg-black/20 ${item.color}`}>
                                <item.icon size={20} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-black uppercase tracking-tighter text-[var(--foreground)] italic">{item.label}</p>
                                <p className="text-[10px] font-bold text-[var(--muted)] leading-relaxed uppercase tracking-widest opacity-70">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Ticker Table */}
                <div className="flex flex-col gap-6">
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-xl transition-all h-[600px] flex flex-col">
                        <div className="overflow-x-hidden overflow-y-auto flex-grow custom-scrollbar">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="sticky top-0 z-20 bg-[var(--background)] border-b border-[var(--border)]">
                                    <tr>
                                        <th className="w-20 px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">#</th>
                                        <th className="w-[35%] px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Anime / Ticker</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Hype Score</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">{rangeInfo.label} Change</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Market Price</th>
                                        <th className="w-32 px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="py-40 text-center">
                                                <Loader2 className="animate-spin mx-auto text-accent mb-4" size={32} />
                                                <p className="text-[10px] font-black uppercase text-[var(--muted)] tracking-[0.3em]">Downloading Market Data...</p>
                                            </td>
                                        </tr>
                                    ) : paginatedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-40 text-center text-[var(--muted)] font-black uppercase text-xs tracking-widest italic opacity-40">No matching tickers found</td>
                                        </tr>
                                    ) : paginatedData.map((anime, index) => {
                                        const globalIndex = (currentPage - 1) * itemsPerPage + index;
                                        const rowNumber = sortDirection === 'desc' 
                                            ? globalIndex + 1 
                                            : filtered.length - globalIndex;
                                            
                                        const currentPrice = anime.cost_kp ?? 2500;
                                        const change = getHistoryChange(anime.hype_history, rangeInfo.ms, currentPrice);
                                        const isPositive = change.percent >= 0;

                                    return (
                                        <motion.tr
                                            key={anime.id}
                                            initial={{ opacity: 0 }}
                                            whileInView={{ opacity: 1 }}
                                            viewport={{ once: true }}
                                            className="hover:bg-accent/[0.03] transition-colors group cursor-pointer border-b border-white/[0.02]"
                                            onClick={() => setSelectedAnime(anime)}
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">{rowNumber}</span>
                                                    {!anime.is_eligible && (
                                                        <span className="text-[7px] font-black uppercase text-accent/60 bg-accent/5 px-1.5 py-0.5 rounded-md border border-accent/10 whitespace-nowrap" title="Banned from Draft: Overhyped/Legacy">Legacy</span>
                                                    )}
                                                </div>
                                            </td>
                                                <td className="px-8 py-5 min-w-0">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative w-10 h-14 flex-shrink-0">
                                                            <img src={anime.cover_image} alt={`${anime.title_romaji} cover`} className="w-full h-full object-cover rounded-xl shadow-lg border border-[var(--border)] group-hover:scale-105 transition-transform duration-500" />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[11px] font-black uppercase tracking-tight text-[var(--foreground)] group-hover:text-accent transition-colors truncate w-full italic leading-tight" title={anime.title_english || anime.title_romaji}>
                                                                {anime.title_english || anime.title_romaji}
                                                            </p>
                                                            <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest mt-1 truncate opacity-60">
                                                                {anime.title_english ? anime.title_romaji : `Ticker: $${anime.id}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-16 bg-[var(--background)] h-1 rounded-full overflow-hidden border border-[var(--border)]">
                                                            <div className="h-full bg-accent shadow-[0_0_8px_var(--accent)]" style={{ width: `${(anime.hype_score / 1000) * 100}%` }}></div>
                                                        </div>
                                                        <span className="text-[10px] font-black italic text-accent">{anime.hype_score}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col gap-1">
                                                        <div className={`flex items-center gap-1.5 font-black text-[10px] italic ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                            {change.percent >= 0 ? '+' : ''}{change.percent}%
                                                        </div>
                                                        <span className="text-[7px] uppercase tracking-[0.5em] text-[var(--muted)] opacity-50">
                                                            Δ{change.delta.toLocaleString()} KP
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <Zap size={12} className="text-yellow-500" />
                                                        <span className="text-[11px] font-black text-[var(--foreground)] italic tracking-tighter">{currentPrice.toLocaleString()} KP</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-[0.1em] border ${anime.status === 'RELEASING' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
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

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-8 py-6 bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] shadow-xl">
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--muted)]">
                                Showing <span className="text-accent">{paginatedData.length}</span> of <span className="text-white">{filtered.length}</span> assets
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:text-accent hover:border-accent/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                
                                <div className="flex items-center gap-2">
                                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                        let pageNum = currentPage;
                                        if (totalPages > 5) {
                                            if (currentPage <= 3) pageNum = i + 1;
                                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                            else pageNum = currentPage - 2 + i;
                                        } else {
                                            pageNum = i + 1;
                                        }

                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all cursor-pointer ${currentPage === pageNum ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'border border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:text-accent hover:border-accent/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {selectedAnime && <AnimeDetailModal anime={selectedAnime} onClose={() => setSelectedAnime(null)} />}
        </AppShell>
    );
}

function ChevronLeft({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
    );
}

function ChevronRight({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
    );
}
