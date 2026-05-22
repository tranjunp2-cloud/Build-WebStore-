"use client";

import React from 'react';
import { Lock, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconTone = 'brand' | 'purple' | 'amber' | 'teal' | '';

const TONE: Record<string, string> = {
    brand:  'bg-sky-500/10 border-sky-500/[0.25] text-sky-600 dark:text-sky-400',
    purple: 'bg-purple-500/10 border-purple-500/[0.22] text-purple-600 dark:text-purple-300',
    amber:  'bg-amber-500/10 border-amber-500/[0.22] text-amber-600 dark:text-amber-400',
    teal:   'bg-teal-400/10 border-teal-400/[0.22] text-teal-600 dark:text-teal-400',
    '':     'bg-white/[0.04] border-white/[0.08] text-slate-400',
};

interface Props {
    icon: React.ReactNode;
    iconTone?: IconTone;
    title: string;
    feePill?: string;
    desc: string;
    on: boolean;
    locked?: boolean;
    lockTip?: string;
    onChange: (checked: boolean) => void;
    highlight?: boolean;
    statusExtra?: React.ReactNode;
    children?: React.ReactNode;
}

export function PaymentMethodCard({
    icon, iconTone = '', title, feePill, desc,
    on, locked, lockTip, onChange, highlight, statusExtra, children,
}: Props) {
    const isActive = on && !locked;

    return (
        <div className={cn(
            'rounded-[16px] p-[20px_22px] border transition-all duration-200',
            'shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_6px_18px_-10px_rgba(0,0,0,0.45)]',
            locked ? 'opacity-70 bg-[#0f1729] border-white/[0.08]' : 'bg-[#141e2e] border-dash-border',
            highlight && !locked && 'border-sky-500/[0.30] shadow-[0_0_0_1px_rgba(14,165,233,0.18),0_8px_24px_-8px_rgba(14,165,233,0.18)]',
        )}>
            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={cn('w-[50px] h-[50px] rounded-[14px] border grid place-items-center shrink-0', TONE[iconTone])}>
                    {icon}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-[14px]">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[16px] font-semibold text-slate-50 mb-[3px] flex items-center gap-2 tracking-[-0.005em]">
                                {title}
                                {feePill && (
                                    <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-white/[0.06] text-slate-400 font-semibold tracking-[0.02em]">
                                        {feePill}
                                    </span>
                                )}
                            </h3>
                            <p className="text-[13px] text-slate-400 m-0 leading-[1.5] max-w-[480px]">{desc}</p>
                        </div>

                        {/* Toggle switch */}
                        <div className="relative shrink-0 group/sw">
                            <input
                                type="checkbox"
                                className="absolute opacity-0 w-0 h-0"
                                checked={isActive}
                                disabled={locked}
                                onChange={() => !locked && onChange(!on)}
                                tabIndex={-1}
                                aria-hidden="true"
                            />
                            <button
                                className={cn(
                                    'w-[44px] h-[24px] rounded-full border relative transition-all duration-200',
                                    !isActive && 'bg-white/10 border-white/[0.08]',
                                    locked && 'opacity-45 cursor-not-allowed',
                                )}
                                style={isActive ? {
                                    background: 'linear-gradient(135deg, #0ea5e9 0%, #2dd4bf 100%)',
                                    boxShadow: '0 0 12px rgba(14,165,233,0.40)',
                                    borderColor: 'transparent',
                                } : undefined}
                                onClick={() => !locked && onChange(!on)}
                                aria-pressed={isActive}
                                disabled={locked}
                            >
                                <span className={cn(
                                    'absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-all duration-200',
                                    isActive && 'translate-x-[20px]',
                                )} />
                            </button>

                            {locked && (
                                <div className="absolute -top-[7px] -right-[7px] w-[18px] h-[18px] rounded-full bg-[#1a2540] border border-white/[0.08] grid place-items-center text-amber-400">
                                    <Lock className="w-[10px] h-[10px]" />
                                </div>
                            )}
                            {locked && lockTip && (
                                <div className="absolute top-[calc(100%+8px)] right-0 hidden group-hover/sw:flex items-center gap-[6px] px-[11px] py-[7px] bg-[#1a2540] border border-white/[0.08] text-slate-50 text-[12px] font-medium rounded-[8px] shadow-lg whitespace-nowrap z-10 pointer-events-none">
                                    <Lock className="w-3 h-3 text-amber-400" />
                                    {lockTip}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status row */}
                    <div className="flex items-center gap-2 mt-[14px] flex-wrap">
                        {locked ? (
                            <span className="inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-semibold border bg-amber-500/[0.08] border-amber-500/[0.22] text-amber-400">
                                <Lock className="w-3 h-3" /> Locked
                            </span>
                        ) : isActive ? (
                            <span className="inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-semibold border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                                <Check className="w-3 h-3" /> Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-semibold border bg-white/[0.03] border-white/[0.08] text-slate-500">
                                <Circle className="w-3 h-3" /> Inactive
                            </span>
                        )}
                        {statusExtra && (
                            <span className="inline-flex items-center gap-[5px] text-[12px] text-slate-500">
                                {statusExtra}
                            </span>
                        )}
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}
