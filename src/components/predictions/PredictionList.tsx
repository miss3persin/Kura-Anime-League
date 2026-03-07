"use client";

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Dice6 } from 'lucide-react';
import { PredictionEventCard } from './PredictionEventCard';
import { UserPredictionHistoryCard } from './UserPredictionHistoryCard';
import type {
  PredictionEvent,
  PredictionFilterType,
  UserPrediction,
} from '@/lib/types/predictions';

interface PredictionListProps {
  type: PredictionFilterType;
  predictions: PredictionEvent[] | UserPrediction[];
  userKpBalance: number;
  onPlaceBet: (event: PredictionEvent, chosenOptionValue: string, wagerAmount: number) => Promise<void>;
  isPlacingBet: boolean;
  userExistingPredictionIds: Set<string>; // Set of event_ids for which user has already placed a bet
}

export const PredictionList: React.FC<PredictionListProps> = ({
  type,
  predictions,
  userKpBalance,
  onPlaceBet,
  isPlacingBet,
  userExistingPredictionIds,
}) => {
  const isUserPredictionList = type !== 'upcoming';

  if (predictions.length === 0) {
    let message = 'No predictions available.';
    if (type === 'upcoming') message = 'No open prediction bets right now.';
    if (type === 'active_bets') message = 'You have no active predictions.';
    if (type === 'past_bets') message = 'You have no past predictions.';

    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] border-dashed rounded-2xl md:rounded-[2.5rem] py-16 md:p-20 text-center flex flex-col items-center">
        <Dice6 size={32} className="text-[var(--muted)] opacity-30 mb-4 md:mb-6" />
        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">{message}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
      <AnimatePresence>
        {predictions.map((pred) => (
          isUserPredictionList ? (
            <UserPredictionHistoryCard key={pred.id} prediction={pred as UserPrediction} />
          ) : (
            <PredictionEventCard
              key={pred.id}
              event={pred as PredictionEvent}
              userKpBalance={userKpBalance}
              onPlaceBet={onPlaceBet}
              isPlacingBet={isPlacingBet}
              userAlreadyPredicted={userExistingPredictionIds.has(pred.id)}
            />
          )
        ))}
      </AnimatePresence>
    </div>
  );
};
