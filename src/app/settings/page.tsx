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

            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .single();

            if (data) {
                setUsername(data.username || "");
                setAvatarUrl(data.avatar_url || "");
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
                        KAL Stable v2.4.0
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
                            <div className="bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6 md:space-y-8 opacity-50 select-none shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 md:gap-4">
                                        <div className="p-2.5 md:p-3 bg-[var(--background)] rounded-lg md:rounded-xl border border-[var(--border)] text-[var(--muted)]">
                                            <Bell size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-base md:text-lg font-bold text-[var(--foreground)]">Draft Reminders</h4>
                                            <p className="text-[9px] md:text-xs text-[var(--muted)] uppercase font-black tracking-tighter">Coming soon</p>
                                        </div>
                                    </div>
                                    <div className="w-10 md:w-14 h-6 md:h-8 bg-[var(--border)] rounded-full relative">
                                        <div className="absolute left-1 top-1 w-4 h-4 md:w-6 md:h-6 bg-[var(--muted)] rounded-full shadow-sm"></div>
                                    </div>
                                </div>
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

