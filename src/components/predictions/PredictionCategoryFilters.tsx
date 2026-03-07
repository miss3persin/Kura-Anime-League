"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils'; // Assuming this utility exists
import type { PredictionFilterType } from '@/lib/types/predictions';

interface PredictionCategoryFiltersProps {
  currentFilter: PredictionFilterType;
  onFilterChange: (filter: PredictionFilterType) => void;
}

export const PredictionCategoryFilters: React.FC<PredictionCategoryFiltersProps> = ({
  currentFilter,
  onFilterChange,
}) => {
  const filters: Array<{ key: PredictionFilterType; label: string }> = [
    { key: 'upcoming', label: 'Open Bets' },
    { key: 'active_bets', label: 'My Active Bets' },
    { key: 'past_bets', label: 'My Past Bets' },
  ];

  return (
    <div className="flex bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] shadow-sm">
      {filters.map((filter) => (
        <motion.button
          key={filter.key}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onFilterChange(filter.key)}
          className={cn(
            "flex-1 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
            currentFilter === filter.key
              ? 'bg-accent text-white shadow-md shadow-accent/20'
              : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
          )}
        >
          {filter.label}
        </motion.button>
      ))}
    </div>
  );
};
