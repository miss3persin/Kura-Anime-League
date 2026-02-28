"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import {
    Users, Plus, Key, Trophy, ChevronRight, Loader2,
    Shield, Crown, Copy, Check, Lock, Globe, Swords
} from "lucide-react";
import { useRouter } from "next/navigation";

interface League {
    id: string;
    name: string;
    description: string;
    invite_code: string;
    owner_id: string;
    max_members: number;
    is_public: boolean;
    created_at: string;
    member_count?: number;
}

interface User {
    id: string;
    email?: string;
}

export default function LeaguesPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [myLeagues, setMyLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'my' | 'browse' | 'create' | 'join'>('my');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Create form
    const [createName, setCreateName] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [createPublic, setCreatePublic] = useState(false);
    const [creating, setCreating] = useState(false);

    // Join form
    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);
    const [joinMsg, setJoinMsg] = useState('');

    const fetchLeagues = async (userId?: string) => {
        setLoading(true);

        // Get all public leagues with member counts
        const { data: publicLeagues } = await supabase
            .from('leagues')
            .select('*, league_members(count)')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(20);

        if (publicLeagues) {
            setLeagues(publicLeagues.map(l => ({
                ...l,
                member_count: (l.league_members as unknown as [{ count: number }])?.[0]?.count || 0
            })));
        }

        // Get user's leagues
        if (userId) {
            const { data: memberLeagues } = await supabase
                .from('league_members')
                .select('leagues(*)')
                .eq('user_id', userId);

            if (memberLeagues) {
                setMyLeagues(memberLeagues.map((m: any) => m.leagues as League).filter(Boolean));
            }
        }

        setLoading(false);
    };

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            await fetchLeagues(session?.user?.id);
        };
        init();
    }, []);

    const handleCreate = async () => {
        if (!user) return;
        if (!createName.trim()) return;
        setCreating(true);

        const { data: season } = await supabase
            .from('seasons')
            .select('id')
            .eq('status', 'active')
            .single();

        const { data: league, error } = await supabase
            .from('leagues')
            .insert({
                name: createName,
                description: createDesc,
                owner_id: user.id,
                season_id: season?.id,
                is_public: createPublic
            })
            .select()
            .single();

        if (!error && league) {
            // Auto-join as member
            await supabase.from('league_members').insert({
                league_id: league.id,
                user_id: user.id
            });
            await fetchLeagues(user.id);
            setActiveView('my');
            setCreateName('');
            setCreateDesc('');
        }
        setCreating(false);
    };

    const handleJoin = async () => {
        if (!user || !joinCode.trim()) return;
        setJoining(true);
        setJoinMsg('');

        const { data: league } = await supabase
            .from('leagues')
            .select('id, name, max_members')
            .eq('invite_code', joinCode.trim().toUpperCase())
            .single();

        if (!league) {
            setJoinMsg('❌ Invalid invite code. Double-check and try again.');
            setJoining(false);
            return;
        }

        const { error } = await supabase
            .from('league_members')
            .insert({ league_id: league.id, user_id: user.id });

        if (error?.code === '23505') {
            setJoinMsg('⚠️ You are already in this league.');
        } else if (error) {
            setJoinMsg('❌ Failed to join. Please try again.');
        } else {
            setJoinMsg(`✅ Joined "${league.name}"! Welcome to the league.`);
            await fetchLeagues(user.id);
        }

        setJoining(false);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const displayLeagues = activeView === 'my' ? myLeagues : leagues;

    if (loading) {
        return (
            <AppShell>
                <div className="flex items-center justify-center py-64">
                    <Loader2 className="animate-spin text-accent" size={48} />
                </div>
            </AppShell>
        );
    }

    if (!user) {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center py-48 space-y-8 bg-[var(--surface-hover)] rounded-[3rem] border border-dashed border-[var(--border)] p-12 text-center shadow-lg">
                    <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center text-accent ring-4 ring-accent/10 shadow-lg">
                        <Shield size={40} />
                    </div>
                    <div className="space-y-4 max-w-md">
                        <h3 className="text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Private Territory</h3>
                        <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs leading-relaxed">
                            Competitive leagues are restricted to registered KAL members. Authenticate to view your standings or join a league.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/login')}
                        className="px-10 py-5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-accent/20 cursor-pointer"
                    >
                        Log In to Access Leagues
                    </button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-10">
                {/* Header */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center shadow-sm">
                            <Shield size={20} className="text-accent" />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">
                                Leagues
                            </h1>
                            <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest">
                                Compete with your crew
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-[var(--surface)] rounded-2xl w-fit border border-[var(--border)] shadow-sm">
                    {[
                        { id: 'my', label: 'My Leagues', icon: Crown },
                        { id: 'browse', label: 'Browse', icon: Globe },
                        { id: 'create', label: 'Create', icon: Plus },
                        { id: 'join', label: 'Join', icon: Key },
                    ].map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveView(tab.id as any)}
                                className={`flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${activeView === tab.id ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'}`}
                            >
                                <Icon size={12} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <AnimatePresence mode="wait">
                    {(activeView === 'my' || activeView === 'browse') && (
                        <motion.div
                            key={activeView}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center py-32">
                                    <Loader2 className="animate-spin text-accent" size={40} />
                                </div>
                            ) : displayLeagues.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-32 space-y-6 bg-[var(--surface-hover)] rounded-[2rem] border border-dashed border-[var(--border)] text-center shadow-inner">
                                    <Shield size={48} className="text-[var(--border)]" />
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">No Leagues Yet</h3>
                                        <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-widest max-w-sm">
                                            {activeView === 'my'
                                                ? "You haven't joined any leagues. Create one or join with an invite code."
                                                : "No public leagues available. Be the first to create one!"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setActiveView('create')}
                                        className="flex items-center gap-2 px-8 py-3 bg-accent text-white font-black text-xs uppercase tracking-widest rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-accent/20"
                                    >
                                        <Plus size={14} /> Create a League
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {displayLeagues.map((league) => (
                                        <motion.div
                                            key={league.id}
                                            whileHover={{ y: -4 }}
                                            className="bg-[var(--surface)] border border-[var(--border)] hover:border-accent/30 rounded-3xl p-6 space-y-5 cursor-pointer group transition-all shadow-lg hover:shadow-xl"
                                            onClick={() => router.push(`/leagues/${league.id}`)}
                                        >
                                            {/* League Header */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center font-black text-2xl text-accent shadow-sm">
                                                        {league.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black uppercase tracking-tighter text-sm text-[var(--foreground)]">{league.name}</h3>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {league.is_public
                                                                ? <Globe size={10} className="text-green-500" />
                                                                : <Lock size={10} className="text-[var(--muted)]" />}
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
                                                                {league.is_public ? 'Public' : 'Private'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-[var(--muted)] group-hover:text-accent transition-colors mt-1" />
                                            </div>

                                            {league.description && (
                                                <p className="text-[var(--muted)] text-[10px] font-medium leading-relaxed line-clamp-2">{league.description}</p>
                                            )}

                                            {/* Stats Row */}
                                            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                                                <div className="flex items-center gap-2">
                                                    <Users size={12} className="text-[var(--muted)]" />
                                                    <span className="text-[10px] font-black uppercase text-[var(--muted)]">
                                                        {league.member_count || 0} / {league.max_members} Members
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyCode(league.invite_code);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] hover:bg-accent/10 hover:border-accent/20 rounded-lg transition-all shadow-sm"
                                                >
                                                    {copiedCode === league.invite_code
                                                        ? <Check size={10} className="text-green-500" />
                                                        : <Copy size={10} className="text-[var(--muted)]" />}
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">
                                                        {copiedCode === league.invite_code ? 'Copied!' : league.invite_code}
                                                    </span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeView === 'create' && (
                        <motion.div
                            key="create"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="max-w-2xl"
                        >
                            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-8 md:p-10 space-y-8 shadow-2xl">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">Create League</h2>
                                    <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-widest">Set up your private fantasy arena</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">League Name *</label>
                                        <input
                                            value={createName}
                                            onChange={e => setCreateName(e.target.value)}
                                            placeholder="e.g., Otaku Elite Squad"
                                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-5 py-4 text-sm font-bold text-[var(--foreground)] focus:outline-none focus:border-accent transition-all shadow-inner"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Description</label>
                                        <textarea
                                            value={createDesc}
                                            onChange={e => setCreateDesc(e.target.value)}
                                            placeholder="What's your league about?"
                                            rows={3}
                                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-5 py-4 text-sm font-bold text-[var(--foreground)] focus:outline-none focus:border-accent transition-all resize-none shadow-inner"
                                        />
                                    </div>

                                    <div className="flex items-center gap-4 p-5 bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-sm">
                                        <button
                                            onClick={() => setCreatePublic(!createPublic)}
                                            className={`relative w-12 h-6 rounded-full transition-all ${createPublic ? 'bg-accent' : 'bg-[var(--border)]'}`}
                                        >
                                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${createPublic ? 'left-7' : 'left-1'}`} />
                                        </button>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-tight text-[var(--foreground)]">Public League</p>
                                            <p className="text-[9px] text-[var(--muted)] uppercase tracking-widest">Anyone can browse and request to join</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreate}
                                    disabled={creating || !createName.trim()}
                                    className="w-full flex items-center justify-center gap-3 py-4 bg-accent text-white font-black text-xs uppercase tracking-widest rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg shadow-accent/20"
                                >
                                    {creating ? <Loader2 className="animate-spin" size={16} /> : <Swords size={16} />}
                                    {creating ? 'Forging League...' : 'Create League'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeView === 'join' && (
                        <motion.div
                            key="join"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="max-w-lg"
                        >
                            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-8 md:p-10 space-y-8 shadow-2xl">
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)]">Join League</h2>
                                    <p className="text-[var(--muted)] text-xs font-bold uppercase tracking-widest">Enter your invite code to join</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Invite Code</label>
                                        <input
                                            value={joinCode}
                                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                            placeholder="e.g., A1B2C3D4"
                                            maxLength={8}
                                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-5 py-4 text-xl font-black tracking-[0.3em] text-[var(--foreground)] text-center focus:outline-none focus:border-accent transition-all uppercase shadow-inner"
                                        />
                                    </div>

                                    {joinMsg && (
                                        <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-wide shadow-sm border ${joinMsg.startsWith('✅') ? 'bg-green-500/10 border-green-500/20 text-green-500' : joinMsg.startsWith('⚠️') ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                            {joinMsg}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleJoin}
                                        disabled={joining || !joinCode.trim() || !user}
                                        className="w-full flex items-center justify-center gap-3 py-4 bg-accent text-white font-black text-xs uppercase tracking-widest rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg shadow-accent/20"
                                    >
                                        {joining ? <Loader2 className="animate-spin" size={16} /> : <Key size={16} />}
                                        {joining ? 'Verifying Code...' : user ? 'Join League' : 'Login to Join'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AppShell>
    );
}
