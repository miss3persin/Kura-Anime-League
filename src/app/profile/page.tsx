"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Award, Zap, Users, Loader2, Heart, Star } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlocked_at: string;
}

interface UserProfile {
    username: string;
    level: number;
    total_kp: number;
    tier: string;
    avatar_url: string;
}

interface Pick {
    id: string;
    anime_cache: {
        title_romaji: string;
        title_english?: string;
        cover_image: string;
        format: string;
    };
}

interface CharPick {
    character_cache: {
        name: string;
        image: string;
        role: string;
        favorites: number;
    };
    pick_type: string;
}

interface User {
    id: string;
    email?: string;
    user_metadata?: { username?: string };
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [picks, setPicks] = useState<Pick[]>([]);
    const [charPicks, setCharPicks] = useState<CharPick[]>([]);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [seasonName, setSeasonName] = useState<string>("Spring Lineup");

    useEffect(() => {
        const loadProfileData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setLoading(false);
                return;
            }

            const currUser = session.user as User;
            setUser(currUser);

            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currUser.id)
                .single();

            if (profileData) setProfile(profileData as UserProfile);

            const { data: teamData } = await supabase
                .from('teams')
                .select('id')
                .eq('user_id', currUser.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (teamData) {
                const { data: picksData } = await supabase
                    .from('team_picks')
                    .select('id, anime_cache(title_romaji, title_english, cover_image, format)')
                    .eq('team_id', teamData.id);

                if (picksData) setPicks(picksData as unknown as Pick[]);

                const { data: charData } = await supabase
                    .from('character_picks')
                    .select('pick_type, character_cache(name, image, role, favorites)')
                    .eq('team_id', teamData.id);
                
                if (charData) setCharPicks(charData as unknown as CharPick[]);
            }

            const { data: userAch } = await supabase
                .from('user_achievements')
                .select('unlocked_at, achievements(id, name, description, icon)')
                .eq('user_id', currUser.id);
            
            if (userAch) {
                setAchievements(userAch.map((ua: any) => ({
                    ...ua.achievements,
                    unlocked_at: ua.unlocked_at
                })));
            }

            const { data: seasonInfo } = await supabase
                .from("seasons")
                .select("name")
                .eq("status", "active")
                .maybeSingle();
            if (seasonInfo?.name) setSeasonName(seasonInfo.name);
            
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
                    <h2 className="text-4xl font-black uppercase italic font-outfit text-[var(--foreground)]">Access Denied</h2>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => window.location.href = '/login'}
                        className="px-8 py-3 bg-accent text-white font-black uppercase text-xs rounded-xl shadow-lg"
                    >
                        Go to Login
                    </motion.button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-12 pb-20">
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
                                alt="avatar"
                            />
                        </div>
                        <div className="text-center md:text-left space-y-4 flex-grow">
                            <div>
                                <h2 className="text-5xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">
                                    {profile?.username || user.user_metadata?.username || user.email?.split('@')[0]}
                                </h2>
                                <span className="text-accent font-black uppercase tracking-[0.3em] text-[10px] bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
                                    {profile?.tier || 'Bronze'} Tier Player
                                </span>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start gap-8">
                                <div>
                                    <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest mb-1">Total KP</p>
                                    <p className="text-3xl font-black italic text-[var(--foreground)]">{profile?.total_kp?.toLocaleString() || 0}</p>
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

                {/* Team Roster */}
                <div className="space-y-10">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter font-outfit flex items-center gap-3 text-[var(--foreground)]">
                            <Zap size={24} className="text-accent fill-accent" /> Current Team
                        </h3>
                        <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest">{seasonName}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {/* Anime Series */}
                        <div className="xl:col-span-2 space-y-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">My Anime Picks</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {picks.map((pick) => (
                                    <div key={pick.id} className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-xl group">
                                        <div className="aspect-[3/4] overflow-hidden">
                                            <img src={pick.anime_cache.cover_image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="cover" />
                                        </div>
                                        <div className="p-5">
                                            <h4 className="text-[10px] font-black uppercase tracking-tight truncate mb-1 text-[var(--foreground)]">{pick.anime_cache.title_english || pick.anime_cache.title_romaji}</h4>
                                            <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest">{pick.anime_cache.title_english ? pick.anime_cache.title_romaji : pick.anime_cache.format}</p>
                                        </div>
                                    </div>
                                ))}
                                {Array.from({ length: Math.max(0, 5 - picks.length) }).map((_, i) => (
                                    <div key={i} className="bg-[var(--surface)] rounded-3xl border-2 border-dashed border-[var(--border)] aspect-[3/4] flex flex-col items-center justify-center p-6 opacity-30 shadow-sm">
                                        <div className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center mb-2">+</div>
                                        <p className="text-[7px] font-black uppercase text-[var(--muted)] tracking-widest">Awaiting Draft</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Special Recruits */}
                        <div className="space-y-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--muted)]">Special Recruits</p>
                            <div className="space-y-4">
                                {['STAR_CHAR', 'WAIFU_HUSBANDO'].map((type) => {
                                    const pick = charPicks.find(p => p.pick_type === type);
                                    return (
                                        <div key={type} className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-5 flex items-center gap-5 shadow-xl">
                                            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/5 bg-[var(--background)] flex-shrink-0">
                                                {pick ? (
                                                    <img src={pick.character_cache.image} className="w-full h-full object-cover" alt="char" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--muted)]/20 text-xl font-black">?</div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-accent mb-1">{type === 'STAR_CHAR' ? 'Star Recruit' : 'Waifu / Husbando'}</p>
                                                {pick ? (
                                                    <div className="space-y-1">
                                                        <h4 className="text-sm font-black uppercase truncate text-[var(--foreground)] italic">{pick.character_cache.name}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest">{pick.character_cache.role}</span>
                                                            <Heart size={8} className="text-pink-500 fill-pink-500" />
                                                            <span className="text-[8px] font-bold text-pink-500">{pick.character_cache.favorites.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] font-black uppercase text-[var(--muted)]">Not Assigned</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Achievements */}
                <div className="space-y-6 pb-10">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter font-outfit flex items-center gap-3 text-[var(--foreground)]">
                        <Award size={24} className="text-yellow-500" /> Recent Medals
                    </h3>
                    
                    {achievements.length === 0 ? (
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center opacity-50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">No medals earned yet. Keep competing!</p>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-6">
                            {achievements.map((ach) => (
                                <div key={ach.id} className="group relative w-24 h-24 rounded-2xl bg-[var(--surface)] border border-accent/20 flex flex-col items-center justify-center p-4 space-y-2 shadow-lg hover:border-accent cursor-help transition-all">
                                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm">🏅</div>
                                    <p className="text-[7px] font-black uppercase text-[var(--foreground)] text-center tracking-tighter leading-tight">{ach.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
