"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { type SquadData } from '@/app/api/squad/route';
import { CharacterSquadCard } from './CharacterSquadCard';

interface CharacterSquadRosterProps {
  characterPicks: SquadData['character_picks'];
}

export const CharacterSquadRoster: React.FC<CharacterSquadRosterProps> = ({ characterPicks }) => {
  // Ensure we have a Star Character and a Waifu/Husbando (or null placeholders)
  const starChar = characterPicks.find(c => c.pick_type === 'STAR_CHAR') || null;
  const waifuHusbando = characterPicks.find(c => c.pick_type === 'WAIFU_HUSBANDO') || null;

  return (
    <div className="space-y-4 md:space-y-6">
      <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] px-1 flex items-center gap-2">
        <Star size={18} className="text-accent fill-accent" />
        Character Picks
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <CharacterSquadCard character={starChar} pickType="STAR_CHAR" />
        <CharacterSquadCard character={waifuHusbando} pickType="WAIFU_HUSBANDO" />
      </div>
    </div>
  );
};

