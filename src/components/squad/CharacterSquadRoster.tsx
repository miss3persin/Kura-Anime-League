"use client";

import React from 'react';
import { Star, HelpCircle } from 'lucide-react';
import { type SquadData } from '@/app/api/squad/route';
import { CharacterSquadCard } from './CharacterSquadCard';

interface CharacterSquadRosterProps {
  characterPicks: SquadData['character_picks'];
  transferMode?: boolean;
  selectedPickType?: 'STAR_CHAR' | 'WAIFU_HUSBANDO' | null;
  onSelectForTransfer?: (pickType: 'STAR_CHAR' | 'WAIFU_HUSBANDO', characterId: number | null) => void;
}

export const CharacterSquadRoster: React.FC<CharacterSquadRosterProps> = ({ characterPicks, transferMode = false, selectedPickType = null, onSelectForTransfer }) => {
  // Ensure we have a Star Character and a Waifu/Husbando (or null placeholders)
  const starChar = characterPicks.find(c => c.pick_type === 'STAR_CHAR') || null;
  const waifuHusbando = characterPicks.find(c => c.pick_type === 'WAIFU_HUSBANDO') || null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="px-1 flex items-center gap-2">
        <Star size={18} className="text-accent fill-accent" />
        <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">
          Character Picks
        </h3>
        <div className="relative group">
          <HelpCircle size={16} className="text-[var(--muted)]" />
          <div className="absolute z-20 hidden group-hover:block bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xl w-64 text-[10px] md:text-xs text-[var(--muted)]">
            Character Boost: Featured Character (Recruit) adds +50% of their price; Character Pick (Waifu/Husbando) adds +25% of their price.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <CharacterSquadCard
          character={starChar}
          pickType="STAR_CHAR"
          transferMode={transferMode}
          selected={selectedPickType === 'STAR_CHAR'}
          onSelect={onSelectForTransfer}
        />
        <CharacterSquadCard
          character={waifuHusbando}
          pickType="WAIFU_HUSBANDO"
          transferMode={transferMode}
          selected={selectedPickType === 'WAIFU_HUSBANDO'}
          onSelect={onSelectForTransfer}
        />
      </div>
    </div>
  );
};
