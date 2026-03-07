"use client";

import React, { useState } from 'react';
import { NeonButton } from "@/components/ui/neon-button";
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export default function LoginPage() {
  const router = useRouter();
  const [accentColor, setAccentColor] = useState('#AE00FF');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  // Modal State
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const username = email.split('@')[0];
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
              avatar_url: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${username}`
            }
          }
        });
        if (error) throw error;

        setModalTitle("SIGNUP SUCCESSFUL");
        setModalMessage("A verification email has been sent. Confirm your account to continue.");
        setIsModalOpen(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        router.push('/profile');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-4 md:p-6 selection:bg-accent selection:text-white transition-colors duration-300">
      <div className="w-full max-w-[360px] md:max-w-sm p-6 md:p-8 bg-[var(--surface)] rounded-2xl md:rounded-[2rem] border border-[var(--border)] space-y-5 md:space-y-6 relative overflow-hidden shadow-2xl">
        <div
          className="absolute -top-10 -right-10 w-32 h-32 opacity-10 blur-3xl rounded-full"
          style={{ backgroundColor: accentColor }}
        ></div>

        <div className="text-center space-y-2 relative z-10">
          <div
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl mx-auto flex items-center justify-center shadow-lg mb-3 md:mb-4 transform -rotate-12 cursor-pointer transition-transform hover:scale-110 active:scale-95"
            style={{ backgroundColor: accentColor }}
            onClick={() => router.push('/')}
          >
            <span className="text-white font-black text-2xl md:text-3xl">K</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">
            {isSignUp ? "Join League" : "Welcome"}
          </h2>
          <p className="text-[var(--muted)] text-[9px] md:text-[10px] font-medium uppercase tracking-widest">
            {isSignUp ? "Create KAL account" : "Log in to proceed"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 relative z-10">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] leading-relaxed">
              Error: {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[9px] md:text-[10px] font-bold text-[var(--muted)] ml-1 uppercase tracking-widest">Email</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 md:py-3 text-[var(--foreground)] focus:outline-none focus:border-accent transition-all text-xs md:text-sm cursor-pointer shadow-inner"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] md:text-[10px] font-bold text-[var(--muted)] ml-1 uppercase tracking-widest">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 md:py-3 text-[var(--foreground)] focus:outline-none focus:border-accent transition-all text-xs md:text-sm cursor-pointer shadow-inner"
            />
          </div>

          {!isSignUp && (
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-3.5 h-3.5 accent-accent rounded border-[var(--border)] bg-[var(--background)] cursor-pointer" />
                <span className="text-[8px] md:text-[9px] text-[var(--muted)] font-black uppercase tracking-widest group-hover:text-[var(--foreground)] transition-colors">Stay signed in</span>
              </label>
              <button type="button" className="text-[8px] md:text-[9px] font-black text-[var(--muted)] hover:text-[var(--foreground)] transition-colors uppercase tracking-widest cursor-pointer">Forgot password?</button>
            </div>
          )}

          <NeonButton
            className="w-full py-3 md:py-3.5 text-[10px] md:text-xs flex justify-center items-center"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : (isSignUp ? "Create Account" : "Log In")}
          </NeonButton>
        </form>

        <div className="text-center pt-1 relative z-10">
          <p className="text-[9px] md:text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">
            {isSignUp ? "Already have an account?" : "Need an account?"}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[var(--foreground)] font-black hover:underline ml-1 cursor-pointer"
            >
              {isSignUp ? "Log In" : "Register"}
            </button>
          </p>
        </div>

        {/* Dynamic Color Selector */}
        <div className="flex justify-center gap-2.5 pt-1 relative z-10 opacity-60">
          {['#AE00FF', '#00FF9C', '#FF2E63', '#FFD700', '#FF4D00'].map(c => (
            <button
              key={c}
              className="w-2.5 h-2.5 rounded-full cursor-pointer hover:scale-125 transition-all"
              style={{ backgroundColor: c, border: accentColor === c ? '2px solid var(--foreground)' : 'none' }}
              onClick={() => {
                setAccentColor(c);
                document.documentElement.style.setProperty('--accent', c);
              }}
            ></button>
          ))}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
      >
        <p className="text-[var(--muted)] font-bold uppercase tracking-tight text-sm italic">{modalMessage}</p>
      </Modal>
    </div>
  );
}

