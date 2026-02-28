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
        setModalMessage("A verification archive has been sent to your email. Confirm your entry to join the league.");
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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6 selection:bg-accent selection:text-white transition-colors duration-300">
      <div className="w-full max-w-sm p-8 bg-[var(--surface)] rounded-[2rem] border border-[var(--border)] space-y-6 relative overflow-hidden shadow-2xl">
        <div
          className="absolute -top-10 -right-10 w-32 h-32 opacity-10 blur-3xl rounded-full"
          style={{ backgroundColor: accentColor }}
        ></div>

        <div className="text-center space-y-2 relative z-10">
          <div
            className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center shadow-lg mb-4 transform -rotate-12 cursor-pointer transition-transform hover:scale-110 active:scale-95"
            style={{ backgroundColor: accentColor }}
            onClick={() => router.push('/')}
          >
            <span className="text-white font-black text-3xl">K</span>
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">
            {isSignUp ? "Join the League" : "Welcome Back"}
          </h2>
          <p className="text-[var(--muted)] text-[10px] font-medium uppercase tracking-widest">
            {isSignUp ? "Create your KAL account" : "Log in to your account"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 relative z-10">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed">
              System Error: {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--muted)] ml-1 uppercase tracking-widest">Email</label>
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-accent transition-all text-xs cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--muted)] ml-1 uppercase tracking-widest">Password</label>
            <input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-3 text-[var(--foreground)] focus:outline-none focus:border-accent transition-all text-xs cursor-pointer"
            />
          </div>

          {!isSignUp && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-3.5 h-3.5 accent-accent rounded border-[var(--border)] bg-[var(--background)] cursor-pointer" />
                <span className="text-[9px] text-[var(--muted)] font-black uppercase tracking-widest group-hover:text-[var(--foreground)] transition-colors">Stay logged in</span>
              </label>
              <button type="button" className="text-[9px] font-black text-[var(--muted)] hover:text-[var(--foreground)] transition-colors uppercase tracking-widest cursor-pointer">Forgot password?</button>
            </div>
          )}

          <NeonButton
            className="w-full py-3.5 text-xs flex justify-center items-center"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : (isSignUp ? "Sign Up" : "Sign In")}
          </NeonButton>
        </form>

        <div className="text-center pt-2 relative z-10">
          <p className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-widest">
            {isSignUp ? "Already have an account?" : "New here?"}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[var(--foreground)] font-black hover:underline ml-1 cursor-pointer"
            >
              {isSignUp ? "Log In" : "Create an account"}
            </button>
          </p>
        </div>

        {/* Dynamic Color Selector */}
        <div className="flex justify-center gap-2 pt-2 relative z-10 opacity-60">
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
