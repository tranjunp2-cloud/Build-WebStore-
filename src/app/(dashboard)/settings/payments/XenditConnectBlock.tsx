"use client";

import { useState } from 'react';
import { Link, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { XenditConnectModal } from './XenditConnectModal';

export interface XenditConnectBlockProps {
    tenantId?: string;
    onSaveKeys?: (secretKey: string, callbackToken: string) => Promise<void>;
}

export function XenditConnectBlock({ tenantId, onSaveKeys }: XenditConnectBlockProps) {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;
    const [showModal, setShowModal] = useState(false);
    // GH-1516: mobile collapses desc (2-line clamp) + steps behind "See more" —
    // mirrors StripeConnectBlock so both connect heroes behave identically.
    const [expanded, setExpanded] = useState(false);

    return (
        <>
            <div
                className="anim-pay-hero relative flex flex-col sm:grid sm:grid-cols-[56px_1fr_auto] items-start sm:items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] overflow-hidden"
                style={{
                    background: 'var(--dash-surface)',
                    border: '1px solid var(--dash-border)',
                }}
            >

                {/* Icon + mobile title. GH-1516: on mobile the title sits beside the icon on
                    one row; `sm:contents` dissolves this wrapper on sm+ so the desktop
                    3-column grid is untouched. Mirrors StripeConnectBlock. */}
                <div className="flex items-center gap-[14px] sm:contents">
                    <div
                        className="w-[48px] h-[48px] rounded-[14px] grid place-items-center shrink-0"
                        style={{
                            border: '1px solid rgba(45,212,191,0.35)',
                            color: '#5eead4',
                            background: 'linear-gradient(135deg, rgba(45,212,191,0.18), rgba(14,165,233,0.18))',
                            boxShadow: '0 8px 20px -6px rgba(45,212,191,0.40)',
                        }}
                    >
                        <Link className="w-5 h-5" />
                    </div>
                    <h4 className="sm:hidden text-[17px] font-bold tracking-tight m-0 min-w-0" style={{ color: 'var(--dash-text)' }}>
                        {pt.xenditConnectTitle}
                    </h4>
                </div>

                {/* Body */}
                <div className="min-w-0">
                    <h4 className="hidden sm:block text-[17px] font-bold tracking-tight mt-[2px] mb-[6px]" style={{ color: 'var(--dash-text)' }}>
                        {pt.xenditConnectTitle}
                    </h4>
                    <p className={`text-[13.5px] leading-[1.55] mb-[12px] max-w-[540px]${expanded ? '' : ' line-clamp-2 sm:line-clamp-none'}`} style={{ color: 'var(--dash-text-muted)' }}>
                        {pt.xenditConnectDesc}
                    </p>
                    <ul className={`${expanded ? 'flex' : 'hidden sm:flex'} flex-wrap gap-[14px_24px] list-none m-0 p-0`}>
                        {[pt.xenditStep1, pt.xenditStep2, pt.xenditStep3].map((step, i) => (
                            <li key={i} className="inline-flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--dash-text)' }}>
                                <span className="w-5 h-5 rounded-full border border-cyan-500/[0.28] bg-cyan-500/[0.12] text-cyan-600 dark:text-cyan-300 font-mono text-[11px] font-bold grid place-items-center shrink-0">
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ul>
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

                {/* CTA. GH-1516 mobile: one row — trust note left, button right; sm+ restores
                    the stacked right-aligned column. Mirrors StripeConnectBlock. */}
                <div className="flex w-full flex-row-reverse flex-wrap items-center justify-between gap-2 shrink-0 relative z-[1] sm:w-auto sm:flex-col sm:items-end sm:justify-start">
                    <Button
                        type="button"
                        onClick={() => setShowModal(true)}
                        disabled={!tenantId}
                        className="h-[44px] gap-2 whitespace-nowrap"
                    >
                        {pt.xenditConnectCta}
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                    <div className="inline-flex items-center gap-[6px] text-[11.5px] whitespace-nowrap" style={{ color: 'var(--dash-text-muted)' }}>
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        {pt.xenditTrust}
                    </div>
                </div>
            </div>

            <XenditConnectModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSave={async (secretKey, callbackToken) => {
                    await onSaveKeys?.(secretKey, callbackToken);
                }}
            />
        </>
    );
}
