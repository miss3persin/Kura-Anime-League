"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Shield, Bell, LogOut, User, Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";

interface SettingsUser {
    id: string;
    email?: string;
}

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<SettingsUser | null>(null);
    const [username, setUsername] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [notificationPrefs, setNotificationPrefs] = useState<{ pushEnabled: boolean; emailEnabled: boolean } | null>(null);
    const [loadingPrefs, setLoadingPrefs] = useState(true);
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const [modalMessage, setModalMessage] = useState("");

    useEffect(() => {
        const getProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/login");
                return;
            }
            setUser(session.user);
            setAccessToken(session.access_token ?? null);

            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .single();

            if (data) {
                setUsername(data.username || "");
                setAvatarUrl(data.avatar_url || "");
            }
            if (session.access_token) {
                setLoadingPrefs(true);
                try {
                    const response = await fetch("/api/notifications", {
                        headers: {
                            Authorization: `Bearer ${session.access_token}`
                        }
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(payload.error || "Unable to load notification preferences.");
                    }
                    const preferences = payload.preferences ?? {};
                    setNotificationPrefs({
                        pushEnabled: preferences.push_enabled ?? true,
                        emailEnabled: preferences.email_enabled ?? true
                    });
                } catch (err: unknown) {
                    console.error("Failed to load notification preferences", err);
                    setNotificationPrefs({ pushEnabled: true, emailEnabled: true });
                } finally {
                    setLoadingPrefs(false);
                }
            } else {
                setNotificationPrefs({ pushEnabled: true, emailEnabled: true });
                setLoadingPrefs(false);
            }
            setLoading(false);
        };
        getProfile();
    }, [router]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({
                    username,
                    avatar_url: avatarUrl
                })
                .eq("id", user.id);

            if (error) throw error;

            setModalTitle("PROFILE UPDATED");
            setModalMessage("Your profile has been updated.");
            setIsModalOpen(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Update failed.";
            setModalTitle("UPDATE FAILED");
            setModalMessage(message);
            setIsModalOpen(true);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    const handleTogglePreference = async (key: "pushEnabled" | "emailEnabled") => {
        if (!accessToken || !notificationPrefs || savingPrefs) return;
        const nextValue = !notificationPrefs[key];
        const nextPrefs = { ...notificationPrefs, [key]: nextValue };
        setNotificationPrefs(nextPrefs);
        setSavingPrefs(true);
        try {
            const response = await fetch("/api/notifications", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({ [key]: nextValue })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || "Unable to update notification preferences.");
            }
            if (payload.preferences) {
                setNotificationPrefs({
                    pushEnabled: payload.preferences.push_enabled ?? nextPrefs.pushEnabled,
                    emailEnabled: payload.preferences.email_enabled ?? nextPrefs.emailEnabled
                });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Update failed.";
            setNotificationPrefs((prev) =>
                prev ? { ...prev, [key]: !nextValue } : prev
            );
            setModalTitle("UPDATE FAILED");
            setModalMessage(message);
            setIsModalOpen(true);
        } finally {
            setSavingPrefs(false);
        }
    };

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

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto space-y-6 md:space-y-10 px-1">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[var(--border)] pb-6 md:pb-8 gap-4">
                    <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Settings</h2>
                    <div className="px-4 md:px-5 py-1.5 md:py-2 bg-[var(--surface)] border border-[var(--border)] rounded-full text-[var(--foreground)] text-[8px] md:text-[10px] font-black uppercase tracking-widest shadow-sm w-fit">
                        KAL Stable v1.0.0
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
                    <div className="lg:col-span-2 space-y-6 md:space-y-8">
                        <div className="space-y-4 md:space-y-6">
                            <h3 className="text-[10px] md:text-sm font-black uppercase tracking-[0.2em] text-[var(--muted)] ml-1">Profile Identity</h3>
                            <form onSubmit={handleUpdateProfile} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-5 md:space-y-6 shadow-xl">
                                <div className="space-y-2">
                                    <label className="text-[10px] md:text-xs font-bold text-[var(--muted)] uppercase tracking-widest ml-1">Display Username</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl pl-10 md:pl-12 pr-4 py-3.5 md:py-4 text-xs md:text-sm text-[var(--foreground)] focus:border-accent transition-all cursor-pointer shadow-inner"
                                            placeholder="Enter username"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] md:text-xs font-bold text-[var(--muted)] uppercase tracking-widest ml-1">Avatar URL</label>
                                    <input
                                        type="text"
                                        value={avatarUrl}
                                        onChange={(e) => setAvatarUrl(e.target.value)}
                                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-3.5 md:p-4 text-xs md:text-sm text-[var(--foreground)] focus:border-accent transition-all cursor-pointer shadow-inner"
                                        placeholder="https://..."
                                    />
                                    <p className="text-[8px] md:text-[10px] text-[var(--muted)] uppercase font-black tracking-tighter px-1 opacity-60">Use a direct image link for your profile picture</p>
                                </div>

                                <div className="pt-2 md:pt-4">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full py-3.5 md:py-4 bg-accent text-white font-black uppercase tracking-[0.2em] rounded-xl md:rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 md:gap-3 shadow-lg shadow-accent/20 cursor-pointer disabled:opacity-50 text-[10px] md:text-xs"
                                    >
                                        {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save Changes</>}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="space-y-4 md:space-y-6">
                            <h3 className="text-[10px] md:text-sm font-black uppercase tracking-[0.2em] text-[var(--muted)] ml-1">Preferences</h3>
                            <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-5 md:space-y-6 shadow-sm">
                                <div className="flex items-center gap-3 md:gap-4">
                                    <div className="p-2.5 md:p-3 bg-[var(--background)] rounded-lg md:rounded-xl border border-[var(--border)] text-[var(--muted)]">
                                        <Bell size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-base md:text-lg font-bold text-[var(--foreground)]">Notifications</h4>
                                        <p className="text-[9px] md:text-xs text-[var(--muted)] uppercase font-black tracking-tighter">
                                            Choose how KAL keeps you updated
                                        </p>
                                    </div>
                                </div>

                                {loadingPrefs ? (
                                    <p className="text-[9px] md:text-xs text-[var(--muted)] uppercase font-black tracking-[0.3em]">
                                        Loading notification settings...
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {[
                                            {
                                                key: "pushEnabled" as const,
                                                label: "Push alerts",
                                                description: "Instant alerts for KP changes, scores, and platform news."
                                            },
                                            {
                                                key: "emailEnabled" as const,
                                                label: "Weekly email digest",
                                                description: "Weekly recap with ranks, highlights, and tips."
                                            }
                                        ].map((option) => {
                                            const enabled = notificationPrefs?.[option.key] ?? true;
                                            return (
                                                <button
                                                    key={option.key}
                                                    onClick={() => handleTogglePreference(option.key)}
                                                    disabled={savingPrefs}
                                                    className={`w-full rounded-xl border px-4 py-3 text-left flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.3em] transition-all ${
                                                        enabled
                                                            ? "border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-400"
                                                            : "border-white/10 bg-white/5 hover:border-white/40"
                                                    } ${savingPrefs ? "opacity-60 cursor-not-allowed" : ""}`}
                                                >
                                                    <div className="flex-1 space-y-1 text-left">
                                                        <p className="font-black">{option.label}</p>
                                                        <p className="text-[8px] font-normal uppercase tracking-[0.25em] text-[var(--muted)] leading-tight">
                                                            {option.description}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`text-[8px] font-black uppercase tracking-[0.3em] ${
                                                            enabled ? "text-emerald-300" : "text-red-400"
                                                        }`}
                                                    >
                                                        {enabled ? "On" : "Off"}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {savingPrefs && (
                                    <p className="text-[9px] md:text-xs text-[var(--muted)] uppercase font-black tracking-[0.3em]">
                                        Saving notification settings...
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 md:space-y-8">
                        <div className="space-y-4 md:space-y-6">
                            <h3 className="text-[10px] md:text-sm font-black uppercase tracking-[0.2em] text-[var(--muted)] ml-1">Account Actions</h3>
                            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-3 md:space-y-4 shadow-xl">
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-4 md:py-5 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] font-black uppercase tracking-[0.2em] text-[9px] md:text-[10px] rounded-xl md:rounded-2xl hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center gap-2 md:gap-3 cursor-pointer shadow-sm"
                                >
                                    <LogOut size={14} /> Log Out
                                </button>
                                <button className="w-full py-4 md:py-5 border border-red-500/10 text-red-500/40 font-black uppercase tracking-[0.2em] text-[9px] md:text-[10px] rounded-xl md:rounded-2xl cursor-not-allowed">
                                    Delete Account
                                </button>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 bg-accent/5 border border-accent/10 rounded-2xl md:rounded-3xl space-y-3 md:space-y-4 shadow-sm">
                            <div className="p-2.5 md:p-3 w-fit bg-accent/10 rounded-lg md:rounded-xl text-accent">
                                <Shield size={20} />
                            </div>
                            <h4 className="text-base md:text-lg font-black uppercase tracking-tighter italic text-[var(--foreground)]">Account Security</h4>
                            <p className="text-[10px] md:text-xs text-[var(--muted)] font-medium leading-relaxed uppercase tracking-wider">Your data is stored securely. We do not share your draft picks.</p>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalTitle}
            >
                <p className="text-[var(--muted)] font-bold uppercase tracking-tight text-sm italic">{modalMessage}</p>
            </Modal>
        </AppShell>
    );
}

