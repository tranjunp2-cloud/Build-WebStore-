'use client';

import { useEffect, useState, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { useI18n } from '@/i18n';

const REFRESH_THRESHOLD = 15 * 60 * 1000; // 15 min before expiry

export function TenantAccessWatcher() {
    const [isEvicted, setIsEvicted] = useState(false);
    const [evictReason, setEvictReason] = useState<string>('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { t } = useI18n();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Grace-period and retry counters — useRef to avoid triggering useEffect re-runs
    const consecutiveFailRef = useRef(0);   // consecutive 'Removed from workspace' hits
    const lastFailTimestampRef = useRef(0); // timestamp of previous force_logout
    const retryCountRef = useRef(0);        // consecutive retry:true responses (cap: 3)
    const mountedRef = useRef(false);           // gate: prevents checks before startup delay
    const inGracePeriodRef = useRef(false);     // true during 12s grace period — blocks all checks
    const gracePeriodTimerRef = useRef<NodeJS.Timeout | null>(null); // tracked to clear on unmount
    const retryTimerRef = useRef<NodeJS.Timeout | null>(null);       // tracked to clear on unmount
    // Minimum interval between checks — prevents double-fire from simultaneous
    // focus + visibilitychange events burning the retry count within seconds.
    const lastCheckAtRef = useRef(0);
    // Tracks last proactive refresh — debounces to one refresh per REFRESH_THRESHOLD window.
    const lastRefreshAtRef = useRef(0);

    useEffect(() => {
        let debounceId: NodeJS.Timeout | null = null;

        const startPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(checkSession, 60_000);
        };

        const checkSession = async () => {
            if (isEvicted) return;
            // Guard: skip if a check ran within 5s — prevents focus+visibilitychange
            // double-fire from consuming 2 retries in rapid succession.
            const checkAt = Date.now();
            if (checkAt - lastCheckAtRef.current < 5_000) return;
            lastCheckAtRef.current = checkAt;
            try {
                const res = await fetch('/api/auth/session-check', { cache: 'no-store' });
                if (!res.ok) return; // non-2xx (5xx) — skip silently, keep polling

                const data = await res.json();

                if (data.ok === true) {
                    // Valid session — reset all failure counters including timestamp
                    consecutiveFailRef.current = 0;
                    lastFailTimestampRef.current = 0;
                    retryCountRef.current = 0;

                    // Proactive refresh: fire before the token expires to prevent session disruption.
                    // Fire-and-forget — failure only warns; the current token stays valid until expiresAt.
                    const expiresAt = data.expiresAt as number | undefined;
                    const now = Date.now();
                    if (
                        expiresAt &&
                        expiresAt - now < REFRESH_THRESHOLD &&
                        now - lastRefreshAtRef.current > REFRESH_THRESHOLD
                    ) {
                        lastRefreshAtRef.current = now;
                        fetch('/api/auth/refresh-token', { method: 'POST', cache: 'no-store' }).catch(
                            (err) => console.warn('[TenantAccessWatcher] token refresh failed', err),
                        );
                    }
                    return;
                }

                if (data.ok === false && data.retry === true) {
                    // Backend signals transient issue (HMR, token refresh, race condition)
                    retryCountRef.current += 1;
                    if (retryCountRef.current < 3) {
                        console.warn('[TenantAccessWatcher] session-check retry requested', { attempt: retryCountRef.current });
                        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                        retryTimerRef.current = setTimeout(checkSession, 8_000);
                        return;
                    }
                    // Cap reached (3 consecutive retries) — genuine auth failure
                    console.warn('[TenantAccessWatcher] retry cap reached, treating as auth failure');
                    setEvictReason('Unauthenticated');
                    setIsEvicted(true);
                    return;
                }

                if (data.action === 'force_logout') {
                    retryCountRef.current = 0; // clear retry streak on any confirmed force_logout
                    console.warn('[TenantAccessWatcher] force_logout received', { reason: data.reason });

                    // subscription_expired + Account suspended are DB-verified — show dialog immediately
                    if (data.reason === 'subscription_expired' || data.reason === 'Account suspended') {
                        setEvictReason(data.reason);
                        setIsEvicted(true);
                        return;
                    }

                    // 'Removed from workspace' requires 2 confirmed hits ≥10s apart (guards against
                    // stale tenant cache on the first check after login/SSO token refresh)
                    const now = Date.now();
                    const elapsed = now - lastFailTimestampRef.current;

                    if (consecutiveFailRef.current >= 1 && elapsed >= 10_000) {
                        // Second confirmed hit at least 10s after the first → genuine removal
                        setEvictReason(data.reason ?? '');
                        setIsEvicted(true);
                    } else {
                        // First hit or burst — enter 12s grace period
                        consecutiveFailRef.current += 1;
                        lastFailTimestampRef.current = now;
                        inGracePeriodRef.current = true;
                        if (intervalRef.current) clearInterval(intervalRef.current); // pause 60s poll
                        if (gracePeriodTimerRef.current) clearTimeout(gracePeriodTimerRef.current);
                        gracePeriodTimerRef.current = setTimeout(() => {
                            if (!mountedRef.current) return; // component unmounted during grace period
                            inGracePeriodRef.current = false;
                            startPolling(); // resume 60s poll
                            checkSession();
                        }, 12_000);
                    }
                }
            } catch (error) {
                console.error('[TenantAccessWatcher] Failed to check session', error);
            }
        };

        // Delay initial check 5s — avoids false-positive during HMR reload or React strict-mode
        // double-mount where getCurrentUser() can transiently return null
        const startupTimer = setTimeout(() => {
            mountedRef.current = true;
            checkSession();
        }, 5_000);
        startPolling();

        // Debounced focus handler — prevents burst requests on rapid tab switching
        const handleFocus = () => {
            if (!mountedRef.current) return;      // skip during startup delay
            if (inGracePeriodRef.current) return; // skip during grace period
            if (document.visibilityState !== 'visible') return;
            if (debounceId) clearTimeout(debounceId);
            debounceId = setTimeout(checkSession, 2_000);
        };

        // Pause polling when tab hidden, resume when visible
        const handleVisibility = () => {
            if (!mountedRef.current) return;      // skip during startup delay
            if (inGracePeriodRef.current) return; // skip during grace period — scheduled retry handles it
            if (document.visibilityState === 'hidden') {
                if (intervalRef.current) clearInterval(intervalRef.current);
            } else {
                checkSession();
                startPolling();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            mountedRef.current = false; // signal unmount to any in-flight async callbacks
            clearTimeout(startupTimer);
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (gracePeriodTimerRef.current) clearTimeout(gracePeriodTimerRef.current);
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            if (debounceId) clearTimeout(debounceId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [isEvicted]);

    const handleAcknowledge = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout request failed', error);
        } finally {
            // payload-token is httpOnly — cannot be cleared via JS; server clears it on logout.
            window.location.href = '/login';
        }
    };

    if (!isEvicted) return null;

    // A full-screen overlay that prevents any interaction with the underlying app
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-[90%] max-w-md rounded-[20px] bg-[#0B1120] border border-white/[0.08] p-6 shadow-2xl flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <LogOut className="h-6 w-6 text-red-500" />
                </div>

                <h2 className="text-xl font-bold text-white mb-2 font-['Inter']">
                    {evictReason === 'subscription_expired'
                        ? t.dashboard.tenantAccessWatcher.subscriptionExpiredTitle
                        : evictReason === 'Account suspended'
                            ? t.dashboard.tenantAccessWatcher.accountSuspendedTitle
                            : evictReason === 'Unauthenticated'
                                ? t.dashboard.tenantAccessWatcher.sessionExpiredTitle
                                : t.dashboard.tenantAccessWatcher.accessRevokedTitle}
                </h2>

                <p className="text-[14px] text-[rgba(248,250,252,0.7)] leading-[1.5] mb-6 font-['Inter']">
                    {evictReason === 'subscription_expired'
                        ? t.dashboard.tenantAccessWatcher.subscriptionExpiredBody
                        : evictReason === 'Account suspended'
                            ? t.dashboard.tenantAccessWatcher.accountSuspendedBody
                            : evictReason === 'Unauthenticated'
                                ? t.dashboard.tenantAccessWatcher.sessionExpiredBody
                                : t.dashboard.tenantAccessWatcher.accessRevokedBody}
                </p>

                <button
                    onClick={handleAcknowledge}
                    disabled={isLoggingOut}
                    className="w-full h-11 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-[12px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                    {isLoggingOut ? t.dashboard.tenantAccessWatcher.loggingOut : t.dashboard.tenantAccessWatcher.acknowledge}
                </button>
            </div>
        </div>
    );
}
