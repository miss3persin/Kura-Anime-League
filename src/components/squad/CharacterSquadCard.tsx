"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Plus } from 'lucide-react';
import { type SquadCharacterPick } from '@/app/api/squad/route';
import Link from 'next/link';
import { cn } from '@/lib/utils'; // Assuming this utility exists

interface CharacterSquadCardProps {
  character: SquadCharacterPick | null;
  pickType: 'STAR_CHAR' | 'WAIFU_HUSBANDO';
  transferMode?: boolean;
  selected?: boolean;
  onSelect?: (pickType: 'STAR_CHAR' | 'WAIFU_HUSBANDO', characterId: number | null) => void;
}

export const CharacterSquadCard: React.FC<CharacterSquadCardProps> = ({ character, pickType, transferMode = false, selected = false, onSelect }) => {
  const isStarChar = pickType === 'STAR_CHAR';
  const roleLabel = isStarChar ? 'Featured Character' : 'Character Pick';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => transferMode && onSelect?.(pickType, character?.id ?? null)}
      className={cn(
        "bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-3xl p-4 md:p-5 flex items-center gap-4 md:gap-5 shadow-sm",
        transferMode ? "cursor-pointer hover:border-accent/60" : "",
        selected ? "border-accent ring-2 ring-accent/20" : ""
      )}
    >
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl overflow-hidden border-2 border-white/5 bg-[var(--background)] shrink-0">
        {character ? (
          <img src={character.image} className="w-full h-full object-cover" alt={character.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)]/20">
            <Plus size={24} />
          </div>
        )}
      </div>
      <div className="min-w-0 grow">
        <p className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-accent mb-0.5 md:mb-1">{roleLabel}</p>
        {character ? (
          <div className="space-y-0.5 md:space-y-1">
            <h4 className="text-[11px] md:text-sm font-black uppercase truncate text-[var(--foreground)] italic leading-tight">{character.name}</h4>
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-[7px] md:text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest truncate">{character.role}</span>
              {character.favorites !== undefined && (
                <>
                  <Heart size={8} className="text-pink-500 fill-pink-500 shrink-0" />
                  <span className="text-[7px] md:text-[8px] font-bold text-pink-500">{character.favorites.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <Link href="/draft" className="text-[9px] md:text-[10px] font-black uppercase text-[var(--muted)] hover:text-accent transition-colors">
            Pick a {isStarChar ? 'featured character' : 'character'}
          </Link>
        )}
      </div>
    </motion.div>
  );
};

