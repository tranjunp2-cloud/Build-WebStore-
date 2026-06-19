"use client";

import { useState, useEffect, useCallback } from 'react';
import { Link, X, Eye, EyeOff, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n';

interface Props {
    open: boolean;
    onClose: () => void;
    onSave?: (secretKey: string, callbackToken: string) => Promise<void>;
}

interface SecretFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    show: boolean;
    onToggleShow: () => void;
    steps: string[];
}

function SecretField({ label, value, onChange, placeholder, show, onToggleShow, steps }: SecretFieldProps) {
    return (
        <div>
            <div className="flex items-center mb-[8px]">
                <label className="text-[13px] font-semibold text-slate-300">{label}</label>
                <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] px-[7px] py-[2px] rounded-full bg-white/[0.04] border border-white/[0.08]">Required</span>
            </div>
            <div
                className="flex items-center rounded-[10px] overflow-hidden transition-all"
                style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                onFocusCapture={e => (e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)', e.currentTarget.style.borderColor = '#0ea5e9')}
                onBlurCapture={e => (e.currentTarget.style.boxShadow = '', e.currentTarget.style.borderColor = 'var(--dash-border)')}
            >
                <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent border-none outline-none px-[12px] h-[44px] text-[13px] text-slate-100 font-mono font-medium placeholder:text-slate-600 dark:placeholder:text-slate-600 min-w-0 focus:outline-none"
                />
                <button
                    type="button"
                    onClick={onToggleShow}
                    className="px-3 h-[44px] grid place-items-center text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                    style={{ borderLeft: '1px solid var(--dash-border)' }}
                >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
            <ol className="mt-[12px] space-y-[8px] list-none m-0 p-0 text-[12.5px] text-slate-500 leading-[1.45]">
                {steps.map((step, i) => (
                    <li key={i} className="flex gap-[8px] items-baseline">
                        <span className="text-slate-500 font-mono shrink-0 select-none">{i + 1}.</span>
                        <span>{step}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export function XenditConnectModal({ open, onClose, onSave }: Props) {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;

    const [secretKey, setSecretKey] = useState('');
    const [callbackToken, setCallbackToken] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setSecretKey('');
            setCallbackToken('');
            setShowSecret(false);
            setShowToken(false);
            setIsSaving(false);
            setSaveError(null);
        }
    }, [open]);

    const handleClose = useCallback(() => {
        if (!isSaving) onClose();
    }, [isSaving, onClose]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, handleClose]);

    const handleSubmit = async () => {
        if (!secretKey.trim() || !callbackToken.trim()) { setSaveError(pt.xenditValidationRequired); return; }
        if (!secretKey.trim().startsWith('xnd_')) { setSaveError(pt.xenditValidationKey); return; }
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave?.(secretKey.trim(), callbackToken.trim());
            onClose();
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : pt.xenditValidationRequired);
        } finally {
            setIsSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 grid place-items-center p-6 z-[100]"
            style={{ background: 'rgba(2,6,18,0.62)', backdropFilter: 'blur(8px)' }}
            onClick={handleClose}
        >
            <div
                className="w-full max-w-[520px] rounded-[16px] border border-white/[0.08]"
                style={{ background: '#141e2e', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.65)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start gap-3 p-[20px_22px_16px] border-b border-white/[0.08]">
                    <div
                        className="w-9 h-9 rounded-[10px] grid place-items-center shrink-0 mt-[2px]"
                        style={{ border: '1px solid rgba(45,212,191,0.35)', color: '#5eead4', background: 'linear-gradient(135deg, rgba(45,212,191,0.18), rgba(14,165,233,0.18))' }}
                    >
                        <Link className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[20px] font-bold text-slate-50 leading-tight">{pt.xenditModalTitle}</p>
                        <p className="text-[13px] text-slate-400 leading-[1.5] mt-[5px]">{pt.xenditModalSubtitle}</p>
                    </div>
                    <button
                        type="button" onClick={handleClose} disabled={isSaving}
                        className="w-[30px] h-[30px] grid place-items-center rounded-[6px] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors disabled:opacity-50 shrink-0 mt-[1px]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form body */}
                <div className="p-[20px_22px_8px] flex flex-col gap-[20px]">
                    <SecretField
                        label={pt.xenditSecretKeyLabel}
                        value={secretKey}
                        onChange={setSecretKey}
                        placeholder={pt.xenditSecretKeyPlaceholder}
                        show={showSecret}
                        onToggleShow={() => setShowSecret(v => !v)}
                        steps={[pt.xenditSecretKeyStep1, pt.xenditSecretKeyStep2, pt.xenditSecretKeyStep3, pt.xenditSecretKeyStep4]}
                    />
                    <SecretField
                        label={pt.xenditCallbackTokenLabel}
                        value={callbackToken}
                        onChange={setCallbackToken}
                        placeholder={pt.xenditCallbackTokenPlaceholder}
                        show={showToken}
                        onToggleShow={() => setShowToken(v => !v)}
                        steps={[pt.xenditCallbackTokenStep1, pt.xenditCallbackTokenStep2, pt.xenditCallbackTokenStep3]}
                    />
                    {saveError && (
                        <p className="flex items-center gap-[6px] text-[12.5px] text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {saveError}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 p-[16px_22px_20px] border-t border-white/[0.08] mt-[4px]">
                    <div className="flex flex-col gap-[2px] mr-auto">
                        <span className="text-[12px] text-slate-400">{pt.xenditLoginPrompt}</span>
                        <a
                            href="https://dashboard.xendit.co/login"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-[4px] text-[12px] text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                            {pt.xenditLoginLink}
                        </a>
                    </div>
                    <button
                        type="button" onClick={handleClose} disabled={isSaving}
                        className="h-9 px-[16px] rounded-[8px] text-[13px] font-semibold text-slate-300 border border-white/[0.15] hover:bg-white/[0.06] transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                        {pt.cancel}
                    </button>
                    <button
                        type="button" onClick={handleSubmit}
                        disabled={!secretKey || !callbackToken || isSaving}
                        className="inline-flex items-center gap-[6px] h-9 px-[16px] rounded-[8px] text-[13px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                        style={{ background: '#22c55e' }}
                    >
                        {isSaving
                            ? <><Loader2 className="w-4 h-4 animate-spin" />{pt.xenditSaving}</>
                            : <><Link className="w-3.5 h-3.5" />{pt.xenditConnectAccountBtn}</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
