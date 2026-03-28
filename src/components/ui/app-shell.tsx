"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Home, User, LayoutGrid, Trophy, Vote, Heart, Settings, Bell, Users, LogOut, Sun, Moon, Zap,
    Shield, Activity, Dice6, ShieldCheck, Send, X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PageHelpCenter } from "@/components/ui/page-help-center";
import { useSeasonTimeline } from "@/lib/hooks/useSeasonTimeline";

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

const NAV_ITEMS: NavItem[] = [
    { id: 'home', icon: Home, label: 'Home', href: '/' },
    { id: 'profile', icon: User, label: 'My Profile', href: '/profile', protected: true },
    { id: 'squad', icon: Shield, label: 'My Team', href: '/squad', protected: true },
    { id: 'leagues', icon: Users, label: 'Leagues', href: '/leagues', protected: true },
    { id: 'draft', icon: LayoutGrid, label: 'Draft', href: '/draft', protected: true },
    { id: 'hype', icon: Activity, label: 'Show Trends', href: '/hype' },
    { id: 'predict', icon: Dice6, label: 'Predictions', href: '/predict', protected: true },
    { id: 'leaderboard', icon: Trophy, label: 'Rankings', href: '/rankings' },
    { id: 'vote', icon: Vote, label: 'Polls', href: '/polls' },
    { id: 'donate', icon: Heart, label: 'Support Us', href: '/support' },
    { id: 'settings', icon: Settings, label: 'Settings', href: '/settings', protected: true },
    { id: 'admin', icon: ShieldCheck, label: 'Admin', href: '/admin', protected: true, adminOnly: true }
];

const ACCENT_DEFINITIONS = [
    { varName: '--accent-neon-purple', fallback: '#AE00FF' },
    { varName: '--accent-cyan', fallback: '#00FFCC' },
    { varName: '--accent-lava', fallback: '#FF4D00' },
    { varName: '--accent-gold', fallback: '#FFD700' },
    { varName: '--accent-emerald', fallback: '#00D166' },
    { varName: '--accent-ocean', fallback: '#0070FF' },
    { varName: '--accent-sakura', fallback: '#FF6B9D' }
];

type NotificationChannel = 'push' | 'email' | 'system';

type NotificationItem = {
    id: string;
    title: string;
    body: string;
    channel: NotificationChannel;
    kpDelta?: number;
    timestamp: string;
    read?: boolean;
};

type NotificationPreferences = {
    pushEnabled: boolean;
    emailEnabled: boolean;
};

const NOTIFICATION_CHANNEL_META: Record<NotificationChannel, { label: string; tone: string }> = {
    push: { label: 'Push', tone: 'bg-accent text-black' },
    email: { label: 'Email digest', tone: 'bg-white text-black' },
    system: { label: 'System', tone: 'bg-white/10 text-white' }
};

const SAMPLE_NOTIFICATIONS: NotificationItem[] = [
    {
        id: 'push-episode',
        title: 'Dungeon Meshi dropped a new episode',
        body: 'Dungeon Meshi just dropped a new episode. +150 KP.',
        channel: 'push',
        kpDelta: 150,
        timestamp: '2026-03-02T18:30:00Z',
        read: false
    },
    {
        id: 'email-weekly',
        title: 'Weekly Digest: Rank & highlights',
        body: 'Weekly digest: Your rank, best/worst performer, transfer suggestion',
        channel: 'email',
        timestamp: '2026-03-01T07:15:00Z',
        read: false
    },
    {
        id: 'system-draft',
        title: 'Draft opens tomorrow',
        body: 'Draft opens tomorrow at 12:00 UTC. Set your picks and review transfers.',
        channel: 'system',
        timestamp: '2026-03-02T09:45:00Z',
        read: true
    }
];


const formatTimeAgo = (timestamp?: string) => {
    if (!timestamp) return 'just now';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

export const AppShell = ({ children }: { children: React.ReactNode }) => {
    const [accentColor, setAccentColor] = useState('#AE00FF');
    const [isSidebarOpen] = useState(true);
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [profile, setProfile] = useState<ProfileState>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authSession, setAuthSession] = useState<Session | null>(null);
    const [notifications, setNotifications] = useState<NotificationItem[]>(SAMPLE_NOTIFICATIONS);
    const [, setNotificationPreferences] = useState<NotificationPreferences>({
        pushEnabled: true,
        emailEnabled: true
    });
    const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
    const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
    const notificationPanelRef = useRef<HTMLDivElement | null>(null);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { seasonInfo } = useSeasonTimeline();
    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
    const fetchNotifications = useCallback(async () => {
        if (!authSession?.access_token) {
            setNotifications(SAMPLE_NOTIFICATIONS);
            setNotificationPreferences({ pushEnabled: true, emailEnabled: true });
            setLoadingNotifications(false);
            return;
        }
        setLoadingNotifications(true);
        try {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${authSession.access_token}`
            };
            const response = await fetch('/api/notifications', {
                cache: 'no-store',
                headers
            });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 401) {
                setNotifications(SAMPLE_NOTIFICATIONS);
                return;
            }
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load notifications');
            }
            const preferences = payload.preferences ?? {};
            const normalizedPreferences = {
                pushEnabled: preferences.push_enabled ?? true,
                emailEnabled: preferences.email_enabled ?? true
            };
            setNotificationPreferences(normalizedPreferences);
            const fetchedNotifications = Array.isArray(payload.notifications) ? payload.notifications : [];
            const filteredNotifications = fetchedNotifications.filter((notification: NotificationItem) => {
                if (notification.channel === 'system') return true;
                if (notification.channel === 'push') return normalizedPreferences.pushEnabled;
                if (notification.channel === 'email') return normalizedPreferences.emailEnabled;
                return true;
            });
            setNotifications(filteredNotifications);
        } catch (error) {
            console.error('Failed to load notifications', error);
            setNotifications((prev) => (prev.length ? prev : SAMPLE_NOTIFICATIONS));
        } finally {
            setLoadingNotifications(false);
        }
    }, [authSession?.access_token]);
    const markAllRead = useCallback(async () => {
        try {
            if (!authSession?.access_token) return;
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authSession.access_token}`
                },
                body: JSON.stringify({ markAllRead: true })
            });
            await fetchNotifications();
        } catch (error) {
            console.error('Failed to mark notifications as read', error);
        }
    }, [authSession?.access_token, fetchNotifications]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        void fetchNotifications();
    }, [fetchNotifications]);

    useEffect(() => {
        if (!authSession?.access_token) return;
        const interval = window.setInterval(() => {
            fetchNotifications();
        }, 60000);
        return () => window.clearInterval(interval);
    }, [authSession?.access_token, fetchNotifications]);

    useEffect(() => {
        if (notificationPanelOpen) {
            markAllRead();
        }
    }, [notificationPanelOpen, markAllRead]);

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (
                notificationPanelOpen &&
                !notificationPanelRef.current?.contains(event.target as Node) &&
                !notificationButtonRef.current?.contains(event.target as Node)
            ) {
                setNotificationPanelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [notificationPanelOpen]);

    useEffect(() => {
        setNotificationPanelOpen(false);
    }, [pathname]);

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

        fetchUserAndProfile();

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
            const computed = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
            const palette = ACCENT_DEFINITIONS.map(({ varName, fallback }) => {
                const computedValue = computed?.getPropertyValue(varName).trim();
                return computedValue || fallback;
            });

            const randomAccent = palette[Math.floor(Math.random() * palette.length)];
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
                    isSidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:w-20 md:translate-x-0",
                    "hidden md:block" // Desktop only sidebar
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
                                        <p className="text-[10px] font-black uppercase text-[var(--foreground)] truncate">{profile?.username || user.user_metadata.username || user.email?.split('@')[0]}</p>
                                        <p className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest">Member</p>
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
                isSidebarOpen ? "md:ml-72" : "md:ml-20",
                "ml-0" // Reset margin for mobile
            )}>
                {/* Header */}
                <header className="h-16 md:h-20 border-b border-[var(--border)] flex items-center justify-between px-4 md:px-10 bg-[var(--background)]/80 backdrop-blur-xl sticky top-0 z-30">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg md:hidden shrink-0"
                            style={{ backgroundColor: accentColor }}
                            onClick={() => router.push('/')}
                        >
                            <span className="text-black font-black text-lg">K</span>
                        </div>
                        <div className="text-[9px] md:text-xs font-bold uppercase tracking-widest text-[var(--muted)] truncate max-w-[150px] sm:max-w-none">
                            <span className="hidden sm:inline">Welcome to the League • </span><span className="text-[var(--foreground)]">{seasonInfo?.draftSeason?.name || seasonInfo?.activeSeason?.name || seasonInfo?.upcomingSeason?.name || 'OFF-SEASON'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {profile && (
                            <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 px-3 md:px-4 py-1.5 md:py-2 rounded-full">
                                <Zap size={12} className="text-accent fill-accent md:w-3.5 md:h-3.5" />
                                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter text-accent">
                                    {profile.total_kp?.toLocaleString()} <span className="hidden xs:inline">KP</span>
                                </span>
                            </div>
                        )}
                        <div className="hidden md:block">
                            <PageHelpCenter showReminder={false} showFloatingButton={false} />
                        </div>
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
                        >
                            {mounted && (theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />)}
                        </button>
                        <div className="relative">
                            <button
                                ref={notificationButtonRef}
                                onClick={() => setNotificationPanelOpen((prev) => !prev)}
                                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors relative p-2 rounded-lg border border-transparent hover:border-[var(--border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                                aria-haspopup="true"
                                aria-expanded={notificationPanelOpen}
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 text-[9px] leading-none w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-red-500/40">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                            <AnimatePresence>
                                {notificationPanelOpen && (
                                    <motion.div
                                        ref={notificationPanelRef}
                                        initial={{ opacity: 0, y: -6, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                                        transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                                        className="absolute right-0 top-full mt-3 w-screen max-w-sm xs:max-w-xs bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl px-4 py-4 space-y-4 z-50"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-0.5">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)]">Notifications</p>
                                                <p className="text-[11px] font-bold text-[var(--foreground)]">
                                                    Latest updates
                                                </p>
                                            </div>
                                            {unreadCount > 0 && (
                                                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-accent">
                                                    {unreadCount} new
                                                </span>
                                            )}
                                        </div>

                                        {loadingNotifications && (
                                            <p className="text-[8px] uppercase tracking-[0.3em] text-[var(--muted)]">
                                                Syncing notifications…
                                            </p>
                                        )}

                                        <div className="space-y-2">
                                            {notifications.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-white/10 p-3 text-[10px] text-[var(--muted)] uppercase tracking-[0.3em] text-center">
                                                    Notifications will appear here when a KP update or digest is ready.
                                                </div>
                                            ) : (
                                                notifications.map((notification) => (
                                                    <div
                                                        key={notification.id}
                                                        className="rounded-xl border border-white/5 bg-white/5 p-3 space-y-1"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span
                                                                className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-[0.3em] ${NOTIFICATION_CHANNEL_META[notification.channel].tone}`}
                                                            >
                                                                {NOTIFICATION_CHANNEL_META[notification.channel].label}
                                                            </span>
                                                            <span className="text-[8px] text-[var(--muted)]">
                                                                {formatTimeAgo(notification.timestamp)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="text-[11px] font-black uppercase tracking-wide text-[var(--foreground)]">
                                                                {notification.title}
                                                            </h4>
                                                            {notification.kpDelta ? (
                                                                <span className="text-[10px] font-black text-accent">
                                                                    +{notification.kpDelta} KP
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <p className="text-[10px] text-[var(--muted)] leading-tight">
                                                            {notification.body}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="grow p-4 md:p-10 max-w-7xl mx-auto w-full pb-24 md:pb-20">
                    <PageHelpCenter className="mb-6 md:mb-8" showInlineButton={false} />
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

                {/* Mobile Bottom Navigation */}
                <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[var(--surface)]/90 backdrop-blur-xl border-t border-[var(--border)] px-6 py-3 pb-6 flex items-center justify-between">
                    {[
                        { icon: Home, label: 'Home', href: '/' },
                        { icon: Shield, label: 'Team', href: '/squad' },
                        { icon: LayoutGrid, label: 'Draft', href: '/draft' },
                        { icon: Activity, label: 'Trends', href: '/hype' },
                        { icon: User, label: 'Profile', href: '/profile' },
                    ].map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.label}
                                onClick={() => router.push(item.href)}
                                className={cn(
                                    "flex flex-col items-center gap-1 transition-all",
                                    isActive ? "text-accent" : "text-[var(--muted)]"
                                )}
                            >
                                <Icon size={20} style={isActive ? { color: accentColor } : {}} />
                                <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Mini Footer */}
                <footer className="h-12 bg-black border-t border-white/5 flex items-center justify-between px-6 md:px-10 shrink-0 hidden md:flex">
                    <div className="flex gap-4 md:gap-8 shrink-0">
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">© 2026 KAL</span>
                        <span className="hidden sm:inline text-[9px] font-bold text-gray-600 uppercase tracking-widest">PHASE 2 ONGOING</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-3">
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Reach Me</span>
                        <a
                            href="http://t.me/miss3persin"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Telegram"
                            className="w-7 h-7 rounded-full border border-white/10 bg-white/5 text-gray-300 flex items-center justify-center hover:text-accent hover:border-accent/40 hover:bg-accent/10 transition-all"
                        >
                            <Send size={12} />
                        </a>
                        <a
                            href="https://x.com/miss3persin"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="X"
                            className="w-7 h-7 rounded-full border border-white/10 bg-white/5 text-gray-300 flex items-center justify-center hover:text-accent hover:border-accent/40 hover:bg-accent/10 transition-all"
                        >
                            <X size={12} />
                        </a>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest italic">Always watching anime</span>
                    </div>
                </footer>
            </div>
        </div>
    );
};
