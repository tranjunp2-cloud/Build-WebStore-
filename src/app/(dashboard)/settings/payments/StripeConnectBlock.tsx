"use client";

import { useState, useEffect } from 'react';
import { Link, ArrowRight, ShieldCheck, Loader2, BadgeCheck, Unlink } from 'lucide-react';
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
            className="anim-pay-hero relative grid items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] border overflow-hidden"
            style={{
                gridTemplateColumns: '56px 1fr auto',
                borderColor: isVerifyMode ? 'hsl(var(--warning)/0.35)' : 'hsl(var(--info)/0.32)',
                background: isVerifyMode
                    ? 'radial-gradient(circle at 0% 0%, hsl(var(--warning)/0.12) 0%, transparent 55%), radial-gradient(circle at 100% 100%, hsl(var(--warning)/0.08) 0%, transparent 55%), var(--dash-surface)'
                    : 'radial-gradient(circle at 0% 0%, hsl(var(--info)/0.18) 0%, transparent 55%), radial-gradient(circle at 100% 100%, hsl(var(--primary)/0.14) 0%, transparent 55%), var(--dash-surface)',
                boxShadow: isVerifyMode
                    ? '0 0 0 1px hsl(var(--warning)/0.06), 0 16px 40px -16px hsl(var(--warning)/0.25)'
                    : '0 0 0 1px hsl(var(--info)/0.06), 0 16px 40px -16px hsl(var(--info)/0.35)',
            }}
        >
            {/* Decorative glow */}
            <div
                className="absolute pointer-events-none blur-[20px]"
                aria-hidden="true"
                style={{ inset: '-40% -10% auto auto', width: 380, height: 220, background: isVerifyMode ? 'radial-gradient(ellipse at center, hsl(var(--warning)/0.12), transparent 60%)' : 'radial-gradient(ellipse at center, hsl(var(--primary)/0.18), transparent 60%)' }}
            />

            {/* Icon */}
            <div
                className="w-[48px] h-[48px] rounded-[14px] grid place-items-center shrink-0"
                style={{
                    border: isVerifyMode ? '1px solid hsl(var(--warning)/0.40)' : '1px solid hsl(var(--info)/0.35)',
                    color: isVerifyMode ? 'hsl(var(--warning))' : 'hsl(var(--info))',
                    background: isVerifyMode
                        ? 'linear-gradient(135deg, hsl(var(--warning)/0.18), hsl(var(--warning)/0.12))'
                        : 'linear-gradient(135deg, hsl(var(--info)/0.18), hsl(var(--primary)/0.18))',
                    boxShadow: isVerifyMode
                        ? '0 8px 20px -6px hsl(var(--warning)/0.30)'
                        : '0 8px 20px -6px hsl(var(--info)/0.40)',
                }}
            >
                {isVerifyMode ? <BadgeCheck className="w-5 h-5" /> : <Link className="w-5 h-5" />}
            </div>

            {/* Body */}
            <div className="min-w-0">
                <h4 className="text-[17px] font-bold text-slate-50 tracking-tight mt-[2px] mb-[6px]">
                    {title}
                </h4>
                <p className="text-[13.5px] text-slate-400 leading-[1.55] mb-[12px] max-w-[540px]">
                    {desc}
                </p>
                {(isOnboardMode || isVerifyMode) && connectedAccountId && (
                    <div className="inline-flex items-center gap-[8px] mb-[14px] px-[10px] py-[5px] rounded-[8px] border border-white/[0.07] bg-white/[0.04]">
                        <span className="w-[6px] h-[6px] rounded-full bg-[hsl(var(--info))] shrink-0" />
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
                                className="inline-flex items-center gap-[4px] ml-[4px] text-[11.5px] text-slate-500 hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-wait whitespace-nowrap"
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
                    <ul className="flex flex-wrap gap-[14px_24px] list-none m-0 p-0">
                        {steps.map((step, i) => (
                            <li key={i} className="inline-flex items-center gap-2 text-[12.5px] text-slate-300">
                                <span className="w-5 h-5 rounded-full border border-[hsl(var(--info)/0.28)] bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))] font-mono text-[11px] font-bold grid place-items-center shrink-0">
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* CTA */}
            <div className="flex flex-col items-end gap-2 shrink-0 relative z-[1]">
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 h-[44px] px-[18px] rounded-[10px] text-[14px] font-semibold !text-white transition-all hover:brightness-110 whitespace-nowrap disabled:opacity-70 disabled:cursor-wait"
                    style={{
                        background: isVerifyMode
                            ? 'linear-gradient(135deg, hsl(var(--warning)) 0%, hsl(var(--warning)) 100%)'
                            : isOnboardMode
                                ? 'linear-gradient(135deg, hsl(var(--warning)) 0%, hsl(var(--warning)) 100%)'
                                : 'linear-gradient(135deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)',
                        boxShadow: (isVerifyMode || isOnboardMode)
                            ? '0 4px 14px hsl(var(--warning)/0.30)'
                            : '0 4px 14px hsl(var(--info)/0.30)',
                    }}
                >
                    {isLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{loadingLabel}</>
                        : <>{ctaLabel}<ArrowRight className="w-4 h-4" /></>
                    }
                </button>
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
                    <ShieldCheck className="w-3 h-3 text-success" />
                    {pt.stripeTrust}
                </div>
            </div>
        </div>
    );
}
