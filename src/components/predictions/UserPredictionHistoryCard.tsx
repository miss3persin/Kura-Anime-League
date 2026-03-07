"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Zap, Trophy, Info } from 'lucide-react';
import type { UserPrediction } from '@/lib/types/predictions';
import { cn } from '@/lib/utils'; // Assuming this utility exists

interface UserPredictionHistoryCardProps {
    prediction: UserPrediction;
}

export const UserPredictionHistoryCard: React.FC<UserPredictionHistoryCardProps> = ({ prediction }) => {
    const { prediction_event: event } = prediction;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "bg-[var(--surface)] border rounded-2xl md:rounded-3xl p-4 md:p-5 flex items-center gap-4 md:gap-5 shadow-sm",
                prediction.is_correct === true && "border-green-500/50 bg-green-500/5",
                prediction.is_correct === false && "border-red-500/50 bg-red-500/5"
            )}
        >
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
                <h3 className="text-[11px] md:text-sm font-black uppercase text-[var(--foreground)] italic line-clamp-2 leading-tight">
                    {event.title}
                </h3>
                <p className="text-[8px] md:text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest line-clamp-1 opacity-70">
                    Your pick: <span className="text-accent">{prediction.chosen_option_value}</span> / Wager: <span className="text-accent">{prediction.kp_wager} KP</span>
                </p>
                <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-bold uppercase tracking-widest">
                    {prediction.is_correct === true && (
                        <div className="flex items-center gap-1 text-green-500">
                            <CheckCircle size={12} /> CORRECT (<Trophy size={10} /> +{prediction.kp_earned} KP)
                        </div>
                    )}
                    {prediction.is_correct === false && (
                        <div className="flex items-center gap-1 text-red-500">
                            <AlertCircle size={12} /> INCORRECT
                        </div>
                    )}
                     {prediction.is_correct === null && (
                        <div className="flex items-center gap-1 text-blue-500">
                            <Info size={12} /> PENDING
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
