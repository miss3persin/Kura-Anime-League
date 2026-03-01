"use client";

import React, { useState, useEffect } from 'react';
import {
    Home, User, LayoutGrid, Trophy, Vote, Heart, Settings, Bell, Users, Menu, LogOut, Sun, Moon, Zap,
    Shield, Activity, Dice6, ShieldCheck
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Session, User } from '@supabase/supabase-js';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from "@/lib/supabase/client";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type NavItem = {
    id: string;
    icon: LucideIcon;
    label: string;
    href: string;
    protected?: boolean;
    adminOnly?: boolean;
};

type ProfileState = {
    total_kp?: number;
    username?: string;
    avatar_url?: string;
} | null;

type SeasonInfo = {
    phase?: string;
    deadline?: string | null;
    deadlineLabel?: string | null;
    activeSeason?: { name?: string };
    upcomingSeason?: { name?: string };
    currentWeek?: number;
    totalWeeks?: number;
} | null;

const NAV_ITEMS: NavItem[] = [
    { id: 'home', icon: Home, label: 'Home', href: '/' },
    { id: 'profile', icon: User, label: 'My Profile', href: '/profile', protected: true },
    { id: 'squad', icon: Shield, label: 'My Squad', href: '/squad', protected: true },
    { id: 'leagues', icon: Users, label: 'Leagues', href: '/leagues', protected: true },
    { id: 'draft', icon: LayoutGrid, label: 'Draft Picks', href: '/draft', protected: true },
    { id: 'hype', icon: Activity, label: 'Hype Index', href: '/hype' },
    { id: 'predict', icon: Dice6, label: 'Predictions', href: '/predict', protected: true },
    { id: 'leaderboard', icon: Trophy, label: 'Rankings', href: '/rankings' },
    { id: 'vote', icon: Vote, label: 'Hype Polls', href: '/polls' },
    { id: 'donate', icon: Heart, label: 'Support Us', href: '/support' },
    { id: 'settings', icon: Settings, label: 'Settings', href: '/settings', protected: true },
    { id: 'admin', icon: ShieldCheck, label: 'Admin', href: '/admin', protected: true, adminOnly: true }
];

const ACCENTS = ['#AE00FF', '#00FF9C', '#FF2E63', '#FFD700', '#FF4D00'];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
    const [accentColor, setAccentColor] = useState('#AE00FF');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<ProfileState>(null);
    const [seasonInfo, setSeasonInfo] = useState<SeasonInfo>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authSession, setAuthSession] = useState<Session | null>(null);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        const fetchUserAndProfile = async () => {
            const {
                data: { session }
            } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setAuthSession(session ?? null);

            if (session?.user) {
                const { data } = await supabase
                    .from("profiles")
                    .select("total_kp, username, avatar_url")
                    .eq("id", session.user.id)
                    .single();
                if (data) {
                    setProfile({
                        total_kp: data.total_kp,
                        username: data.username,
                        avatar_url: data.avatar_url
                    });
                } else {
                    setProfile({ total_kp: 20000 });
                }
            } else {
                setProfile({ total_kp: 20000 });
            }
        };

        const fetchSeason = async () => {
            const res = await fetch('/api/seasons/current');
            const data = (await res.json()) as SeasonInfo;
            setSeasonInfo(data);
        };

        fetchUserAndProfile();
        fetchSeason();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setAuthSession(session ?? null);
            if (!session) {
                setProfile(null);
                setIsAdmin(false);
            }
        });

        // Real-time KP update listener
        const handleKpUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<{ total_kp?: number }>;
            if (customEvent.detail?.total_kp !== undefined) {
                setProfile((prev) => (prev ? { ...prev, total_kp: customEvent.detail.total_kp } : null));
            }
        };
        window.addEventListener('kalKpUpdate', handleKpUpdate);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('kalKpUpdate', handleKpUpdate);
        };
    }, []);

    useEffect(() => {
        if (!authSession?.access_token) {
            const frame = requestAnimationFrame(() => setIsAdmin(false));
            return () => cancelAnimationFrame(frame);
        }

        let canceled = false;
        (async () => {
            try {
                const res = await fetch('/api/admin/me', {
                    headers: {
                        Authorization: `Bearer ${authSession.access_token}`
                    }
                });
                if (canceled) return;
                if (!res.ok) {
                    setIsAdmin(false);
                    return;
                }
                const data = await res.json();
                setIsAdmin(Boolean(data?.isAdmin));
            } catch {
                if (!canceled) {
                    setIsAdmin(false);
                }
            }
        })();

        return () => {
            canceled = true;
        };
    }, [authSession]);

    // Handle dynamic accent color on navigation
    useEffect(() => {
        const updateAccent = () => {
            const randomAccent = ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
            setAccentColor(randomAccent);
            document.documentElement.style.setProperty('--accent', randomAccent);
        };
        const frame = requestAnimationFrame(updateAccent);
        return () => cancelAnimationFrame(frame);
    }, [pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-accent selection:text-white flex transition-colors duration-300">
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 bg-[var(--surface)] border-r border-[var(--border)] transition-all duration-500 ease-in-out shadow-xl",
                    isSidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:w-20 md:translate-x-0"
                )}
            >
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Logo */}
                    <div className="p-8 flex items-center gap-4">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:rotate-12 cursor-pointer shrink-0"
                            style={{ backgroundColor: accentColor }}
                            onClick={() => router.push('/')}
                        >
                            <span className="text-black font-black text-2xl">K</span>
                        </div>
                        {isSidebarOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="overflow-hidden"
                                onClick={() => router.push('/')}
                            >
                                <span className="text-2xl font-black tracking-tighter italic uppercase block leading-none cursor-pointer">KAL</span>
                                <span className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest cursor-pointer">Kura Anime League</span>
                            </motion.div>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="grow px-4 space-y-2 overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {NAV_ITEMS.map((item) => {
                            // Filter items if they are protected and user is not logged in
                            if (item.protected && !user) return null;
                            if (item.adminOnly && !isAdmin) return null;

                            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => router.push(item.href)}
                                    className={cn(
                                        "flex items-center space-x-4 w-full p-4 transition-all duration-300 border-r-4 group rounded-xl",
                                        isActive
                                            ? "bg-accent/10 text-accent font-black"
                                            : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                    )}
                                    style={{ borderRightColor: isActive ? accentColor : 'transparent' }}
                                >
                                    <Icon
                                        size={20}
                                        className={cn("shrink-0 transition-colors", isActive ? "text-accent" : "group-hover:text-[var(--foreground)]")}
                                        style={isActive ? { color: accentColor } : {}}
                                    />
                                    {isSidebarOpen && (
                                        <span className="font-bold tracking-wide uppercase text-xs truncate">
                                            {item.label}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* User Status / Logout */}
                    <div className="p-6 md:p-8 space-y-4">
                        {user ? (
                            <div className="space-y-4">
                                <div className={cn("hidden md:flex bg-[var(--surface-hover)] border border-[var(--border)] p-4 rounded-2xl items-center gap-3", !isSidebarOpen && "hidden")}>
                                    <img
                                        src={profile?.avatar_url || user.user_metadata.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=User"}
                                        className="w-8 h-8 rounded-full bg-zinc-800"
                                        alt="Avatar"
                                    />
                                    <div className="overflow-hidden">
                                        <p className="text-[10px] font-black uppercase text-[var(--foreground)] truncate">{profile?.username || user.user_metadata.username || user.email.split('@')[0]}</p>
                                        <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest">League Member</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-2 py-4 border border-[var(--border)] text-[var(--muted)] text-xs font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 transition-all rounded-xl shrink-0 overflow-hidden"
                                >
                                    {isSidebarOpen ? <><LogOut size={16} /> Sign Out</> : <LogOut size={16} />}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full flex items-center justify-center gap-2 py-4 bg-accent text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all rounded-xl shadow-lg shrink-0 overflow-hidden"
                            >
                                {isSidebarOpen ? "Log In" : "IN"}
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <div className={cn(
                "grow flex flex-col min-w-0 transition-all duration-500 ease-in-out",
                isSidebarOpen ? "md:ml-72" : "md:ml-20"
            )}>
                {/* Header */}
                <header className="h-20 border-b border-[var(--border)] flex items-center justify-between px-6 md:px-10 bg-[var(--background)]/80 backdrop-blur-xl sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg md:hidden"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[var(--muted)] truncate">
                            Welcome to the League • <span className="text-[var(--foreground)]">{seasonInfo?.activeSeason?.name || seasonInfo?.upcomingSeason?.name || 'OFF-SEASON'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-6">
                        {profile && (
                            <div className="hidden sm:flex items-center gap-2 bg-accent/10 border border-accent/20 px-4 py-2 rounded-full">
                                <Zap size={14} className="text-accent fill-accent" />
                                <span className="text-[10px] font-black uppercase tracking-tighter text-accent">
                                    {profile.total_kp?.toLocaleString()} KP
                                </span>
                            </div>
                        )}
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
                        >
                            {mounted && (theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />)}
                        </button>
                        <button className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors relative p-2">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[var(--background)]"></span>
                        </button>
                        <div className="hidden sm:block w-px h-6 bg-[var(--border)]"></div>
                        <div className="flex items-center gap-3 cursor-pointer group">
                            <span className="hidden sm:inline text-xs font-bold text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">Global Pool</span>
                            <Users size={20} className="text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors" />
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="grow p-6 md:p-10 max-w-7xl mx-auto w-full pb-20">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>

                {/* Mini Footer */}
                <footer className="h-12 bg-black border-t border-white/5 flex items-center justify-between px-6 md:px-10 shrink-0">
                    <div className="flex gap-4 md:gap-8">
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">© 2026 KAL</span>
                        <span className="hidden sm:inline text-[9px] font-bold text-gray-600 uppercase tracking-widest">PHASE 2 ONGOING</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest italic">Always watching anime</span>
                    </div>
                </footer>
            </div>
        </div>
    );
};
