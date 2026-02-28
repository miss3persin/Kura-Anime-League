"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { NeonButton } from "@/components/ui/neon-button";
import { Heart, Coffee, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function SupportPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(true);

  const handleClose = () => {
    setIsModalOpen(false);
    router.push('/');
  };

  const tiers = [
    {
      name: "Fan",
      price: "$5",
      perks: ["Support development", "Server maintenance", "Developer Coffee"],
      best: false
    },
    {
      name: "Supporter",
      price: "$15",
      perks: ["Support development", "Server maintenance", "Much more coffee"],
      best: true
    },
    {
      name: "Legend",
      price: "$50",
      perks: ["Deep appreciation", "Direct impact on growth", "Endless gratitude"],
      best: false
    },
  ];

  return (
    <AppShell>
      <div className="relative min-h-[70vh]">
        <div className={`max-w-6xl mx-auto space-y-16 transition-all duration-700 ${isModalOpen ? 'blur-sm pointer-events-none opacity-40 select-none' : ''}`}>
          <div className="text-center space-y-4">
            <motion.h2
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-6xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]"
            >
              Support KAL
            </motion.h2>
            <p className="text-[var(--muted)] font-medium max-w-xl mx-auto uppercase tracking-widest text-xs">
              Join the community in keeping the servers alive.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tiers.map((tier, i) => (
              <motion.div
                key={i}
                className={`p-10 rounded-3xl border-2 relative flex flex-col transition-all ${tier.best
                  ? 'bg-[var(--surface)] border-accent shadow-2xl ring-4 ring-accent/5'
                  : 'bg-[var(--surface)] border-[var(--border)] shadow-xl'}`}
              >
                <h3 className="text-3xl font-black uppercase mb-1 text-[var(--foreground)]">{tier.name}</h3>
                <p className="text-4xl font-black mb-8 text-accent italic">{tier.price}</p>
                <ul className="space-y-4 mb-10 flex-grow">
                  {tier.perks.map((p, j) => (
                    <li key={j} className="text-sm flex items-center gap-3 text-[var(--muted)] font-medium cursor-default">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent opacity-60" /> {p}
                    </li>
                  ))}
                </ul>
                <NeonButton variant={tier.best ? 'solid' : 'outline'}>Support</NeonButton>
              </motion.div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {isModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[var(--background)]/60 backdrop-blur-sm z-10 rounded-3xl"
                onClick={handleClose}
              />

              <div className="absolute inset-0 z-20 flex items-center justify-center p-8 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 16 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                  className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] p-10 shadow-2xl overflow-hidden pointer-events-auto"
                >
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

                  <button
                    onClick={handleClose}
                    className="absolute top-6 right-6 w-9 h-9 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-all cursor-pointer z-10"
                  >
                    <X size={16} />
                  </button>

                  <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-accent/25 relative z-10">
                    <Heart size={24} className="text-white fill-white" />
                  </div>

                  <div className="space-y-3 mb-8 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Support the Developer</p>
                    <h2 className="text-3xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] leading-none">
                      Keep KAL<br />Alive ❤️
                    </h2>
                    <p className="text-[var(--muted)] font-medium text-sm leading-relaxed pt-1">
                      KAL is a labor of love. If you enjoy using the platform and want to see it grow, consider supporting development. Every bit helps keep the servers running and the coffee flowing!
                    </p>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <a
                      href="https://buymeacoffee.com/miss3persin"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-3 py-4 bg-accent text-white font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all cursor-pointer shadow-xl shadow-accent/20"
                    >
                      <Coffee size={18} /> Buy me a coffee
                    </a>
                    <button
                      onClick={handleClose}
                      className="w-full py-3 border border-[var(--border)] text-[var(--muted)] font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-[var(--surface-hover)] transition-all"
                    >
                      Maybe later
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
