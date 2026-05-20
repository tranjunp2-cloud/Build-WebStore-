"use client";

import { useState } from 'react';
import { Link, X, Hash, Eye, EyeOff, ShieldCheck, ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n';

interface Props {
    onClose: () => void;
    onSuccess: (accountId: string) => void;
}

export function StripeConnectModal({ onClose, onSuccess }: Props) {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;

    const [accountId, setAccountId] = useState('');
    const [merchantCode, setMerchantCode] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!accountId.trim() || !secretKey.trim()) return;
        setIsSaving(true);
        try {
            onSuccess(accountId.trim());
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-[#020612]/[0.62] backdrop-blur-[8px] grid place-items-center p-6 z-[100]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stripe-connect-title"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-[520px] bg-[#141e2e] border border-white/[0.08] rounded-[16px] overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_20px_50px_-12px_rgba(0,0,0,0.65)]">
                {/* Header */}
                <div className="flex items-start gap-3 px-[22px] py-5 border-b border-white/[0.08]">
                    <div
                        className="w-9 h-9 rounded-[10px] grid place-items-center shrink-0"
                        style={{
                            background: 'linear-gradient(135deg, rgba(14,165,233,0.14), rgba(45,212,191,0.14))',
                            border: '1px solid rgba(14,165,233,0.32)',
                            color: '#7dd3fc',
                            boxShadow: '0 4px 14px -4px rgba(14,165,233,0.40)',
                        }}
                    >
                        <Link className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 pt-px">
                        <h3 id="stripe-connect-title" className="text-[17px] font-bold text-slate-50 tracking-tight m-0 mb-1">
                            {pt.stripeConnectModalTitle}
                        </h3>
                        <p className="text-[12.5px] text-slate-400 m-0 leading-[1.5]">
                            {pt.stripeConnectModalSub}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-[30px] h-[30px] rounded-[8px] grid place-items-center text-slate-400 hover:bg-white/[0.06] hover:text-slate-50 transition-all shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-[22px] py-4 flex flex-col gap-4">
                    {/* Account ID */}
                    <div className="flex flex-col gap-[6px]">
                        <label className="flex items-center text-[13px] font-semibold text-slate-300">
                            {pt.stripeAccountIdLabel}
                            <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] px-[7px] py-[2px] rounded-full bg-white/[0.04] border border-white/[0.08]">Required</span>
                        </label>
                        <div
                            className="flex items-center rounded-[10px] overflow-hidden transition-all"
                            style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.08)' }}
                            onFocusCapture={e => { e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)'; e.currentTarget.style.borderColor = '#0ea5e9'; }}
                            onBlurCapture={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        >
                            <div className="px-[12px] h-[40px] grid place-items-center shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                                <Hash className="w-[13px] h-[13px] text-slate-400 opacity-70" />
                            </div>
                            <input
                                type="text"
                                value={accountId}
                                onChange={e => setAccountId(e.target.value)}
                                placeholder={pt.stripeAccountIdPlaceholder}
                                autoFocus
                                className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-mono placeholder:text-slate-600 min-w-0"
                            />
                        </div>
                    </div>

                    {/* Merchant Code (optional) */}
                    <div className="flex flex-col gap-[6px]">
                        <label className="text-[13px] font-semibold text-slate-300">{pt.stripeMerchantCodeLabel}</label>
                        <div
                            className="flex items-center rounded-[10px] overflow-hidden transition-all"
                            style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.08)' }}
                            onFocusCapture={e => { e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)'; e.currentTarget.style.borderColor = '#0ea5e9'; }}
                            onBlurCapture={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        >
                            <input
                                type="text"
                                value={merchantCode}
                                onChange={e => setMerchantCode(e.target.value)}
                                placeholder={pt.stripeMerchantCodePlaceholder}
                                className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-mono placeholder:text-slate-600 min-w-0"
                            />
                        </div>
                    </div>

                    {/* Secret Key */}
                    <div className="flex flex-col gap-[6px]">
                        <label className="flex items-center text-[13px] font-semibold text-slate-300">
                            {pt.stripeSecretKeyLabel}
                            <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] px-[7px] py-[2px] rounded-full bg-white/[0.04] border border-white/[0.08]">Required</span>
                        </label>
                        <div
                            className="flex items-center rounded-[10px] overflow-hidden transition-all"
                            style={{ background: '#0d1525', border: '1px solid rgba(255,255,255,0.08)' }}
                            onFocusCapture={e => { e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)'; e.currentTarget.style.borderColor = '#0ea5e9'; }}
                            onBlurCapture={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        >
                            <input
                                type={showSecret ? 'text' : 'password'}
                                value={secretKey}
                                onChange={e => setSecretKey(e.target.value)}
                                placeholder={pt.stripeSecretKeyPlaceholder}
                                className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-mono placeholder:text-slate-600 min-w-0"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecret(v => !v)}
                                className="px-[12px] h-[40px] grid place-items-center text-slate-400 hover:text-slate-50 transition-colors shrink-0"
                                style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}
                            >
                                {showSecret ? <EyeOff className="w-[15px] h-[15px]" /> : <Eye className="w-[15px] h-[15px]" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 px-[22px] py-5 border-t border-white/[0.08]">
                    <a
                        href="https://dashboard.stripe.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-[7px] px-[10px] h-9 rounded-[8px] text-[13px] font-semibold text-sky-400 hover:text-sky-300 hover:bg-sky-500/[0.08] transition-all mr-auto"
                    >
                        <ExternalLink className="w-[13px] h-[13px]" />
                        {pt.stripeDashboardLink}
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-2 h-9 px-[14px] rounded-[8px] text-[13px] font-semibold text-slate-300 border border-white/[0.08] hover:bg-white/[0.04] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!accountId.trim() || !secretKey.trim() || isSaving}
                        className="inline-flex items-center gap-2 h-9 px-[14px] rounded-[8px] text-[13px] font-bold text-[#052e22] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                        style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                            boxShadow: '0 0 0 1px rgba(16,185,129,0.40) inset, 0 6px 16px -4px rgba(16,185,129,0.40)',
                        }}
                    >
                        <ShieldCheck className="w-[14px] h-[14px]" />
                        {isSaving ? 'Saving...' : pt.stripeSaveVerify}
                    </button>
                </div>
            </div>
        </div>
    );
}
