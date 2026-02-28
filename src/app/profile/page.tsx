"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Award, Zap, Users, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";

interface Pick {
    id: string;
    anime_cache: {
        title_romaji: string;
        cover_image: string;
        format: string;
    };
}

interface UserProfile {
    username: string;
    level: number;
    total_kp: number;
    tier: string;
    avatar_url: string;
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [picks, setPicks] = useState<Pick[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [seasonName, setSeasonName] = useState<string>("Spring Lineup");

    useEffect(() => {
        const loadProfileData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setLoading(false);
                return;
            }

            const currUser = session.user;
            setUser(currUser);

            // 1. Fetch Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currUser.id)
                .single();

            if (profileData) setProfile(profileData);

            // 2. Fetch Picks for the most recent team
            const { data: teamData } = await supabase
                .from('teams')
                .select('id')
                .eq('user_id', currUser.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (teamData) {
                const { data: picksData } = await supabase
                    .from('team_picks')
                    .select(`
            id,
            anime_cache (
              title_romaji,
              cover_image,
              format
            )
          `)
                    .eq('team_id', teamData.id);

                if (picksData) setPicks(picksData as any);
            }

            const { data: seasonInfo } = await supabase
                .from("seasons")
                .select("name")
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (seasonInfo?.name) {
                setSeasonName(seasonInfo.name);
            }
            setLoading(false);
        };

        loadProfileData();
    }, []);

    if (loading) {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center py-40 space-y-4">
                    <Loader2 className="animate-spin text-accent" size={48} />
                    <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs">Loading profile...</p>
                </div>
            </AppShell>
        );
    }

    if (!user) {
        return (
            <AppShell>
                <div className="text-center py-40 space-y-6">
                    <h2 className="text-4xl font-black uppercase italic italic font-outfit text-[var(--foreground)]">Access Denied</h2>
                    <p className="text-[var(--muted)] uppercase font-black tracking-widest">Please log in to view your dashboard</p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => window.location.href = '/login'}
                        className="px-8 py-3 bg-accent text-white font-black uppercase text-xs rounded-xl shadow-lg shadow-accent/20"
                    >
                        Go to Login
                    </motion.button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-12">
                {/* User Stats Card */}
                <div className="bg-[var(--surface)] rounded-[2.5rem] p-10 border border-[var(--border)] relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-5">
                        <Users size={180} className="text-accent" />
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                        <div className="w-32 h-32 rounded-full border-4 border-accent p-1 bg-[var(--background)] shadow-xl">
                            <img
                                src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                                className="w-full h-full rounded-full bg-[var(--surface-hover)] object-cover"
                                alt="Avatar"
                            />
                        </div>
                        <div className="text-center md:text-left space-y-4 flex-grow">
                            <div>
                                <h2 className="text-5xl font-black uppercase tracking-tighter italic font-outfit leading-none mb-1 text-[var(--foreground)]">
                                    {profile?.username || user.user_metadata?.username || user.email?.split('@')[0]}
                                </h2>
                                <span className="text-accent font-black uppercase tracking-[0.3em] text-[10px] bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
                                    {profile?.tier || 'Bronze'} Tier Player
                                </span>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start gap-8">
                                <div>
                                    <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-1">Total KP</p>
                                    <p className="text-3xl font-black italic text-[var(--foreground)]">{profile?.total_kp?.toLocaleString() || 0} <span className="text-xs uppercase align-middle text-[var(--muted)] ml-1">Points</span></p>
                                </div>
                                <div className="w-px h-10 bg-[var(--border)] hidden md:block mt-2"></div>
                                <div>
                                    <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-1">Player Level</p>
                                    <p className="text-3xl font-black italic text-accent">LVL {profile?.level || 1}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team Picks Section */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter font-outfit flex items-center gap-3 text-[var(--foreground)]">
                            <Zap size={24} className="text-accent fill-accent" /> Active Season Team
                        </h3>
                        <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">{seasonName}</span>
                    </div>

                    {picks.length === 0 ? (
                        <div className="bg-[var(--surface-hover)] border-2 border-dashed border-[var(--border)] rounded-3xl p-20 text-center space-y-6 shadow-sm">
                            <p className="text-[var(--muted)] font-bold uppercase tracking-widest">No active picks found for this season.</p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => window.location.href = '/draft'}
                                className="px-8 py-3 bg-accent text-white font-black uppercase text-xs rounded-xl shadow-lg shadow-accent/20"
                            >
                                Start Drafting
                            </motion.button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                            {picks.map((pick, i) => (
                                <motion.div
                                    key={pick.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-xl group transition-all"
                                >
                                    <div className="aspect-[3/4] overflow-hidden">
                                        <img src={pick.anime_cache.cover_image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Pick" />
                                    </div>
                                    <div className="p-5">
                                        <h4 className="text-[10px] font-black uppercase tracking-tight truncate mb-1 text-[var(--foreground)]">{pick.anime_cache.title_romaji}</h4>
                                        <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest">{pick.anime_cache.format}</p>
                                    </div>
                                </motion.div>
                            ))}
                            {/* Empty Slots */}
                            {Array.from({ length: Math.max(0, 5 - picks.length) }).map((_, i) => (
                                <div key={i} className="bg-[var(--surface)] rounded-3xl border-2 border-dashed border-[var(--border)] aspect-[3/4.5] flex flex-col items-center justify-center p-6 text-center space-y-3 opacity-40 shadow-sm">
                                    <div className="w-10 h-10 rounded-full border border-[var(--border)] flex items-center justify-center">
                                        <span className="text-lg font-black text-[var(--muted)]">+</span>
                                    </div>
                                    <p className="text-[8px] font-black uppercase text-[var(--muted)] tracking-widest">Empty Slot</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Badges / Achievements */}
                <div className="space-y-6">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter font-outfit flex items-center gap-3 text-[var(--foreground)]">
                        <Award size={24} className="text-yellow-500" /> Recent Medals
                    </h3>
                    <div className="flex flex-wrap gap-6">
                        <div className="w-24 h-24 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center justify-center p-4 space-y-2 opacity-30 grayscale transition-all hover:opacity-100 hover:grayscale-0 cursor-help shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 shadow-lg">⚓</div>
                            <p className="text-[7px] font-black uppercase text-[var(--muted)] text-center tracking-tighter">Early Bird</p>
                        </div>
                        <div className="w-24 h-24 rounded-2xl bg-[var(--surface)] border border-accent/20 flex flex-col items-center justify-center p-4 space-y-2 shadow-lg shadow-accent/5">
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent shadow-lg">🔥</div>
                            <p className="text-[7px] font-black uppercase text-[var(--foreground)] text-center tracking-tighter">First Draft</p>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
