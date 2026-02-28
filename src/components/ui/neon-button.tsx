"use client";

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'solid' | 'outline';
    accentColor?: string;
    children: React.ReactNode;
}

export const NeonButton = ({
    children,
    onClick,
    variant = 'solid',
    accentColor,
    className,
    ...props
}: NeonButtonProps) => {
    // If accentColor is not provided, use the CSS variable
    const actualColor = accentColor || 'var(--accent)';

    return (
        <button
            onClick={onClick}
            className={cn(
                "inline-flex items-center justify-center gap-2 px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                variant === 'solid'
                    ? "text-white"
                    : "border",
                className
            )}
            style={{
                backgroundColor: variant === 'solid' ? actualColor : 'transparent',
                borderColor: actualColor,
                color: variant === 'outline' ? actualColor : 'white',
                boxShadow: variant === 'solid' ? `0 10px 20px -10px ${actualColor}` : 'none'
            }}
            {...props}
        >
            {children}
        </button>
    );
};
