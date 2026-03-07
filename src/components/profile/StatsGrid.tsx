"use client";

import React from 'react';
import { Target, Trophy, Percent } from 'lucide-react';
import { type ProfileData } from '@/app/api/profile/[id]/route';
import { StatCard } from './StatCard';

interface StatsGridProps {
  stats: ProfileData['stats'];
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div>
        <h2 className="text-xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)] mb-4">
            Career Stats
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
                icon={<Trophy size={24} />}
                label="Seasons Played"
                value={stats.seasons_played}
            />
            <StatCard
                icon={<Target size={24} />}
                label="Best Finish"
                value={stats.best_season_finish ? `Rank #${stats.best_season_finish}` : 'N/A'}
            />
            <StatCard
                icon={<Percent size={24} />}
                label="Prediction Accuracy"
                value={`${stats.prediction_accuracy}%`}
            />
        </div>
    </div>
  );
};
