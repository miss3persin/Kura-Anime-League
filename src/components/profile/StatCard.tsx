"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, className }) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4 shadow-md transition-colors hover:border-accent/50 ${className}`}
    >
      <div className="w-10 h-10 flex items-center justify-center text-accent bg-accent/10 rounded-lg border border-accent/20">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-[var(--foreground)] font-outfit italic">
          {value}
        </p>
      </div>
    </motion.div>
  );
};
