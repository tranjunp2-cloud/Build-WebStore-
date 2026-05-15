"use client";

import { Link, ArrowRight, ShieldCheck, Loader2, BadgeCheck } from 'lucide-react';
import { useI18n } from '@/i18n';

interface Props {
    mode?: 'connect' | 'verify';
    onConnect?: () => void;
    isConnecting?: boolean;
    onVerify?: () => void;
    isVerifying?: boolean;
}

export function StripeConnectBlock({
    mode = 'connect',
    onConnect,
    isConnecting = false,
    onVerify,
    isVerifying = false,
}: Props) {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;

    const isVerifyMode = mode === 'verify';
    const isLoading = isVerifyMode ? isVerifying : isConnecting;

    const title = isVerifyMode ? pt.stripeVerifyTitle : pt.stripeConnectTitle;
    const desc = isVerifyMode ? pt.stripeVerifyDesc : pt.stripeConnectDesc;
    const ctaLabel = isVerifyMode ? pt.stripeVerifyCta : pt.stripeConnectCta;
    const loadingLabel = isVerifyMode ? pt.stripeVerifying : pt.stripeConnecting;
    const handleClick = isVerifyMode ? onVerify : onConnect;

    const steps = isVerifyMode
        ? null
        : [pt.stripeStep1, pt.stripeStep2, pt.stripeStep3];

    return (
        <div
            className="anim-pay-hero relative grid items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] border overflow-hidden"
            style={{
                gridTemplateColumns: '56px 1fr auto',
                borderColor: isVerifyMode ? 'rgba(251,191,36,0.35)' : 'rgba(14,165,233,0.32)',
                background: isVerifyMode
                    ? 'radial-gradient(circle at 0% 0%, rgba(251,191,36,0.12) 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(245,158,11,0.08) 0%, transparent 55%), #141e2e'
                    : 'radial-gradient(circle at 0% 0%, rgba(14,165,233,0.18) 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(45,212,191,0.14) 0%, transparent 55%), #141e2e',
                boxShadow: isVerifyMode
                    ? '0 0 0 1px rgba(251,191,36,0.06), 0 16px 40px -16px rgba(251,191,36,0.25)'
                    : '0 0 0 1px rgba(14,165,233,0.06), 0 16px 40px -16px rgba(14,165,233,0.35)',
            }}
        >
            {/* Decorative glow */}
            <div
                className="absolute pointer-events-none blur-[20px]"
                aria-hidden="true"
                style={{ inset: '-40% -10% auto auto', width: 380, height: 220, background: isVerifyMode ? 'radial-gradient(ellipse at center, rgba(251,191,36,0.12), transparent 60%)' : 'radial-gradient(ellipse at center, rgba(45,212,191,0.18), transparent 60%)' }}
            />

            {/* Icon */}
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

            {/* Body */}
            <div className="min-w-0">
                <h4 className="text-[17px] font-bold text-slate-50 tracking-tight mt-[2px] mb-[6px]">
                    {title}
                </h4>
                <p className="text-[13.5px] text-slate-400 leading-[1.55] mb-[14px] max-w-[540px]">
                    {desc}
                </p>
                {steps && (
                    <ul className="flex flex-wrap gap-[14px_24px] list-none m-0 p-0">
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
            </div>

            {/* CTA */}
            <div className="flex flex-col items-end gap-2 shrink-0 relative z-[1]">
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 h-[44px] px-[18px] rounded-[10px] text-[14px] font-semibold text-[#042033] transition-all hover:brightness-110 whitespace-nowrap disabled:opacity-70 disabled:cursor-wait"
                    style={{
                        background: isVerifyMode
                            ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                            : 'linear-gradient(135deg, #0ea5e9 0%, #2dd4bf 100%)',
                        boxShadow: isVerifyMode
                            ? '0 4px 14px rgba(251,191,36,0.30)'
                            : '0 4px 14px rgba(14,165,233,0.30)',
                    }}
                >
                    {isLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{loadingLabel}</>
                        : <>{ctaLabel}<ArrowRight className="w-4 h-4" /></>
                    }
                </button>
                <div className="inline-flex items-center gap-[6px] text-[11.5px] text-slate-500 whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    {pt.stripeTrust}
                </div>
            </div>
        </div>
    );
}
