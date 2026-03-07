"use client";

import React from 'react';
import { type ProfileData } from '@/app/api/profile/[id]/route';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface LeaguesListProps {
  leagues: ProfileData['leagues'];
}

export const LeaguesList: React.FC<LeaguesListProps> = ({ leagues }) => {
  return (
    <div>
      <h2 className="text-xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)] mb-4 flex items-center gap-2">
        <Users size={20} className="text-accent" />
        My Leagues
      </h2>
      {leagues.length > 0 ? (
        <div className="space-y-3">
          {leagues.map((league, index) => (
            <motion.div
                key={league.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-accent/50 transition-all"
            >
              <p className="font-bold text-sm text-[var(--foreground)]">{league.name}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 px-4 bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
          <p className="text-sm font-medium text-[var(--muted)]">Not a member of any leagues yet.</p>
        </div>
      )}
    </div>
  );
};
