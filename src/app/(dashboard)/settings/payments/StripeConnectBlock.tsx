"use client";

import { useState, useEffect } from 'react';
import { Link, ArrowRight, ShieldCheck, Loader2, BadgeCheck, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

interface Props {
    mode?: 'connect' | 'onboard' | 'verify';
    onConnect?: () => void;
    isConnecting?: boolean;
    onOnboard?: () => void;
    isOnboarding?: boolean;
    onVerify?: () => void;
    isVerifying?: boolean;
    connectedAccountId?: string | null;
    tenantId?: string;
    onDisconnect?: () => Promise<void>;
}

export function StripeConnectBlock({
    mode = 'connect',
    onConnect,
    isConnecting = false,
    onOnboard,
    isOnboarding = false,
    onVerify,
    isVerifying = false,
    connectedAccountId,
    tenantId,
    onDisconnect,
}: Props) {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;
    const [accountEmail, setAccountEmail] = useState<string | null>(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    // GH-1516: mobile collapses the long body (desc clamped to 2 lines + steps hidden)
    // behind a "See more" toggle — same convention as PaymentMethodCard. sm+ always full.
    const [expanded, setExpanded] = useState(false);

    const isVerifyMode = mode === 'verify';
    const isOnboardMode = mode === 'onboard';

    useEffect(() => {
        if (!(isOnboardMode || isVerifyMode) || !tenantId) return;
        fetch(`/api/stripe/connect/status?tenantId=${tenantId}`)
            .then(r => r.json())
            .then(d => { if (d.success && d.data?.email) setAccountEmail(d.data.email); })
            .catch(() => {});
    }, [isOnboardMode, isVerifyMode, tenantId]);
    const isLoading = isVerifyMode ? isVerifying : isOnboardMode ? isOnboarding : isConnecting;

    const title = isVerifyMode ? pt.stripeVerifyTitle : isOnboardMode ? pt.stripeOnboardTitle : pt.stripeConnectTitle;
    const desc = isVerifyMode ? pt.stripeVerifyDesc : isOnboardMode ? pt.stripeOnboardDesc : pt.stripeConnectDesc;
    const ctaLabel = isVerifyMode ? pt.stripeVerifyCta : isOnboardMode ? pt.stripeOnboardCta : pt.stripeConnectCta;
    const loadingLabel = isVerifyMode ? pt.stripeVerifying : isOnboardMode ? pt.stripeOnboarding : pt.stripeConnecting;
    const handleClick = isVerifyMode ? onVerify : isOnboardMode ? onOnboard : onConnect;

    const steps = (isVerifyMode || isOnboardMode)
        ? null
        : [pt.stripeStep1, pt.stripeStep2, pt.stripeStep3];

    return (
        <div
            className="anim-pay-hero relative flex flex-col sm:grid sm:grid-cols-[56px_1fr_auto] items-start sm:items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] overflow-hidden"
            style={{
                background: 'var(--dash-surface)',
                border: '1px solid var(--dash-border)',
            }}
        >

            {/* Icon + mobile title. GH-1516: on mobile the title sits beside the icon on one
                row; `sm:contents` dissolves this wrapper on sm+ so the icon stays a direct
                grid child and the desktop 3-column layout is untouched. */}
            <div className="flex items-center gap-[14px] sm:contents">
                <div
                    className="w-[48px] h-[48px] rounded-[14px] grid place-items-center shrink-0"
                    style={{
                        border: isVerifyMode ? '1px solid rgba(251,191,36,0.40)' : '1px solid rgba(14,165,233,0.35)',
                        color: isVerifyMode ? '#fbbf24' : '#7dd3fc',
                        background: isVerifyMode
                            ? 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.12))'
                            : 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(45,212,191,0.18))',
                        boxShadow: isVerifyMode
                            ? '0 8px 20px -6px rgba(251,191,36,0.30)'
                            : '0 8px 20px -6px rgba(14,165,233,0.40)',
                    }}
                >
                    {isVerifyMode ? <BadgeCheck className="w-5 h-5" /> : <Link className="w-5 h-5" />}
                </div>
                <h4 className="sm:hidden text-[17px] font-bold text-slate-50 tracking-tight m-0 min-w-0">
                    {title}
                </h4>
            </div>

            {/* Body */}
            <div className="min-w-0">
                <h4 className="hidden sm:block text-[17px] font-bold text-slate-50 tracking-tight mt-[2px] mb-[6px]">
                    {title}
                </h4>
                <p className={`text-[13.5px] text-slate-400 leading-[1.55] mb-[12px] max-w-[540px]${expanded ? '' : ' line-clamp-2 sm:line-clamp-none'}`}>
                    {desc}
                </p>
                {(isOnboardMode || isVerifyMode) && connectedAccountId && (
                    <div className="inline-flex items-center gap-[8px] mb-[14px] px-[10px] py-[5px] rounded-[8px] border border-white/[0.07] bg-white/[0.04]">
                        <span className="w-[6px] h-[6px] rounded-full bg-sky-400 shrink-0" />
                        <span className="font-mono text-[12px] text-slate-300 tracking-tight">
                            {connectedAccountId}
                        </span>
                        {accountEmail && (
                            <span className="text-[12px] text-slate-400">· {accountEmail}</span>
                        )}
                        {onDisconnect && (
                            <button
                                type="button"
                                disabled={isDisconnecting}
                                onClick={async () => {
                                    setIsDisconnecting(true);
                                    try { await onDisconnect(); } finally { setIsDisconnecting(false); }
                                }}
                                className="inline-flex items-center gap-[4px] ml-[4px] text-[11.5px] text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
                            >
                                {isDisconnecting
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Unlink className="w-3 h-3" />
                                }
                                {pt.stripeSwitchAccount}
                            </button>
                        )}
                    </div>
                )}
                {steps && (
                    <ul className={`${expanded ? 'flex' : 'hidden sm:flex'} flex-wrap gap-[14px_24px] list-none m-0 p-0`}>
                        {steps.map((step, i) => (
                            <li key={i} className="inline-flex items-center gap-2 text-[12.5px] text-slate-300">
                                <span className="w-5 h-5 rounded-full border border-sky-500/[0.28] bg-sky-500/[0.12] text-sky-300 font-mono text-[11px] font-bold grid place-items-center shrink-0">
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ul>
                )}
                {/* Mobile-only toggle revealing the full desc + the 3 steps */}
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    aria-expanded={expanded}
                    className={`sm:hidden text-[12px] text-[hsl(var(--primary))] font-medium hover:underline${expanded ? ' mt-[10px]' : ''}`}
                >
                    {expanded ? pt.seeLess : pt.seeMore}
                </button>
            </div>

            {/* CTA. GH-1516 mobile: one row — trust note left, button right (row-reverse
                keeps the button first in DOM/tab order). sm+ restores the stacked
                right-aligned column of the desktop grid. */}
            <div className="flex w-full flex-row-reverse flex-wrap items-center justify-between gap-2 shrink-0 relative z-[1] sm:w-auto sm:flex-col sm:items-end sm:justify-start">
                <Button
                    type="button"
                    onClick={handleClick}
                    disabled={isLoading}
                    className="h-12 gap-2 whitespace-nowrap"
                    // Connect mode keeps the shared blue->teal gradient (white text from the
                    // variant). Onboard/Verify stay amber (distinct state) — bg overridden inline,
                    // text remains white.
                    style={(isVerifyMode || isOnboardMode) ? {
                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        boxShadow: '0 4px 14px rgba(251,191,36,0.30)',
                    } : undefined}
                >
                    {isLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{loadingLabel}</>
                        : <>{ctaLabel}<ArrowRight className="w-4 h-4" /></>
                    }
                </Button>
                {isOnboardMode && (
                    <button
                        type="button"
                        onClick={onVerify}
                        disabled={isVerifying}
                        className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap underline underline-offset-2"
                    >
                        {isVerifying ? pt.stripeVerifying : pt.stripeOnboardSecondary}
                    </button>
                )}
                <div className="inline-flex items-center gap-[6px] text-[11.5px] text-slate-500 whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    {pt.stripeTrust}
                </div>
            </div>
        </div>
    );
}
