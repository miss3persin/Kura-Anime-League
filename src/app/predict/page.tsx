"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client"; // Still needed for session check
import {
    Loader2, Dice6, CheckCircle, AlertCircle, Info
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

import { PredictionCategoryFilters } from "@/components/predictions/PredictionCategoryFilters";
import { PredictionList } from "@/components/predictions/PredictionList";
import { KPBalanceDisplay } from "@/components/predictions/KPBalanceDisplay";
import type {
    PredictionEvent,
    PredictionsData,
} from "@/lib/types/predictions";

type Status = "loading" | "error" | "success" | "no_active_season";
type FilterType = 'upcoming' | 'active_bets' | 'past_bets';
type FlashMessage = { type: 'success' | 'error' | 'info'; text: string };

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export default function PredictPage() {
    const router = useRouter();
    const [status, setStatus] = useState<Status>("loading");
    const [predictionsData, setPredictionsData] = useState<PredictionsData | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [currentFilter, setCurrentFilter] = useState<FilterType>('upcoming');
    const [isPlacingBet, setIsPlacingBet] = useState(false);
    const [message, setMessage] = useState<FlashMessage | null>(null);


    const fetchPredictionsData = useCallback(async (userId: string) => {
        setStatus("loading");
        try {
            const response = await fetch(`/api/predictions?userId=${userId}`);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                if (Object.keys(errorBody).length > 0) {
                    console.error("Predictions API Error:", errorBody);
                }
                throw new Error(`Failed to fetch predictions data: ${errorBody.details || response.statusText}`);
            }
            const data: PredictionsData & { message?: string } = await response.json(); // API also returns message

            if (data.upcoming_events.length === 0 && data.active_user_predictions.length === 0 && data.past_user_predictions.length === 0 && data.message) {
                setPredictionsData(null);
                setMessage({ type: 'info', text: data.message });
                setStatus("no_active_season");
            } else {
                setPredictionsData(data);
                setStatus("success");
            }
        } catch (error: unknown) {
            console.error("Error fetching predictions:", error);
            setPredictionsData(null);
            setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to load predictions.') });
            setStatus("error");
        }
    }, []);

    // Initial load and session check
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setStatus("error"); // No user, cannot load predictions
                return;
            }
            setUser(session.user);
            fetchPredictionsData(session.user.id);
        };
        init();
    }, [fetchPredictionsData]);

    const handlePlaceBet = useCallback(async (
        event: PredictionEvent,
        chosenOptionValue: string,
        wagerAmount: number
    ) => {
        if (!user || !predictionsData) return;
        setIsPlacingBet(true);
        try {
            const response = await fetch('/api/predictions/place-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    eventId: event.id,
                    chosenOptionValue,
                    wagerAmount
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.details || errorBody.error || 'Failed to place bet.');
            }

            // Refetch predictions data to update UI
            await fetchPredictionsData(user.id);
            setMessage({ type: 'success', text: 'Bet placed successfully!' });
        } catch (error: unknown) {
            console.error("Place bet error:", error);
            setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to place bet.') });
        } finally {
            setIsPlacingBet(false);
            setTimeout(() => setMessage(null), 3000);
        }
    }, [user, predictionsData, fetchPredictionsData]);

    // Determine which list of predictions to display based on filter
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
                            <Dice6 size={40} />
                        </div>
                        <div className="space-y-4 max-w-md">
                            <h3 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Error Loading Predictions</h3>
                            <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                                {user ? (message?.text || 'There was an issue loading prediction data. Please try again.') : 'You must be authenticated to view prediction markets.'}
                            </p>
                        </div>
                        {!user && (
                            <button onClick={() => router.push('/login')} className="px-10 py-5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl">
                                Log In to Predict
                            </button>
                        )}
                    </div>
                );
            case "no_active_season":
                return (
                    <div className="flex flex-col items-center justify-center py-48 space-y-8 bg-[var(--surface)] rounded-[3rem] border border-dashed border-[var(--border)] p-12 text-center shadow-xl">
                        <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center text-accent ring-4 ring-accent/10">
                            <Dice6 size={40} />
                        </div>
                        <div className="space-y-4 max-w-md">
                            <h3 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Offseason</h3>
                            <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                                {message?.text || 'There is no active season for predictions yet. Check back soon!'}
                            </p>
                        </div>
                    </div>
                );
            case "success":
                if (!predictionsData) return null; // Should not happen with current logic, but a safeguard

                const userExistingPredictionIds = (() => {
                    const ids = new Set<string>();
                    predictionsData?.active_user_predictions.forEach(p => ids.add(p.prediction_event.id));
                    predictionsData?.past_user_predictions.forEach(p => ids.add(p.prediction_event.id));
                    return ids;
                })();

                const displayedPredictions = (() => {
                    switch (currentFilter) {
                        case 'upcoming':
                            return predictionsData.upcoming_events.filter(
                                (event) => !userExistingPredictionIds.has(event.id)
                            );
                        case 'active_bets': return predictionsData.active_user_predictions;
                        case 'past_bets': return predictionsData.past_user_predictions;
                        default: return [];
                    }
                })();

                return (
                    <div className="space-y-6 md:space-y-10">
                        {/* Header HUD */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-accent/20 flex items-center justify-center text-accent shrink-0">
                                    <Dice6 size={20} />
                                </div>
                                <div>
                                    <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] leading-none">Predictions</h1>
                                    <p className="text-[9px] md:text-xs text-[var(--muted)] font-bold uppercase tracking-widest mt-1">
                                        Wager KP on upcoming anime outcomes
                                    </p>
                                </div>
                            </div>
                            <KPBalanceDisplay balance={predictionsData.total_kp} />
                        </div>

                        {message && (
                            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={cn(
                                "p-4 rounded-xl border text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-3",
                                message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                'bg-blue-500/10 border-blue-500/20 text-blue-500' // Info message
                            )}>
                                {message.type === 'success' ? <CheckCircle size={14} /> : message.type === 'error' ? <AlertCircle size={14} /> : <Info size={14} />}
                                {message.text}
                            </motion.div>
                        )}

                        <div className="space-y-8 md:space-y-10">
                            {/* Filter Buttons */}
                            <PredictionCategoryFilters currentFilter={currentFilter} onFilterChange={setCurrentFilter} />

                            {/* Predictions List */}
                            <PredictionList
                                type={currentFilter}
                                predictions={displayedPredictions}
                                userKpBalance={predictionsData.total_kp}
                                onPlaceBet={handlePlaceBet}
                                isPlacingBet={isPlacingBet}
                                userExistingPredictionIds={userExistingPredictionIds}
                            />
                        </div>
                    </div>
                );
        }
    };

    return <AppShell>{renderContent()}</AppShell>;
}
