"use client";

import React, { useMemo, useState } from "react";
import { CircleHelp, Sparkles, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { getPageHelp } from "@/lib/page-help";
import { cn } from "@/lib/utils";

type PageHelpCenterProps = {
    className?: string;
    showReminder?: boolean;
    showInlineButton?: boolean;
    showFloatingButton?: boolean;
};

export const PageHelpCenter = ({
    className,
    showReminder: shouldShowReminder = true,
    showInlineButton = true,
    showFloatingButton = true
}: PageHelpCenterProps) => {
    const pathname = usePathname();
    const helpContent = useMemo(() => getPageHelp(pathname), [pathname]);
    const [isOpen, setIsOpen] = useState(false);
    const [dismissedPathnames, setDismissedPathnames] = useState<string[]>([]);

    const showReminder = Boolean(pathname) && shouldShowReminder && !dismissedPathnames.includes(pathname);

    const dismissReminder = () => {
        if (!pathname) {
            return;
        }

        setDismissedPathnames((current) => (
            current.includes(pathname) ? current : [...current, pathname]
        ));
    };

    return (
        <>
            <div className={cn("space-y-4", className)}>
                {showReminder && (
                    <div className="rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/10 via-transparent to-cyan-400/10 px-4 py-3 md:px-5 md:py-4 shadow-lg">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                                    <Sparkles size={16} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-accent">Page Help</p>
                                    <p className="text-sm font-semibold text-[var(--foreground)]">{helpContent.reminder}</p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    onClick={() => setIsOpen(true)}
                                    className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/20"
                                >
                                    Open guide
                                </button>
                                <button
                                    onClick={dismissReminder}
                                    aria-label="Dismiss page help reminder"
                                    className="rounded-full border border-[var(--border)] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showInlineButton && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] shadow-lg transition-all hover:border-accent/40 hover:text-[var(--foreground)]"
                    aria-label={`Open help for ${helpContent.title}`}
                    title={`Open help for ${helpContent.title}`}
                >
                    <CircleHelp size={16} />
                    <span className="hidden sm:inline">Help</span>
                </button>
            )}

            {showFloatingButton && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-accent/30 bg-[var(--surface)] text-accent shadow-2xl md:hidden"
                    aria-label={`Open help for ${helpContent.title}`}
                    title={`Open help for ${helpContent.title}`}
                >
                    <CircleHelp size={20} />
                </button>
            )}

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={helpContent.title} maxWidth="max-w-3xl">
                <div className="space-y-6">
                    <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-4">
                        <p className="text-base font-semibold leading-relaxed text-[var(--foreground)]">{helpContent.summary}</p>
                    </div>

                    <section className="space-y-2">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-accent">What this page is for</h4>
                        <p>{helpContent.purpose}</p>
                    </section>

                    <section className="space-y-2">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-accent">What you can do here</h4>
                        <ul className="space-y-2 pl-5 text-sm">
                            {helpContent.thingsYouCanDo.map((item) => (
                                <li key={item} className="list-disc">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-accent">How it works</h4>
                        <ul className="space-y-2 pl-5 text-sm">
                            {helpContent.howItWorks.map((item) => (
                                <li key={item} className="list-disc">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-accent">Good to know</h4>
                        <ul className="space-y-2 pl-5 text-sm">
                            {helpContent.tips.map((item) => (
                                <li key={item} className="list-disc">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="space-y-3">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-accent">Reach the dev</h4>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <a
                                href="http://t.me/miss3persin"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--foreground)] transition-all hover:border-accent/40 hover:bg-accent/10"
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                                    <Send size={16} />
                                </span>
                                Telegram
                            </a>
                            <a
                                href="https://x.com/miss3persin"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--foreground)] transition-all hover:border-accent/40 hover:bg-accent/10"
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                                    <X size={16} />
                                </span>
                                X / Twitter
                            </a>
                        </div>
                    </section>
                </div>
            </Modal>
        </>
    );
};
