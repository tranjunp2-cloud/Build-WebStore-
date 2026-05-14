"use client";

import { Link, ArrowRight, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n';

export function StripeConnectBlock() {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;
    const steps = [pt.stripeStep1, pt.stripeStep2, pt.stripeStep3];

    return (
        <div
            className="anim-pay-hero relative grid items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] border border-sky-500/[0.32] overflow-hidden"
            style={{
                gridTemplateColumns: '56px 1fr auto',
                background: 'radial-gradient(circle at 0% 0%, rgba(14,165,233,0.18) 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(45,212,191,0.14) 0%, transparent 55%), #141e2e',
                boxShadow: '0 0 0 1px rgba(14,165,233,0.06), 0 16px 40px -16px rgba(14,165,233,0.35)',
            }}
        >
            {/* Decorative glow */}
            <div
                className="absolute pointer-events-none blur-[20px]"
                aria-hidden="true"
                style={{ inset: '-40% -10% auto auto', width: 380, height: 220, background: 'radial-gradient(ellipse at center, rgba(45,212,191,0.18), transparent 60%)' }}
            />

            {/* Icon */}
            <div
                className="w-[48px] h-[48px] rounded-[14px] border border-sky-500/[0.35] text-sky-300 grid place-items-center shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(45,212,191,0.18))', boxShadow: '0 8px 20px -6px rgba(14,165,233,0.40)' }}
            >
                <Link className="w-5 h-5" />
            </div>

            {/* Body */}
            <div className="min-w-0">
                <h4 className="text-[17px] font-bold text-slate-50 tracking-tight mt-[2px] mb-[6px]">
                    {pt.stripeConnectTitle}
                </h4>
                <p className="text-[13.5px] text-slate-400 leading-[1.55] mb-[14px] max-w-[540px]">
                    {pt.stripeConnectDesc}
                </p>
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
            </div>

            {/* CTA */}
            <div className="flex flex-col items-end gap-2 shrink-0 relative z-[1]">
                <a
                    href="/api/stripe/connect/onboard"
                    className="inline-flex items-center gap-2 h-[44px] px-[18px] rounded-[10px] text-[14px] font-semibold text-[#042033] transition-all hover:brightness-110 whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #2dd4bf 100%)', boxShadow: '0 4px 14px rgba(14,165,233,0.30)' }}
                >
                    {pt.stripeConnectCta}
                    <ArrowRight className="w-4 h-4" />
                </a>
                <div className="inline-flex items-center gap-[6px] text-[11.5px] text-slate-500 whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    {pt.stripeTrust}
                </div>
            </div>
        </div>
    );
}
