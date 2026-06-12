"use client";

import { useState, useEffect, useRef } from 'react';
import { Link, Clock, CheckCircle2, AlertTriangle, ArrowRight, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n';

export interface XenditConnectBlockProps {
    status: 'NOT_CONNECTED' | 'INVITED' | 'REGISTERED' | 'AWAITING_DOCS' | 'PENDING_VERIFICATION' | 'LIVE' | 'SUSPENDED';
    tenantId?: string;
    onConnected?: (accountId: string, status: string) => void;
    onStatusChange?: (status: string) => void;
}

const POLL_INTERVAL_MS = 10_000;

const PENDING_STATUSES = new Set(['INVITED', 'REGISTERED', 'AWAITING_DOCS', 'PENDING_VERIFICATION']);

export function XenditConnectBlock({
    status,
    tenantId,
    onConnected,
    onStatusChange,
}: XenditConnectBlockProps) {
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;
    const [isConnecting, setIsConnecting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);
    const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Poll status when in a pending state
    useEffect(() => {
        if (!PENDING_STATUSES.has(status) || !tenantId) {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }

        const poll = async () => {
            try {
                const res = await fetch(`/api/xendit/connect/status?tenantId=${tenantId}`);
                if (!res.ok) return;
                const data = await res.json();
                const newStatus: string = data?.status ?? data?.data?.status;
                if (newStatus && newStatus !== status) {
                    onStatusChange?.(newStatus);
                    if (newStatus === 'LIVE' || newStatus === 'SUSPENDED') {
                        if (pollRef.current) clearInterval(pollRef.current);
                    }
                }
            } catch {
                // silent — network blip should not surface to user during polling
            }
        };

        pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [status, tenantId, onStatusChange]);

    const handleConnect = async () => {
        if (!tenantId || isConnecting) return;
        setIsConnecting(true);
        setConnectError(null);
        try {
            const res = await fetch('/api/xendit/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId }),
            });
            const body = await res.json();
            if (!res.ok) {
                setConnectError(body?.error?.message ?? 'Không thể khởi tạo kết nối Xendit.');
                return;
            }
            const url: string | null = body.data?.onboardingUrl ?? null;
            if (url) {
                setOnboardingUrl(url);
                window.open(url, '_blank');
            }
            onConnected?.(body.data?.xenditAccountId ?? '', body.data?.status ?? 'INVITED');
        } catch {
            setConnectError('Lỗi mạng. Vui lòng thử lại.');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleResend = async () => {
        if (!tenantId || isResending) return;
        setIsResending(true);
        try {
            const res = await fetch('/api/xendit/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, resend: true }),
            });
            const body = await res.json();
            if (res.ok && body?.data?.onboardingUrl) {
                setOnboardingUrl(body.data.onboardingUrl);
                window.open(body.data.onboardingUrl, '_blank');
            }
        } catch {
            // silent
        } finally {
            setIsResending(false);
        }
    };

    const handleReopenLink = () => {
        if (onboardingUrl) window.open(onboardingUrl, '_blank');
    };

    // ─── LIVE ───────────────────────────────────────────────────────────────
    if (status === 'LIVE') {
        return (
            <div
                className="flex items-center gap-[16px] p-[16px_20px] rounded-[14px] border mb-[18px]"
                style={{
                    borderColor: 'rgba(34,197,94,0.35)',
                    background: 'radial-gradient(circle at 0% 0%, rgba(34,197,94,0.12) 0%, transparent 55%), var(--dash-surface)',
                    boxShadow: '0 0 0 1px rgba(34,197,94,0.06), 0 12px 30px -12px rgba(34,197,94,0.30)',
                }}
            >
                <div
                    className="w-[44px] h-[44px] rounded-[12px] grid place-items-center shrink-0"
                    style={{
                        border: '1px solid rgba(34,197,94,0.40)',
                        color: '#4ade80',
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.20), rgba(16,185,129,0.14))',
                        boxShadow: '0 6px 16px -6px rgba(34,197,94,0.35)',
                    }}
                >
                    <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-[15px] font-bold text-slate-50 m-0 mb-[2px]">{pt.xenditConnectedBar}</p>
                    <p className="text-[13px] text-slate-400 m-0">{pt.xenditKybVerified}</p>
                </div>
                <span
                    className="ml-auto inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-full text-[12px] font-semibold text-emerald-300 shrink-0"
                    style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.30)' }}
                >
                    <span className="w-[6px] h-[6px] rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #4ade80' }} />
                    LIVE
                </span>
            </div>
        );
    }

    // ─── SUSPENDED ──────────────────────────────────────────────────────────
    if (status === 'SUSPENDED') {
        return (
            <div
                className="flex items-center gap-[16px] p-[16px_20px] rounded-[14px] border mb-[18px]"
                style={{
                    borderColor: 'rgba(239,68,68,0.35)',
                    background: 'radial-gradient(circle at 0% 0%, rgba(239,68,68,0.10) 0%, transparent 55%), var(--dash-surface)',
                    boxShadow: '0 0 0 1px rgba(239,68,68,0.06), 0 12px 30px -12px rgba(239,68,68,0.25)',
                }}
            >
                <div
                    className="w-[44px] h-[44px] rounded-[12px] grid place-items-center shrink-0"
                    style={{
                        border: '1px solid rgba(239,68,68,0.40)',
                        color: '#f87171',
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(220,38,38,0.12))',
                        boxShadow: '0 6px 16px -6px rgba(239,68,68,0.30)',
                    }}
                >
                    <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-[15px] font-bold text-slate-50 m-0 mb-[2px]">Xendit account suspended</p>
                    <p className="text-[13px] text-slate-400 m-0">Contact <a href="mailto:support@xendit.co" className="text-red-400 underline">support@xendit.co</a> for assistance.</p>
                </div>
                <span
                    className="ml-auto inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-full text-[12px] font-semibold text-red-300 shrink-0"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)' }}
                >
                    SUSPENDED
                </span>
            </div>
        );
    }

    // ─── INVITED / REGISTERED / AWAITING_DOCS / PENDING_VERIFICATION ────────
    if (PENDING_STATUSES.has(status) && status !== 'NOT_CONNECTED') {
        return (
            <div
                className="relative grid items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] border overflow-hidden"
                style={{
                    gridTemplateColumns: '56px 1fr auto',
                    borderColor: 'rgba(251,191,36,0.35)',
                    background: 'radial-gradient(circle at 0% 0%, rgba(251,191,36,0.12) 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(245,158,11,0.08) 0%, transparent 55%), var(--dash-surface)',
                    boxShadow: '0 0 0 1px rgba(251,191,36,0.06), 0 16px 40px -16px rgba(251,191,36,0.25)',
                }}
            >
                {/* Decorative glow */}
                <div
                    className="absolute pointer-events-none blur-[20px]"
                    aria-hidden="true"
                    style={{ inset: '-40% -10% auto auto', width: 380, height: 220, background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.12), transparent 60%)' }}
                />

                {/* Icon */}
                <div
                    className="w-[48px] h-[48px] rounded-[14px] grid place-items-center shrink-0"
                    style={{
                        border: '1px solid rgba(251,191,36,0.40)',
                        color: '#fbbf24',
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.12))',
                        boxShadow: '0 8px 20px -6px rgba(251,191,36,0.30)',
                    }}
                >
                    <Clock className="w-5 h-5" />
                </div>

                {/* Body */}
                <div className="min-w-0">
                    <div className="flex items-center gap-[10px] mb-[6px]">
                        <h4 className="text-[17px] font-bold text-slate-50 tracking-tight m-0">{pt.xenditPendingTitle}</h4>
                        <Loader2 className="w-[14px] h-[14px] text-amber-400 animate-spin shrink-0" />
                        <span
                            className="inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-bold text-amber-300"
                            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.28)' }}
                        >
                            {pt.xenditPendingVerify}
                        </span>
                    </div>
                    <p className="text-[13.5px] text-slate-400 leading-[1.55] m-0 max-w-[540px]">
                        {pt.xenditPendingDesc}
                    </p>
                </div>

                {/* CTA */}
                <div className="flex flex-col items-end gap-2 shrink-0 relative z-[1]">
                    {onboardingUrl && (
                        <button
                            type="button"
                            onClick={handleReopenLink}
                            className="inline-flex items-center gap-2 h-[44px] px-[18px] rounded-[10px] text-[14px] font-semibold text-[#1a0a00] transition-all hover:brightness-110 whitespace-nowrap"
                            style={{
                                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                boxShadow: '0 4px 14px rgba(251,191,36,0.30)',
                            }}
                        >
                            {pt.xenditReopenLink}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={isResending}
                        className="inline-flex items-center gap-[5px] text-[12px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-wait whitespace-nowrap underline underline-offset-2"
                    >
                        {isResending
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <RefreshCw className="w-3 h-3" />
                        }
                        {pt.xenditResendLink}
                    </button>
                </div>
            </div>
        );
    }

    // ─── NOT_CONNECTED (default) ─────────────────────────────────────────────
    return (
        <div
            className="relative grid items-center gap-[22px] p-[22px_26px] mb-[18px] rounded-[18px] border overflow-hidden"
            style={{
                gridTemplateColumns: '56px 1fr auto',
                borderColor: 'rgba(6,182,212,0.32)',
                background: 'radial-gradient(circle at 0% 0%, rgba(14,165,233,0.18) 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(6,182,212,0.14) 0%, transparent 55%), var(--dash-surface)',
                boxShadow: '0 0 0 1px rgba(6,182,212,0.06), 0 16px 40px -16px rgba(6,182,212,0.35)',
            }}
        >
            {/* Decorative glow */}
            <div
                className="absolute pointer-events-none blur-[20px]"
                aria-hidden="true"
                style={{ inset: '-40% -10% auto auto', width: 380, height: 220, background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.18), transparent 60%)' }}
            />

            {/* Icon */}
            <div
                className="w-[48px] h-[48px] rounded-[14px] grid place-items-center shrink-0"
                style={{
                    border: '1px solid rgba(6,182,212,0.35)',
                    color: '#67e8f9',
                    background: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(6,182,212,0.18))',
                    boxShadow: '0 8px 20px -6px rgba(6,182,212,0.40)',
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
                {connectError && (
                    <p className="mt-[10px] text-[12.5px] text-red-400 flex items-center gap-[5px]">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {connectError}
                    </p>
                )}
            </div>

            {/* CTA */}
            <div className="flex flex-col items-end gap-2 shrink-0 relative z-[1]">
                <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting || !tenantId}
                    className="inline-flex items-center gap-2 h-[44px] px-[18px] rounded-[10px] text-[14px] font-semibold text-[#042033] transition-all hover:brightness-110 whitespace-nowrap disabled:opacity-70 disabled:cursor-wait"
                    style={{
                        background: 'linear-gradient(135deg, #0ea5e9 0%, #2dd4bf 100%)',
                        boxShadow: '0 4px 14px rgba(14,165,233,0.30)',
                    }}
                >
                    {isConnecting
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{pt.xenditConnecting}</>
                        : <>{pt.xenditConnectCta}<ArrowRight className="w-4 h-4" /></>
                    }
                </button>
                <div className="inline-flex items-center gap-[6px] text-[11.5px] text-slate-500 whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    {pt.xenditTrust}
                </div>
            </div>
        </div>
    );
}
