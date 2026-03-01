"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
    Zap, Trophy, Dice6, CheckCircle,
    AlertCircle, Target, Loader2, Sparkles, Info
} from "lucide-react";

interface Prediction {
    id: string;
    prediction_type: string;
    anime_id: number;
    predicted_value: string;
    kp_wager: number;
    is_resolved: boolean;
    is_correct: boolean;
    kp_earned: number;
    anime?: { title_romaji: string; title_english?: string; cover_image: string };
}

interface User {
    id: string;
    email?: string;
}

interface Profile {
    id: string;
    total_kp: number;
}

interface Anime {
    id: number;
    title_romaji: string;
    cover_image: string;
    hype_score: number;
}

interface SeasonContextData {
    phase: string;
    deadline: string | null;
    deadlineLabel: string | null;
    activeSeason: { name?: string | null; id: string | number } | null;
    upcomingSeason: { name?: string | null; id: string | number } | null;
    currentWeek: number;
    totalWeeks: number;
}

export default function PredictPage() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [trendingAnime, setTrendingAnime] = useState<Anime[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'ok' | 'err', text: string } | null>(null);
    const [seasonContext, setSeasonContext] = useState<SeasonContextData | null>(null);

    // New Prediction Form
    const [wagerType, setWagerType] = useState('SCORE_OVER');
    const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
    const [amount, setAmount] = useState(500);

    const loadSeasonContext = useCallback(async () => {
        try {
            const res = await fetch('/api/seasons/current');
            if (!res.ok) throw new Error('Failed to fetch season data');
            const data = await res.json();
            setSeasonContext(data as SeasonContextData);
        } catch (error: unknown) {
            console.error('Unable to load season context:', error);
        }
    }, []);

    const init = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setLoading(false); return; }
        setUser(session.user as User);

        const { data: prof } = await supabase.from('profiles').select('id, total_kp').eq('id', session.user.id).single();
        if (prof) setProfile(prof as Profile);

        const { data: preds } = await supabase
            .from('predictions')
            .select('*, anime:anime_cache(title_romaji, title_english, cover_image)')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (preds) setPredictions(preds as unknown as Prediction[]);

        const { data: trending } = await supabase
            .from('anime_cache')
            .select('id, title_romaji, cover_image, hype_score')
            .order('hype_score', { ascending: false })
            .limit(10);
        if (trending) {
            const casted = trending as unknown as Anime[];
            setTrendingAnime(casted);
            if (casted.length > 0) setSelectedAnimeId(casted[0].id);
        }

        await loadSeasonContext();

        setLoading(false);
    }, [loadSeasonContext]);

    useEffect(() => {
        init();
    }, [init]);

    const handlePredict = async () => {
        if (!user || !profile || !selectedAnimeId) return;
        if (profile.total_kp < amount) {
            setMessage({ type: 'err', text: 'Insufficient KP balance for this wager.' });
            return;
        }

        const seasonId = seasonContext?.activeSeason?.id ?? seasonContext?.upcomingSeason?.id;
        if (!seasonId) {
            setMessage({ type: 'err', text: 'Season data is still syncing. Try again in a moment.' });
            return;
        }

        const weekNumber = seasonContext?.currentWeek ?? 1;

        setSubmitting(true);
        const { error } = await supabase.from('predictions').insert({
            user_id: user.id,
            season_id: seasonId,
            week_number: weekNumber,
            prediction_type: wagerType,
            anime_id: selectedAnimeId,
            predicted_value: predictedVal,
            kp_wager: amount
        });

        if (!error) {
            await supabase.rpc('increment_kp', { user_id: user.id, amount: -amount });
            setMessage({ type: 'ok', text: 'Prediction locked. Fate is sealed.' });
            init();
        } else {
            setMessage({ type: 'err', text: 'Market interference. You already have a prediction for this type.' });
        }
        setSubmitting(false);
        setTimeout(() => setMessage(null), 3000);
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
                <div className="flex flex-col items-center justify-center py-48 space-y-8 bg-[var(--surface)] rounded-[3rem] border border-dashed border-[var(--border)] p-12 text-center">
                    <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center text-accent ring-4 ring-accent/10">
                        <Dice6 size={40} />
                    </div>
                    <div className="space-y-4 max-w-md">
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Market Restricted</h3>
                        <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                            Prediction markets are exclusive to registered KAL members. Join the league to start wagering.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/login')}
                        className="px-10 py-5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-accent/20"
                    >
                        Log In to Predict
                    </button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-10">
                {/* Header HUD */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                            <Dice6 size={24} />
                        </div>
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">Predictions</h1>
                        <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-1">
                            Wager your KuraPoints on seasonal outcomes
                        </p>
                        <p className="text-[9px] uppercase tracking-[0.4em] text-[var(--muted)] mt-1">
                            {seasonLoading
                                ? 'Loading season info...'
                                : `${seasonContext?.activeSeason?.name ?? seasonContext?.upcomingSeason?.name ?? 'Season TBD'} • Week ${seasonContext?.currentWeek ?? 1}`
                            }
                        </p>
                    </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-6 py-3 shadow-md">
                            <p className="text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Your Wallet</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Zap size={14} className="text-accent" />
                                <span className="text-sm font-black text-[var(--foreground)] italic">{profile?.total_kp.toLocaleString() || 0} KP</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Active Predictions List */}
                    <div className="lg:col-span-2 space-y-6">
                        <h3 className="text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">Current Bets</h3>

                        {loading ? (
                            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
                        ) : predictions.length === 0 ? (
                            <div className="bg-[var(--surface)] border border-[var(--border)] border-dashed rounded-[2.5rem] p-20 text-center flex flex-col items-center">
                                <Target size={48} className="text-[var(--muted)] opacity-30 mb-6" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">No active wagers. Place your first bet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {predictions.map(pred => (
                                    <motion.div key={pred.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 flex gap-4 shadow-sm hover:border-accent/30 transition-all group">
                                        <img src={pred.anime?.cover_image} className="w-12 h-16 object-cover rounded-xl" alt={pred.anime?.title_romaji || 'Anime cover'} />
                                        <div className="grow space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${pred.is_resolved ? 'bg-[var(--surface-hover)] text-[var(--muted)]' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                                    {pred.is_resolved ? 'COMPLETED' : 'PENDING'}
                                                </span>
                                                <span className="text-[10px] font-black text-[var(--muted)] italic group-hover:text-[var(--foreground)] transition-colors">{pred.kp_wager} KP</span>
                                            </div>
                                            <h4 className="text-[10px] font-black uppercase truncate text-[var(--foreground)] italic" title={pred.anime?.title_english || pred.anime?.title_romaji}>
                                                {pred.anime?.title_english || pred.anime?.title_romaji}
                                            </h4>
                                            <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest line-clamp-1 italic">
                                                {pred.anime?.title_english ? pred.anime?.title_romaji : pred.prediction_type.replace('_', ' ')}
                                            </p>
                                            {pred.is_resolved && (
                                                <div className={`mt-2 flex items-center gap-2 ${pred.is_correct ? 'text-green-500' : 'text-red-500'}`}>
                                                    {pred.is_correct ? <Trophy size={10} /> : <AlertCircle size={10} />}
                                                    <span className="text-[8px] font-black uppercase italic">
                                                        {pred.is_correct ? `WON +${pred.kp_earned} KP` : 'Landed Incorrect'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Place Bet Sidebar */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">The Sportsbook</h3>

                        <div className="bg-[var(--surface)] p-8 rounded-[2.5rem] border border-[var(--border)] space-y-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-[var(--muted)]"><Dice6 size={140} /></div>

                            <div className="space-y-6 relative z-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Pick Target</label>
                                    <select
                                        value={selectedAnimeId || ''}
                                        onChange={e => setSelectedAnimeId(parseInt(e.target.value))}
                                        className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest appearance-none focus:outline-none focus:border-accent"
                                    >
                                        {trendingAnime.map(a => <option key={a.id} value={a.id}>{a.title_english || a.title_romaji}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Bet Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'SCORE_OVER', label: 'Score Over' },
                                            { id: 'WILL_BREAK', label: 'On Hiatus?' },
                                            { id: 'TOP_5', label: 'Hot Top 5' },
                                            { id: 'USER_DUEL', label: 'User Duel' }
                                        ].map(t => (
                                            <button key={t.id} onClick={() => setWagerType(t.id)} className={`py-3 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${wagerType === t.id ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-[var(--background)] border-[var(--border)] hover:border-accent/40 text-[var(--muted)] hover:text-[var(--foreground)]'}`}>
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Wager Amount</label>
                                        <span className="text-[10px] font-black text-accent italic">{amount} KP</span>
                                    </div>
                                    <input
                                        type="range" min="100" max="5000" step="100"
                                        value={amount} onChange={e => setAmount(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg appearance-none cursor-pointer accent-accent"
                                    />
                                </div>

                                <div className="pt-4">
                                    {message && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mb-4 p-3 rounded-lg text-[8px] font-black uppercase italic ${message.type === 'ok' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                            {message.text}
                                        </motion.div>
                                    )}
                                    <button
                                        onClick={handlePredict}
                                        disabled={submitting || !user}
                                        className="w-full py-5 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {submitting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                        {submitting ? 'SEALING FATE...' : 'LOCK PREDICTION'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-accent/5 rounded-[2rem] border border-accent/10 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center text-accent shrink-0"><Info size={16} /></div>
                            <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest leading-relaxed">Predictions are settled every Friday at 12:00 UTC during the League Sync. Correct wagers pay out 2.5x - 5.0x based on odds.</p>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
