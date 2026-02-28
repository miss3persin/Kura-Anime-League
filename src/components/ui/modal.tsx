"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { NeonButton } from './neon-button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    showClose?: boolean;
}

export const Modal = ({ isOpen, onClose, title, children, showClose = true }: ModalProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-[var(--surface)] border border-[var(--border)] w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8">
                            {showClose && (
                                <button
                                    onClick={onClose}
                                    className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                                >
                                    <X size={24} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-3xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">
                                {title}
                            </h3>
                            <div className="text-[var(--muted)] font-medium leading-relaxed">
                                {children}
                            </div>
                        </div>

                        {/* Accent decorative line */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-accent" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
