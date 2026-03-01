"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Vote as VoteIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";

interface Poll {
    id: number;
    question: string;
    option_a: string;
    option_b: string;
    votes_a: number;
    votes_b: number;
}

export default function PollsPage() {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPolls = async () => {
            const { data } = await supabase
                .from('polls')
                .select('*')
                .eq('is_active', true);

            if (data) setPolls(data as Poll[]);
            setLoading(false);
        };

        fetchPolls();
    }, []);

    const handleVote = async (pollId: number, option: 'a' | 'b') => {
        // Optimistic update
        setPolls(prev => prev.map(p => {
            if (p.id === pollId) {
                return {
                    ...p,
                    votes_a: option === 'a' ? p.votes_a + 1 : p.votes_a,
                    votes_b: option === 'b' ? p.votes_b + 1 : p.votes_b,
                };
            }
            return p;
        }));

        // Update Supabase
        const targetPoll = polls.find(p => p.id === pollId);
        if (!targetPoll) return;

        const column = option === 'a' ? 'votes_a' : 'votes_b';
        const newVal = (option === 'a' ? targetPoll.votes_a : targetPoll.votes_b) + 1;

        await supabase
            .from('polls')
            .update({ [column]: newVal })
            .eq('id', pollId);
    };

    if (loading) {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center py-40 space-y-4">
                    <Loader2 className="animate-spin text-accent" size={48} />
                    <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs">Loading active polls...</p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-8 md:space-y-12 pb-20">
                <div className="text-center space-y-2 md:space-y-3 px-4">
                    <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)] leading-tight">Community Polls</h2>
                    <p className="text-[var(--muted)] text-[9px] md:text-sm font-bold uppercase tracking-[0.2em] md:tracking-[0.3em]">Your vote decides the seasonal winner</p>
                </div>

                {polls.length === 0 ? (
                    <div className="text-center py-16 md:py-20 bg-[var(--surface)] rounded-2xl md:rounded-3xl border border-[var(--border)] border-dashed mx-1">
                        <p className="text-[var(--muted)] font-black uppercase tracking-widest text-[10px] md:text-xs">No active polls at the moment. Check back soon!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 px-1">
                        {polls.map((poll, index) => {
                            const total = poll.votes_a + poll.votes_b;
                            const pct_a = total === 0 ? 50 : Math.round((poll.votes_a / total) * 100);
                            const pct_b = total === 0 ? 50 : 100 - pct_a;

                            return (
                                <motion.div
                                    key={poll.id}
                                    initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-[var(--surface)] border border-[var(--border)] p-6 md:p-10 rounded-2xl md:rounded-3xl space-y-6 md:space-y-8 relative overflow-hidden shadow-2xl"
                                >
                                    <div className="absolute top-0 right-0 p-6 md:p-8 opacity-[0.03] md:opacity-5 text-[var(--muted)] pointer-events-none">
                                        <VoteIcon size={64} />
                                    </div>
                                    <h3 className="text-lg md:text-2xl font-black uppercase tracking-tight italic leading-snug relative z-10 text-[var(--foreground)] min-h-[3rem] md:min-h-0">{poll.question}</h3>
                                    <div className="space-y-3 md:space-y-4 relative z-10">
                                        {/* Option A */}
                                        <button
                                            onClick={() => handleVote(poll.id, 'a')}
                                            className="w-full text-left p-4 md:p-6 bg-[var(--background)] border border-[var(--border)] rounded-xl md:rounded-2xl hover:border-accent/40 group transition-all relative overflow-hidden"
                                        >
                                            <div className="relative z-10 flex justify-between items-center mb-1.5 md:mb-2">
                                                <span className="text-xs md:text-sm font-bold uppercase tracking-widest group-hover:text-[var(--foreground)] transition-colors text-[var(--muted)]">{poll.option_a}</span>
                                                <span className="text-[11px] md:text-xs font-black text-[var(--foreground)]">{pct_a}%</span>
                                            </div>
                                            <div className="w-full h-2 md:h-2.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct_a}%` }}
                                                    transition={{ duration: 1 }}
                                                    className="h-full bg-accent shadow-[0_0_10px_var(--accent)] rounded-full"
                                                ></motion.div>
                                            </div>
                                        </button>

                                        {/* Option B */}
                                        <button
                                            onClick={() => handleVote(poll.id, 'b')}
                                            className="w-full text-left p-4 md:p-6 bg-[var(--background)] border border-[var(--border)] rounded-xl md:rounded-2xl hover:border-accent/40 group transition-all relative overflow-hidden"
                                        >
                                            <div className="relative z-10 flex justify-between items-center mb-1.5 md:mb-2">
                                                <span className="text-xs md:text-sm font-bold uppercase tracking-widest group-hover:text-[var(--foreground)] transition-colors text-[var(--muted)]">{poll.option_b}</span>
                                                <span className="text-[11px] md:text-xs font-black text-[var(--foreground)]">{pct_b}%</span>
                                            </div>
                                            <div className="w-full h-2 md:h-2.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct_b}%` }}
                                                    transition={{ duration: 1 }}
                                                    className="h-full bg-[var(--muted)]/30 rounded-full"
                                                ></motion.div>
                                            </div>
                                        </button>
                                    </div>
                                    <p className="text-[9px] md:text-[10px] text-[var(--muted)] font-black uppercase tracking-widest text-center relative z-10">
                                        {total.toLocaleString()} FANS HAVE VOTED
                                    </p>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
