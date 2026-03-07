"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Zap, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { PredictionEvent } from '@/lib/types/predictions';
import { cn } from '@/lib/utils'; // Assuming this utility exists

interface PredictionEventCardProps {
    event: PredictionEvent;
    userKpBalance: number;
    onPlaceBet: (event: PredictionEvent, chosenOptionValue: string, wagerAmount: number) => Promise<void>;
    isPlacingBet: boolean;
    userAlreadyPredicted: boolean; // Indicates if user already bet on this event
}

export const PredictionEventCard: React.FC<PredictionEventCardProps> = ({
    event,
    userKpBalance,
    onPlaceBet,
    isPlacingBet,
    userAlreadyPredicted,
}) => {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [wagerAmount, setWagerAmount] = useState(500);
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setCurrentTime(Date.now());
        }, 60000);

        return () => window.clearInterval(intervalId);
    }, []);

    const deadlineDate = new Date(event.deadline);
    const timeLeft = deadlineDate.getTime() - currentTime;
    const isClosed = timeLeft <= 0;
    const maxWagerAmount = Math.max(100, Math.min(userKpBalance, 5000));
    const hasMinimumBalance = userKpBalance >= 100;

    const handleBet = async () => {
        if (!selectedOption || wagerAmount <= 0 || !hasMinimumBalance) {
            alert("Please select an option and enter a valid wager amount.");
            return;
        }
        await onPlaceBet(event, selectedOption, wagerAmount);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "bg-[var(--surface)] border rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-lg relative overflow-hidden",
                isClosed && "opacity-70 grayscale",
                userAlreadyPredicted && "border-green-500/50 bg-green-500/5"
            )}
        >
            <div className="flex gap-4 md:gap-5">
                <div className="w-20 h-28 md:w-24 md:h-32 shrink-0">
                    {event.anime_cover_image ? (
                        <img
                            src={event.anime_cover_image}
                            className="w-full h-full object-cover rounded-xl md:rounded-2xl shadow-lg"
                            alt={event.anime_title_english || event.anime_cover_image}
                        />
                    ) : (
                        <div className="w-full h-full rounded-xl md:rounded-2xl bg-[var(--background)] flex items-center justify-center text-[var(--muted)]/30">
                            <Zap size={24} />
                        </div>
                    )}
                </div>

                <div className="flex-grow min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[11px] md:text-sm font-black uppercase text-[var(--foreground)] italic line-clamp-2 leading-tight">
                            {event.title}
                        </h3>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            {userAlreadyPredicted && (
                                <div className="bg-green-500/10 text-green-500 text-[8px] font-black uppercase px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                                    <CheckCircle size={10} /> Placed
                                </div>
                            )}
                            {isClosed && (
                                <div className="bg-red-500/10 text-red-500 text-[8px] font-black uppercase px-2 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                                    <AlertCircle size={10} /> Closed
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-[8px] md:text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest line-clamp-2 opacity-70">
                        {event.description}
                    </p>
                    <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-bold text-accent uppercase tracking-widest">
                        <Clock size={12} />
                        <span>{isClosed ? 'CLOSED' : `Ends: ${deadlineDate.toLocaleDateString()}`}</span>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    {event.options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setSelectedOption(option.value)}
                            disabled={isClosed || userAlreadyPredicted || isPlacingBet}
                            className={cn(
                                "py-2 px-3 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border",
                                selectedOption === option.value
                                    ? 'bg-accent border-accent text-white shadow-md shadow-accent/20'
                                    : 'bg-[var(--background)] border-[var(--border)] text-[var(--muted)] hover:border-accent/30 hover:text-[var(--foreground)]',
                                (isClosed || userAlreadyPredicted || isPlacingBet) && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            {option.label} ({option.odds.toFixed(1)}x)
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Wager Amount</label>
                        <span className="text-[9px] md:text-[10px] font-black text-accent italic">{wagerAmount} KP</span>
                    </div>
                    <input
                        type="range" min="100" max={maxWagerAmount} step="100"
                        value={wagerAmount} onChange={e => setWagerAmount(parseInt(e.target.value))}
                        disabled={isClosed || userAlreadyPredicted || isPlacingBet || !hasMinimumBalance}
                        className={cn(
                            "w-full h-1 md:h-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg appearance-none cursor-pointer accent-accent",
                            (isClosed || userAlreadyPredicted || isPlacingBet || !hasMinimumBalance) && 'opacity-50 cursor-not-allowed'
                        )}
                    />
                    {!hasMinimumBalance && (
                        <p className="text-red-500 text-[7px] md:text-[8px] font-bold uppercase tracking-widest">You need at least 100 KP to place a bet.</p>
                    )}
                    {wagerAmount > userKpBalance && (
                        <p className="text-red-500 text-[7px] md:text-[8px] font-bold uppercase tracking-widest">Insufficient KP!</p>
                    )}
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleBet}
                    disabled={!selectedOption || wagerAmount > userKpBalance || isClosed || userAlreadyPredicted || isPlacingBet || !hasMinimumBalance}
                    className={cn(
                        "w-full py-3 md:py-4 bg-accent text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                >
                    {isPlacingBet ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    {isPlacingBet ? 'Placing Bet...' : 'Place Bet'}
                </motion.button>
            </div>
        </motion.div>
    );
};
