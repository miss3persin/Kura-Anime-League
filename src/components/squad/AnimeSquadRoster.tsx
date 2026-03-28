"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { AnimeSquadCard } from './AnimeSquadCard';
import { type SquadData } from '@/app/api/squad/route';

interface AnimeSquadRosterProps {
  animePicks: SquadData['anime_picks'];
  onAssignRole: (animeId: number | null, role: 'captain' | 'vice_captain' | 'clear_captain' | 'clear_vice_captain') => Promise<void>;
  transferMode: boolean;
  onSelectForTransfer: (animeId: number) => void;
  transferOut: SquadData['anime_picks'][number] | null;
  isSaving: boolean;
}

export const AnimeSquadRoster: React.FC<AnimeSquadRosterProps> = ({
  animePicks,
  onAssignRole,
  transferMode,
  onSelectForTransfer,
  transferOut,
  isSaving,
}) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] px-1 flex items-center gap-2">
        <Zap size={18} className="text-accent fill-accent" />
        My Team
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {animePicks.map((anime) => (
          <AnimeSquadCard
            key={anime.id}
            anime={anime}
            onAssignRole={onAssignRole}
            transferMode={transferMode}
            onSelectForTransfer={onSelectForTransfer}
            isSelectedForTransfer={transferOut?.id === anime.id}
            isSaving={isSaving}
          />
        ))}
        {/* Placeholder for empty slots if less than 5 picks */}
        {Array.from({ length: Math.max(0, 5 - animePicks.length) }).map((_, i) => (
            <motion.div
                key={`placeholder-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="bg-[var(--surface)] border-2 border-dashed border-[var(--border)] rounded-2xl md:rounded-3xl aspect-[3/4] flex flex-col items-center justify-center p-4 md:p-6 opacity-30 shadow-sm"
            >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-[var(--border)] flex items-center justify-center mb-1 md:mb-2 text-base md:text-xl text-[var(--muted)]">+</div>
                <p className="text-[6px] md:text-[7px] font-black uppercase text-[var(--muted)] tracking-widest">Empty Slot</p>
            </motion.div>
        ))}
      </div>
    </div>
  );
};
