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

    return (
        <>
            <div
                className="anim-pay-hero relative grid items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] overflow-hidden"
                style={{
                    gridTemplateColumns: '56px 1fr auto',
                    background: 'var(--dash-surface)',
                    border: '1px solid var(--dash-border)',
                }}
            >

                {/* Icon */}
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

                {/* Body */}
                <div className="min-w-0">
                    <h4 className="text-[17px] font-bold tracking-tight mt-[2px] mb-[6px]" style={{ color: 'var(--dash-text)' }}>
                        {pt.xenditConnectTitle}
                    </h4>
                    <p className="text-[13.5px] leading-[1.55] mb-[12px] max-w-[540px]" style={{ color: 'var(--dash-text-muted)' }}>
                        {pt.xenditConnectDesc}
                    </p>
                    <ul className="flex flex-wrap gap-[14px_24px] list-none m-0 p-0">
                        {[pt.xenditStep1, pt.xenditStep2, pt.xenditStep3].map((step, i) => (
                            <li key={i} className="inline-flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--dash-text)' }}>
                                <span className="w-5 h-5 rounded-full border border-cyan-500/[0.28] bg-cyan-500/[0.12] text-cyan-600 dark:text-cyan-300 font-mono text-[11px] font-bold grid place-items-center shrink-0">
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* CTA */}
                <div className="flex flex-col items-end gap-2 shrink-0 relative z-[1]">
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
