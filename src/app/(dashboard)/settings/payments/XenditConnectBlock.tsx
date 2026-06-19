"use client";

import { useState } from 'react';
import { Link, ArrowRight, ShieldCheck } from 'lucide-react';
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
                className="relative grid items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] border overflow-hidden"
                style={{
                    gridTemplateColumns: '56px 1fr auto',
                    borderColor: 'rgba(45,212,191,0.32)',
                    background: 'radial-gradient(circle at 0% 0%, rgba(45,212,191,0.12) 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(14,165,233,0.08) 0%, transparent 52%), var(--dash-surface)',
                    boxShadow: '0 0 0 1px rgba(45,212,191,0.06), 0 16px 40px -16px rgba(45,212,191,0.35)',
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
                    <h4 className="text-[17px] font-bold text-slate-50 tracking-tight mt-[2px] mb-[6px]">
                        {pt.xenditConnectTitle}
                    </h4>
                    <p className="text-[13.5px] text-slate-400 leading-[1.55] mb-[12px] max-w-[540px]">
                        {pt.xenditConnectDesc}
                    </p>
                    <ul className="flex flex-wrap gap-[14px_24px] list-none m-0 p-0">
                        {[pt.xenditStep1, pt.xenditStep2, pt.xenditStep3].map((step, i) => (
                            <li key={i} className="inline-flex items-center gap-2 text-[12.5px] text-slate-300">
                                <span className="w-5 h-5 rounded-full border border-cyan-500/[0.28] bg-cyan-500/[0.12] text-cyan-300 font-mono text-[11px] font-bold grid place-items-center shrink-0">
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* CTA */}
                <div className="flex flex-col items-end gap-2 shrink-0 relative z-[1]">
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        disabled={!tenantId}
                        className="inline-flex items-center gap-2 h-[44px] px-[18px] rounded-[10px] text-[14px] font-semibold text-[#042033] transition-all hover:brightness-110 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                            background: 'linear-gradient(135deg, #0ea5e9 0%, #2dd4bf 100%)',
                            boxShadow: '0 4px 14px rgba(14,165,233,0.30)',
                        }}
                    >
                        {pt.xenditConnectCta}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <div className="inline-flex items-center gap-[6px] text-[11.5px] text-slate-500 whitespace-nowrap">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
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
