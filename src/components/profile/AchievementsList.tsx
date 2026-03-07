"use client";

import React from 'react';
import { type ProfileData } from '@/app/api/profile/[id]/route';
import { AchievementBadge } from './AchievementBadge';
import { Award } from 'lucide-react';

interface AchievementsListProps {
  achievements: ProfileData['achievements'];
}

export const AchievementsList: React.FC<AchievementsListProps> = ({ achievements }) => {
  return (
    <div>
      <h2 className="text-xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)] mb-4 flex items-center gap-2">
        <Award size={20} className="text-yellow-500" />
        Achievements
      </h2>
      {achievements.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {achievements.map((ach) => (
            <AchievementBadge key={ach.id} achievement={ach} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 px-4 bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl">
          <p className="text-sm font-medium text-[var(--muted)]">No achievements unlocked yet.</p>
        </div>
      )}
    </div>
  );
};
