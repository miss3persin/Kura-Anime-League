"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Loader2, ServerCrash } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { type ProfileData } from "@/app/api/profile/[id]/route";

import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StatsGrid } from "@/components/profile/StatsGrid";
import { AchievementsList } from "@/components/profile/AchievementsList";
import { LeaguesList } from "@/components/profile/LeaguesList";

type Status = "loading" | "error" | "success";

export default function ProfilePage() {
    const [status, setStatus] = useState<Status>("loading");
    const [profileData, setProfileData] = useState<ProfileData | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setStatus("error");
                return;
            }

            try {
                const response = await fetch(`/api/profile/${session.user.id}`);
                if (!response.ok) {
                    const errorBody = await response.json();
                    console.error("API Error:", errorBody);
                    throw new Error(`Failed to fetch profile data: ${errorBody.details || response.statusText}`);
                }
                const data: ProfileData = await response.json();
                setProfileData(data);
                setStatus("success");
            } catch (error) {
                console.error(error);
                setStatus("error");
            }
        };

        fetchProfile();
    }, []);

    const renderContent = () => {
        switch (status) {
            case "loading":
                return (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 className="animate-spin text-accent" size={48} />
                        <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-xs">Loading Profile...</p>
                    </div>
                );
            case "error":
                return (
                    <div className="text-center py-40 space-y-6">
                        <ServerCrash className="mx-auto text-red-500/50" size={60} />
                        <h2 className="text-2xl font-black uppercase italic font-outfit text-[var(--foreground)]">Could Not Load Profile</h2>
                        <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
                            There was an issue retrieving your profile data. You might not be logged in, or there was a server error.
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            onClick={() => window.location.href = '/login'}
                            className="px-8 py-3 bg-accent text-white font-black uppercase text-xs rounded-xl shadow-lg"
                        >
                            Go to Login
                        </motion.button>
                    </div>
                );
            case "success":
                if (!profileData) return null;
                return (
                    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
                        <ProfileHeader user={profileData.user} />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <StatsGrid stats={profileData.stats} />
                                <AchievementsList achievements={profileData.achievements} />
                            </div>
                            <div className="lg:col-span-1">
                                <LeaguesList leagues={profileData.leagues} />
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return <AppShell>{renderContent()}</AppShell>;
}
