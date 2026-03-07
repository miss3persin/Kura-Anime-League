"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    showClose?: boolean;
    maxWidth?: string;
}

export const Modal = ({ isOpen, onClose, title, children, showClose = true, maxWidth = "max-w-lg" }: ModalProps) => {
    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md"
                    />
                    <div className="relative flex min-h-full items-start justify-center p-4 md:p-6 lg:p-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 20 }}
                            className={cn(
                                "relative mt-4 mb-6 w-full rounded-2xl md:mt-8 md:mb-8 md:rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 md:p-10 shadow-2xl overflow-hidden max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-4rem)] overflow-y-auto custom-scrollbar",
                                maxWidth
                            )}
                        >
                            <div className="sticky top-3 z-10 mb-4 flex justify-end pointer-events-none md:top-4 md:mb-6">
                                {showClose && (
                                    <button
                                        onClick={onClose}
                                        className="pointer-events-auto rounded-full border border-[var(--border)] bg-[var(--surface)]/95 p-2 text-[var(--muted)] shadow-lg backdrop-blur-sm transition-colors hover:text-[var(--foreground)]"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4 md:space-y-6">
                                <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)] pr-8 md:pr-0">
                                    {title}
                                </h3>
                                <div className="text-[var(--muted)] font-medium leading-relaxed text-sm md:text-base">
                                    {children}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
        ,
        document.body
    );
};
