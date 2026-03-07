"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface KPBalanceDisplayProps {
  balance: number;
}

export const KPBalanceDisplay: React.FC<KPBalanceDisplayProps> = ({ balance }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-xl md:rounded-2xl px-4 md:px-6 py-2 md:py-3 shadow-md flex items-center gap-2"
    >
      <Zap size={16} className="text-accent" />
      <div className="flex flex-col">
        <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Your Balance</p>
        <span className="text-xs md:text-sm font-black text-[var(--foreground)] italic">{balance.toLocaleString()} KP</span>
      </div>
    </motion.div>
  );
};
