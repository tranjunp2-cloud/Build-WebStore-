"use client";

import React from 'react';
import { Lock, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

type IconTone = 'brand' | 'purple' | 'amber' | 'teal' | '';

const TONE: Record<string, string> = {
    brand:  'bg-[hsl(var(--info)/0.1)] border-[hsl(var(--info)/0.25)] text-[hsl(var(--info))]',
    purple: 'bg-[hsl(var(--success)/0.1)] border-[hsl(var(--success)/0.22)] text-[hsl(var(--success))]',
    amber:  'bg-[hsl(var(--warning)/0.1)] border-[hsl(var(--warning)/0.22)] text-[hsl(var(--warning))]',
    teal:   'bg-[hsl(var(--primary)/0.1)] border-[hsl(var(--primary)/0.22)] text-[hsl(var(--primary))]',
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
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;
    const isActive = on && !locked;

    return (
        <div className={cn(
            'rounded-[16px] p-[20px_22px] border transition-all duration-200',
            'shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_6px_18px_-10px_rgba(0,0,0,0.45)]',
            locked ? 'bg-[hsl(var(--background))] border-dash-border' : 'bg-[hsl(var(--card))] border-dash-border',
            highlight && !locked && 'border-[hsl(var(--info)/0.3)] shadow-[0_0_0_1px_hsl(var(--info)/0.18),0_8px_24px_-8px_hsl(var(--info)/0.18)]',
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
                                    background: 'linear-gradient(135deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)',
                                    boxShadow: '0 0 12px hsl(var(--info)/0.40)',
                                    borderColor: 'transparent',
                                } : undefined}
                                onClick={() => !locked && onChange(!on)}
                                aria-pressed={isActive}
                                disabled={locked}
                            >
                                <span className={cn(
                                    'absolute top-1/2 -translate-y-1/2 left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-all duration-200',
                                    isActive && 'translate-x-[20px]',
                                )} />
                            </button>

                            {locked && (
                                <div className="absolute -top-[7px] -right-[7px] w-[18px] h-[18px] rounded-full bg-[hsl(var(--card))] border border-white/[0.08] grid place-items-center text-warning">
                                    <Lock className="w-[10px] h-[10px]" />
                                </div>
                            )}
                            {locked && lockTip && (
                                <div className="absolute top-[calc(100%+8px)] right-0 hidden group-hover/sw:flex items-center gap-[6px] px-[11px] py-[7px] bg-[hsl(var(--card))] border border-white/[0.08] text-slate-50 text-[12px] font-medium rounded-[8px] shadow-lg whitespace-nowrap z-10 pointer-events-none">
                                    <Lock className="w-3 h-3 text-warning" />
                                    {lockTip}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status row */}
                    <div className="flex items-center gap-2 mt-[14px] flex-wrap">
                        {locked ? (
                            <span className="inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-semibold border bg-warning/[0.08] border-warning/[0.22] text-warning">
                                <Lock className="w-3 h-3" /> {pt.statusLocked}
                            </span>
                        ) : isActive ? (
                            <span className="inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-semibold border bg-success/10 border-success/30 text-success">
                                <Check className="w-3 h-3" /> {pt.active}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-[8px] text-[12px] font-semibold border bg-white/[0.03] border-white/[0.08] text-slate-500">
                                <Circle className="w-3 h-3" /> {pt.inactive}
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
