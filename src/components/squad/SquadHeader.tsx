"use client";

import React from 'react';
import { Shield, ArrowLeftRight, Coins, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { type SquadData } from '@/app/api/squad/route';

interface SquadHeaderProps {
  squadData: SquadData;
}

export const SquadHeader: React.FC<SquadHeaderProps> = ({ squadData }) => {
  const {
    remaining_kp,
    remaining_kp_calculated,
    transfers_used,
    free_transfers,
    weekly_score,
    current_week_number,
    team_value_base,
    team_value_boost,
    team_value_total,
  } = squadData;

  const totalSquadValue = team_value_total ?? squadData.anime_picks.reduce((sum, pick) => sum + pick.cost_kp, 0);
  const baseValue = team_value_base ?? totalSquadValue;
  const boostValue = team_value_boost ?? 0;
  const kpLeft = remaining_kp_calculated ?? remaining_kp;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[var(--surface)] p-6 md:p-8 rounded-2xl md:rounded-[2rem] border border-[var(--border)] shadow-2xl backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-6"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-accent/20 flex items-center justify-center text-accent shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">My Team</h1>
            <div className="flex items-center gap-2 md:gap-3 mt-0.5 md:mt-1">
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Week {current_week_number || 1}</span>
              <div className="w-1 h-1 rounded-full bg-[var(--border)]"></div>
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-accent">{kpLeft?.toLocaleString() || 0} KP Left</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl md:rounded-2xl px-4 py-2.5 flex flex-col items-center justify-center shadow-sm">
            <Coins size={16} className="text-yellow-500 mb-1" />
            <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Team Value</p>
            <p className="text-xs md:text-sm font-black text-[var(--foreground)]">{totalSquadValue.toLocaleString()} KP</p>
            {boostValue > 0 && (
              <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-accent mt-1">
                Base {baseValue.toLocaleString()} + Boost {boostValue.toLocaleString()}
              </p>
            )}
        </div>
        <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl md:rounded-2xl px-4 py-2.5 flex flex-col items-center justify-center shadow-sm">
            <ArrowLeftRight size={16} className="text-blue-500 mb-1" />
            <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--muted)]">Transfers</p>
            <p className="text-xs md:text-sm font-black text-[var(--foreground)]">{transfers_used}/{free_transfers}</p>
        </div>
        {weekly_score !== null && (
            <div className="bg-accent text-white rounded-xl md:rounded-2xl px-4 py-2.5 flex flex-col items-center justify-center shadow-lg col-span-2 sm:col-span-1">
                <Zap size={16} className="text-white mb-1" />
                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.1em] opacity-80">Last Week</span>
                <span className="text-sm md:text-base font-black italic">{weekly_score} PTS</span>
            </div>
        )}
      </div>
    </motion.div>
  );
};

