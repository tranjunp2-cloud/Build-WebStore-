"use client";

import { useState } from 'react';
import { Link, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@/i18n';

export interface XenditConnectBlockProps {
    tenantId?: string;
    onSaveKeys?: (secretKey: string, callbackToken: string) => Promise<void>;
}

// ── Model B (XenPlatform) props — commented out, kept for reference ──
// export interface XenditConnectBlockProps {
//     status: 'NOT_CONNECTED' | 'INVITED' | 'REGISTERED' | 'AWAITING_DOCS' | 'PENDING_VERIFICATION' | 'LIVE' | 'SUSPENDED';
//     tenantId?: string;
//     onConnected?: (accountId: string, status: string) => void;
//     onStatusChange?: (status: string) => void;
// }
//
// const POLL_INTERVAL_MS = 10_000;
// const PENDING_STATUSES = new Set(['INVITED', 'REGISTERED', 'AWAITING_DOCS', 'PENDING_VERIFICATION']);

export function XenditConnectBlock({ tenantId, onSaveKeys }: XenditConnectBlockProps) {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;
    const [secretKey, setSecretKey] = useState('');
    const [callbackToken, setCallbackToken] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // ── Model B (XenPlatform) state — commented out ──
    // const [isConnecting, setIsConnecting] = useState(false);
    // const [isResending, setIsResending] = useState(false);
    // const [connectError, setConnectError] = useState<string | null>(null);
    // const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
    // const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Model B polling — commented out ──
    // useEffect(() => {
    //     if (!PENDING_STATUSES.has(status) || !tenantId) { ... }
    //     const poll = async () => { ... };
    //     pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    //     return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // }, [status, tenantId, onStatusChange]);

    // ── Model B handleConnect — commented out ──
    // const handleConnect = async () => {
    //     const res = await fetch('/api/xendit/connect', { method: 'POST', ... });
    //     ...
    // };

    const handleSave = async () => {
        if (!secretKey.trim() || !callbackToken.trim()) {
            setSaveError(pt.xenditValidationRequired);
            return;
        }
        if (!secretKey.trim().startsWith('xnd_')) {
            setSaveError(pt.xenditValidationKey);
            return;
        }
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSaveKeys?.(secretKey.trim(), callbackToken.trim());
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : pt.xenditValidationRequired);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Model B SUSPENDED render — commented out ──
    // if (status === 'SUSPENDED') { ... }

    // ── Model B PENDING render (INVITED/REGISTERED/AWAITING_DOCS/PENDING_VERIFICATION) — commented out ──
    // if (PENDING_STATUSES.has(status) && status !== 'NOT_CONNECTED') { ... }

    // ── NOT_CONNECTED (Model C) ──────────────────────────────────────────────
    return (
        <div
            className="relative rounded-[18px] border overflow-hidden mb-[18px]"
            style={{
                borderColor: 'hsl(var(--primary)/0.32)',
                background: 'radial-gradient(circle at 0% 0%, hsl(var(--info)/0.18) 0%, transparent 55%), radial-gradient(circle at 100% 100%, hsl(var(--primary)/0.14) 0%, transparent 55%), var(--dash-surface)',
                boxShadow: '0 0 0 1px hsl(var(--primary)/0.06), 0 16px 40px -16px hsl(var(--primary)/0.35)',
            }}
        >
            {/* Decorative glow */}
            <div
                className="absolute pointer-events-none blur-[20px]"
                aria-hidden="true"
                style={{ inset: '-40% -10% auto auto', width: 380, height: 220, background: 'radial-gradient(ellipse at center, hsl(var(--primary)/0.18), transparent 60%)' }}
            />

            <div className="relative grid items-start gap-[22px] p-[22px_26px]" style={{ gridTemplateColumns: '56px 1fr' }}>
                {/* Icon */}
                <div
                    className="w-[48px] h-[48px] rounded-[14px] grid place-items-center shrink-0"
                    style={{
                        border: '1px solid hsl(var(--primary)/0.35)',
                        color: 'hsl(var(--primary))',
                        background: 'linear-gradient(135deg, hsl(var(--info)/0.18), hsl(var(--primary)/0.18))',
                        boxShadow: '0 8px 20px -6px hsl(var(--primary)/0.40)',
                    }}
                >
                    <Link className="w-5 h-5" />
                </div>

                {/* Body */}
                <div className="min-w-0">
                    <h4 className="text-[17px] font-bold text-slate-50 tracking-tight mt-[2px] mb-[6px]">
                        {pt.xenditConnectTitle}
                    </h4>
                    <p className="text-[13.5px] text-slate-400 leading-[1.55] mb-[16px] max-w-[540px]">
                        {pt.xenditConnectDesc}
                    </p>

                    {/* ── Model C inputs ── */}
                    <div className="space-y-[12px] max-w-[480px]">
                        {/* Secret Key */}
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-300 mb-[6px]">
                                {pt.xenditSecretKeyLabel} <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showSecret ? 'text' : 'password'}
                                    value={secretKey}
                                    onChange={e => setSecretKey(e.target.value)}
                                    placeholder={pt.xenditSecretKeyPlaceholder}
                                    className="w-full h-[38px] px-[12px] pr-[40px] rounded-[8px] text-[13px] text-slate-100 placeholder:text-slate-600 bg-white/[0.04] border border-white/[0.10] focus:outline-none focus:border-[hsl(var(--primary))] transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSecret(v => !v)}
                                    className="absolute right-[10px] top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <ol className="mt-[8px] space-y-[4px] list-none m-0 p-0 text-[11.5px] text-slate-500 leading-[1.6]">
                                {[pt.xenditSecretKeyStep1, pt.xenditSecretKeyStep2, pt.xenditSecretKeyStep3, pt.xenditSecretKeyStep4].map((step, i) => (
                                    <li key={i}><span className="text-slate-400 font-medium">{i + 1}.</span> {step}</li>
                                ))}
                            </ol>
                        </div>

                        {/* Callback Token */}
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-300 mb-[6px]">
                                {pt.xenditCallbackTokenLabel} <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showToken ? 'text' : 'password'}
                                    value={callbackToken}
                                    onChange={e => setCallbackToken(e.target.value)}
                                    placeholder={pt.xenditCallbackTokenPlaceholder}
                                    className="w-full h-[38px] px-[12px] pr-[40px] rounded-[8px] text-[13px] text-slate-100 placeholder:text-slate-600 bg-white/[0.04] border border-white/[0.10] focus:outline-none focus:border-[hsl(var(--primary))] transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowToken(v => !v)}
                                    className="absolute right-[10px] top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <ol className="mt-[8px] space-y-[4px] list-none m-0 p-0 text-[11.5px] text-slate-500 leading-[1.6]">
                                {[pt.xenditCallbackTokenStep1, pt.xenditCallbackTokenStep2, pt.xenditCallbackTokenStep3].map((step, i) => (
                                    <li key={i}><span className="text-slate-400 font-medium">{i + 1}.</span> {step}</li>
                                ))}
                            </ol>
                        </div>

                        {saveError && (
                            <p className="text-[12.5px] text-destructive flex items-center gap-[5px]">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {saveError}
                            </p>
                        )}

                        {/* Save button */}
                        <div className="flex items-center gap-[14px] pt-[4px]">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || !tenantId || !secretKey || !callbackToken}
                                className="inline-flex items-center gap-2 h-[40px] px-[18px] rounded-[10px] text-[13.5px] font-semibold !text-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                    background: 'linear-gradient(135deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)',
                                    boxShadow: '0 4px 14px hsl(var(--info)/0.30)',
                                }}
                            >
                                {isSaving
                                    ? <><Loader2 className="w-4 h-4 animate-spin" />{pt.xenditSaving}</>
                                    : pt.xenditSaveBtn
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
