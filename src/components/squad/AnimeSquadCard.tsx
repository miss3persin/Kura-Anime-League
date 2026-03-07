"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { type SquadAnimePick } from '@/app/api/squad/route';
import { getHistoryChange } from '@/lib/hype';
import { cn } from '@/lib/utils'; // Assuming this utility exists

interface AnimeSquadCardProps {
  anime: SquadAnimePick;
  onAssignRole: (animeId: number | null, role: 'captain' | 'vice_captain' | 'clear_captain' | 'clear_vice_captain') => Promise<void>;
  transferMode: boolean;
  onSelectForTransfer: (animeId: number) => void;
  isSelectedForTransfer: boolean;
  isSaving: boolean;
}

export const AnimeSquadCard: React.FC<AnimeSquadCardProps> = ({
  anime,
  onAssignRole,
  transferMode,
  onSelectForTransfer,
  isSelectedForTransfer,
  isSaving,
}) => {
  const change = getHistoryChange(anime.hype_history, 1000 * 60 * 60 * 24, anime.cost_kp);
  const isPositiveChange = change.percent >= 0;

  const handleToggleCaptain = async () => {
    await onAssignRole(anime.is_captain ? null : anime.id, anime.is_captain ? 'clear_captain' : 'captain');
  };

  const handleToggleViceCaptain = async () => {
    await onAssignRole(anime.is_vice_captain ? null : anime.id, anime.is_vice_captain ? 'clear_vice_captain' : 'vice_captain');
  };

  const handleTransferSelection = () => {
    onSelectForTransfer(anime.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-[var(--surface)] border rounded-2xl md:rounded-3xl p-4 md:p-5 flex items-center gap-4 md:gap-5 transition-all shadow-sm",
        isSelectedForTransfer && "border-yellow-500 bg-yellow-500/5",
        isSaving && "opacity-70 cursor-not-allowed"
      )}
    >
      <div className="relative w-20 h-28 md:w-24 md:h-32 shrink-0 group">
        <img
          src={anime.cover_image}
          className="w-full h-full object-cover rounded-xl md:rounded-2xl shadow-lg transition-transform group-hover:scale-105"
          alt={anime.title_english || anime.title_romaji}
        />
        {(anime.is_captain || anime.is_vice_captain) && (
          <div
            className={cn(
              "absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center border-2 border-black shadow-lg",
              anime.is_captain ? "bg-yellow-500 text-black" : "bg-slate-400 text-black"
            )}
          >
            {anime.is_captain ? <Crown size={16} /> : <span className="text-[10px] md:text-[12px] font-black">VC</span>}
          </div>
        )}
      </div>

      <div className="grow min-w-0 space-y-2 md:space-y-3">
        <div>
          <h4 className="text-[11px] md:text-sm font-black uppercase truncate text-[var(--foreground)] italic">{anime.title_english || anime.title_romaji}</h4>
          <p className="text-[8px] md:text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest truncate opacity-60">{anime.genres?.[0] || 'Anime'}</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 md:gap-2">
            <Zap size={14} className="text-accent" />
            <span className="text-xs md:text-sm font-bold text-[var(--foreground)]">{anime.hype_score.toFixed(1)}</span>
          </div>
          <div className={cn("flex items-center gap-0.5 md:gap-1", isPositiveChange ? "text-green-500" : "text-red-500")}>
            {isPositiveChange ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span className="text-[8px] md:text-[9px] font-bold">{Math.abs(change.percent).toFixed(2)}%</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          {transferMode ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleTransferSelection}
              disabled={isSaving}
              className={cn(
                "w-full py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase border transition-all",
                isSelectedForTransfer
                  ? "bg-yellow-500 text-black border-yellow-500"
                  : "bg-[var(--background)] text-[var(--muted)] border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-yellow-500"
              )}
            >
              {isSelectedForTransfer ? 'Deselect' : 'Replace'}
            </motion.button>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleToggleCaptain}
                disabled={isSaving}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase transition-all",
                  anime.is_captain
                    ? "bg-yellow-500 text-black"
                    : "bg-[var(--background)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-yellow-500"
                )}
              >
                {anime.is_captain ? <Crown size={14} className="inline-block mr-1" /> : ''}
                Captain
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleToggleViceCaptain}
                disabled={isSaving}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase transition-all",
                  anime.is_vice_captain
                    ? "bg-slate-400 text-black"
                    : "bg-[var(--background)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-slate-400"
                )}
              >
                {anime.is_vice_captain ? <Crown size={14} className="inline-block mr-1" /> : ''}
                VC
              </motion.button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
