"use client";

import { useState, useEffect } from 'react';
import { Check, ShieldCheck, ExternalLink, Unlink } from 'lucide-react';
import { useI18n } from '@/i18n';

interface Props {
    accountId: string | null;
    tenantId: string;
    onDisconnect?: () => Promise<void>;
}

export function XenditConnectedBar({ accountId, tenantId, onDisconnect }: Props) {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;
    const [showModal, setShowModal] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [businessName, setBusinessName] = useState<string | null>(null);

    useEffect(() => {
        if (!tenantId) return;
        fetch(`/api/xendit/connect/status?tenantId=${tenantId}`)
            .then(r => r.json())
            .then(d => {
                const info = d?.data;
                if (info?.businessName) setBusinessName(info.businessName);
                else if (info?.email) setBusinessName(info.email);
            })
            .catch(() => {});
    }, [tenantId]);

    useEffect(() => {
        if (!showModal) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showModal]);

    return (
        <>
            <div
                className="rounded-[12px] border border-emerald-500/[0.26] overflow-hidden"
                style={{
                    background: 'var(--dash-surface)',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset',
                }}
            >
                {/* Connected header row */}
                <div
                    className="flex items-center gap-[14px] px-[16px] py-[12px]"
                    style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.02) 60%, transparent 100%)' }}
                >
                    <span className="anim-scb-pulse w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                    <div className="w-8 h-8 rounded-[9px] bg-emerald-500/[0.12] border border-emerald-500/[0.28] text-emerald-400 grid place-items-center shrink-0">
                        <Check className="w-[15px] h-[15px]" />
                    </div>
                    <div className="flex flex-col gap-[2px] min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-50">
                            {pt.xenditConnectedBar}
                            {accountId && (
                                <span className="font-mono text-[12.5px] font-medium text-slate-300 px-2 py-[2px] bg-white/[0.04] border border-white/[0.08] rounded-[6px] tracking-tight">
                                    {accountId}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-[6px] text-[12px] text-slate-400">
                            <ShieldCheck className="w-[11px] h-[11px]" />
                            {businessName || pt.xenditKybVerified}
                        </div>
                    </div>
                    <div className="flex gap-[6px] shrink-0">
                        <a
                            href="https://dashboard.xendit.co"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-[6px] h-[30px] px-[11px] text-[12px] font-semibold text-dash-text-muted border border-dash-border rounded-[8px] hover:bg-dash-surface-hover hover:text-dash-text transition-all"
                        >
                            <ExternalLink className="w-3 h-3" />
                            {pt.xenditManage}
                        </a>
                        {onDisconnect && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="inline-flex items-center gap-[6px] h-[30px] px-[11px] text-[12px] font-semibold text-dash-text-muted border border-dash-border rounded-[8px] hover:bg-dash-surface-hover hover:text-dash-text transition-all"
                            >
                                <Unlink className="w-3 h-3" />
                                {pt.xenditDisconnect}
                            </button>
                        )}
                    </div>
                </div>

                {/* Supported payment methods */}
                <div className="px-[16px] py-[11px] border-t border-white/[0.06]">
                    <p className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-[0.06em] m-0 mb-[8px]">Supported payment methods</p>
                    <div className="flex flex-wrap gap-[6px]">
                        {['TNG eWallet', 'GrabPay', 'ShopeePay', 'DuitNow QR', 'FPX', 'Boost', 'MAE'].map(m => (
                            <span key={m} className="text-[11.5px] px-[9px] py-[3px] rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-300">
                                {m}
                            </span>
                        ))}
                        <span className="text-[11.5px] px-[9px] py-[3px] rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-500">
                            + more
                        </span>
                    </div>
                </div>
            </div>

            {showModal && (
                <div
                    className="fixed inset-0 bg-[#020612]/[0.62] backdrop-blur-[8px] grid place-items-center p-6 z-[100]"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
                >
                    <div className="w-full max-w-[440px] bg-[#141e2e] border border-white/[0.08] rounded-[16px] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.65)]">
                        <div className="p-6 pb-2 flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-[12px] bg-red-500/10 border border-red-500/[0.24] text-red-400 grid place-items-center shrink-0">
                                <Unlink className="w-[18px] h-[18px]" />
                            </div>
                            <div>
                                <h3 className="text-[17px] font-bold text-slate-50 tracking-tight mt-[2px] mb-[6px]">{pt.xenditDisconnectTitle}</h3>
                                <p className="text-[13.5px] leading-[1.55] text-slate-400 m-0">{pt.xenditDisconnectDesc}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-[18px_22px_22px]">
                            <button
                                onClick={() => setShowModal(false)}
                                className="inline-flex items-center gap-2 h-9 px-[14px] rounded-[8px] text-[13px] font-semibold text-slate-300 border border-white/[0.08] hover:bg-white/[0.04] transition-all"
                            >
                                {pt.xenditDisconnectKeep}
                            </button>
                            <button
                                onClick={async () => {
                                    setIsDisconnecting(true);
                                    try { await onDisconnect?.(); }
                                    finally { setIsDisconnecting(false); setShowModal(false); }
                                }}
                                disabled={isDisconnecting}
                                className="inline-flex items-center gap-2 h-9 px-[14px] rounded-[8px] text-[13px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-wait"
                                style={{ background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 0 0 1px rgba(239,68,68,0.45) inset, 0 6px 16px -4px rgba(239,68,68,0.45)' }}
                            >
                                {pt.xenditDisconnect}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
