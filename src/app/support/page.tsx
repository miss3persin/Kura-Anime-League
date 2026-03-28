"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { NeonButton } from "@/components/ui/neon-button";
import { Heart, Coffee, X, Send } from "lucide-react";
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
      price: "$??",
      perks: ["Support development", "Server maintenance", "Developer Coffee"],
      best: false
    },
    {
      name: "Supporter",
      price: "$???",
      perks: ["Support development", "Server maintenance", "Much more coffee"],
      best: true
    },
    {
      name: "Legend",
      price: "$??",
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
                <ul className="space-y-4 mb-10 grow">
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
                  className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] p-8 shadow-2xl overflow-hidden pointer-events-auto"
                >
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

                  <button
                    onClick={handleClose}
                    className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-all cursor-pointer z-10"
                  >
                    <X size={16} />
                  </button>

                  <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-accent/25 relative z-10">
                    <Heart size={20} className="text-white fill-white" />
                  </div>

                  <div className="space-y-2 mb-5 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Support the Developer...if You Want</p>
                    <h2 className="text-2xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] leading-tight">
                      Keep KAL<br />Alive ❤️
                    </h2>
                    <p className="text-[var(--muted)] font-medium text-[13px] leading-relaxed pt-1">
                      KAL is a labor of love. If you enjoy using the platform and want to see it grow, consider supporting development. Every bit helps keep the servers running and the coffee flowing!
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-3.5 mb-5 relative z-10 overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-24 h-24 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
                    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-[var(--muted)]">Direct Line</p>
                    <p className="text-[11px] font-black uppercase tracking-wide text-[var(--foreground)] mt-1">
                      Prefer a quick DM? Reach me here.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <a
                        href="http://t.me/miss3persin"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-all hover:border-accent/50 hover:bg-accent/10"
                      >
                        <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center group-hover:bg-accent/25">
                          <Send size={16} />
                        </span>
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--foreground)]">Telegram</p>
                          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">@miss3persin</p>
                        </div>
                      </a>
                      <a
                        href="https://x.com/miss3persin"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-all hover:border-accent/50 hover:bg-accent/10"
                      >
                        <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center group-hover:bg-accent/25">
                          <X size={16} />
                        </span>
                        <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--foreground)]">X / Twitter</p>
                          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--muted)]">@miss3persin</p>
                        </div>
                      </a>
                    </div>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <a
                      href="https://buymeacoffee.com/miss3persin"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-3 py-3.5 bg-accent text-white font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all cursor-pointer shadow-xl shadow-accent/20"
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
