"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Medal, Gem, Calendar } from 'lucide-react';
import { type ProfileData } from '@/app/api/profile/[id]/route';

interface ProfileHeaderProps {
  user: ProfileData['user'];
}

const StatItem: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 flex items-center justify-center bg-accent/10 text-accent rounded-full border border-accent/20">
      {icon}
    </div>
    <div>
      <p className="text-xs text-[var(--muted)] font-semibold">{label}</p>
      <p className="font-bold text-sm text-[var(--foreground)]">{value}</p>
    </div>
  </div>
);

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user }) => {
  const joinDate = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-lg"
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Avatar */}
        <motion.div whileHover={{ scale: 1.05 }} className="relative shrink-0">
          <img
            src={user.avatar_url}
            alt="User Avatar"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-accent shadow-md"
          />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-accent text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-[var(--surface)]">
            {user.level}
          </div>
        </motion.div>

        {/* User Info */}
        <div className="flex-grow text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-black uppercase italic font-outfit text-[var(--foreground)]">
            {user.username}
          </h1>
          <p className="text-sm text-accent font-bold uppercase tracking-widest">
            {user.tier} Tier
          </p>
          
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[var(--border)] pt-4">
            <StatItem 
              icon={<Gem size={16} />} 
              label="Total KP" 
              value={user.total_kp.toLocaleString()} 
            />
            <StatItem 
              icon={<Medal size={16} />} 
              label="Level" 
              value={user.level} 
            />
            <StatItem 
              icon={<Calendar size={16} />} 
              label="Joined" 
              value={joinDate}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
