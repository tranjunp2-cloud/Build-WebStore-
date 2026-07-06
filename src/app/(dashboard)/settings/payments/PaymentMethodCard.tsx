"use client";

import React from 'react';
import { Lock, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
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
    // GH-1499 issue 2: long descriptions overflow the card unbounded — truncate to
    // 2 lines with a "See more" toggle instead. Only show the toggle when truncation
    // would actually kick in (short descriptions never wrap to 3+ lines anyway).
    const [expanded, setExpanded] = React.useState(false);
    const isLongDesc = desc.length > 120;

    return (
        <div className={cn(
            // preflight OFF → class `border` thiếu border-style; phải có `border-solid` mới hiện viền.
            'rounded-[16px] p-[20px_22px] border border-solid transition-all duration-200',
            'shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_6px_18px_-10px_rgba(0,0,0,0.45)]',
            locked ? 'bg-[hsl(var(--background))] border-dash-border' : 'bg-[hsl(var(--card))] border-dash-border',
            // Viền đồng nhất xám (dash-border) cho mọi card bất kể bật/tắt — trạng thái active
            // đã thể hiện qua toggle + pill "Active". (Trước đây bật thì viền xanh info → lệch nhau.)
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
                            {/* Truncate + "see more" on mobile/tablet only — desktop (xl+) keeps
                                showing the full description untouched (issue AC: no desktop regression). */}
                            <p className={cn(
                                'text-[13px] text-slate-400 m-0 leading-[1.5] max-w-[480px]',
                                !expanded && isLongDesc && 'line-clamp-2 xl:line-clamp-none',
                            )}>
                                {desc}
                            </p>
                            {isLongDesc && (
                                <button
                                    type="button"
                                    onClick={() => setExpanded(v => !v)}
                                    className="text-[12px] text-[hsl(var(--primary))] font-medium mt-[2px] hover:underline xl:hidden"
                                >
                                    {expanded ? pt.seeLess : pt.seeMore}
                                </button>
                            )}
                        </div>

                        {/* Toggle switch — shared <Switch> (GH-1222) for consistency with Shipping
                            and other settings toggles. */}
                        <div className="relative shrink-0 group/sw">
                            <Switch
                                checked={isActive}
                                disabled={locked}
                                onCheckedChange={() => !locked && onChange(!on)}
                                aria-label={title}
                            />

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
