"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface AchievementBadgeProps {
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string;
  };
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({ achievement }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-center shadow-lg transition-colors hover:border-yellow-500/50 cursor-help"
    >
      <div className="text-4xl mb-2">{achievement.icon || '🏅'}</div>
      <h3 className="font-bold text-sm text-[var(--foreground)] uppercase tracking-tight">{achievement.name}</h3>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[var(--background)] text-[var(--foreground)] text-xs rounded-lg border border-[var(--border)] shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {achievement.description}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-[var(--background)]"></div>
      </div>
    </motion.div>
  );
};
