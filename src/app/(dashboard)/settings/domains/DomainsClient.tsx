"use client";

import React, { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { Globe, Plus, AlertCircle, AlertTriangle, Copy, Check, ChevronRight, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { resolveApiError } from '@/lib/ui/resolve-api-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addCustomDomain, verifyCustomDomain, removeCustomDomain, setPrimaryDomain, clearPrimaryDomain } from './actions';
import type { VercelDomainVerification } from '@/lib/vercel/domains.types';

// Đọc từ env vars — deploy production chỉ cần set các biến này, không sửa code
const DNS_A_RECORD = process.env.NEXT_PUBLIC_VERCEL_APEX_IP ?? '76.76.21.21';
const DNS_CNAME = process.env.NEXT_PUBLIC_VERCEL_CNAME_TARGET ?? 'cname.vercel-dns.com';
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'primeweb.app';

type DomainEntry = { domain: string; status: string; isPrimary?: boolean | null; vercelVerification?: VercelDomainVerification[] | null };

// ── Select Primary Domain — Right-Side Panel ────────────────────────────────
function SelectPrimaryPanel({
    tenantSlug,
    domains,
    currentPrimary,
    isPending,
    onClose,
    onSave,
    t,
}: {
    tenantSlug: string;
    domains: DomainEntry[];
    currentPrimary: string | null;   // null = platform subdomain is primary
    isPending: boolean;
    onClose: () => void;
    onSave: (selected: string | null) => void;
    t: ReturnType<typeof useI18n>['t'];
}) {
    const platformDomain = `${tenantSlug}.${PLATFORM_DOMAIN}`;
    const activeDomains = domains.filter(d => d.status === 'active');
    const [selected, setSelected] = useState<string | null>(currentPrimary);

    // All options: platform subdomain first, then verified custom domains
    const options: { label: string; value: string | null }[] = [
        { label: platformDomain, value: null },
        ...activeDomains.map(d => ({ label: d.domain, value: d.domain })),
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] animate-in fade-in duration-200"
                style={{ background: 'rgba(var(--dash-surface-rgb, 11,17,32), 0.6)' }}
                onClick={onClose}
            />
            {/* Slide-in panel from right — Figma: bg --dash-surface, w-592px on desktop */}
            <div
                className="fixed right-0 top-0 bottom-0 z-[101] flex flex-col w-full max-w-[448px] sm:max-w-[448px] animate-in slide-in-from-right duration-300 shadow-[−25px_0_50px_-12px_rgba(0,0,0,0.5)]"
                style={{ background: 'var(--dash-surface)' }}
            >

                {/* Close chevron button — Figma circular outlined accent */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-[20px] left-[-18px] flex h-[36px] w-[36px] items-center justify-center rounded-full transition-colors shrink-0 z-10"
                    style={{
                        background: 'var(--dash-surface)',
                        border: '1px solid var(--dash-border)',
                        color: 'var(--dash-text)',
                    }}
                >
                    <ChevronRight className="h-5 w-5" />
                </button>

                {/* Content */}
                <div className="flex flex-col flex-1 px-[32px] pt-[32px] pb-[24px] overflow-y-auto">
                    <h2
                        className="text-[20px] font-semibold leading-[1.4em] font-['Inter'] mb-[24px]"
                        style={{ color: 'var(--dash-text)' }}
                    >
                        {t?.Domains?.selectPrimary || 'Select primary domain'}
                    </h2>

                    {/* Radio list */}
                    <div className="flex flex-col gap-[12px]">
                        {options.map(opt => {
                            const isSelected = selected === opt.value;
                            return (
                                <button
                                    key={opt.value ?? '__platform__'}
                                    type="button"
                                    onClick={() => setSelected(opt.value)}
                                    className="flex items-center gap-[12px] w-full p-[16px] rounded-[8px] transition-all text-left font-['Inter']"
                                    style={isSelected
                                        ? { border: '1px solid hsl(var(--primary))', background: 'hsl(var(--primary)/0.06)' }
                                        : { border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }
                                    }
                                    onMouseEnter={e => {
                                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--dash-surface-hover)';
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--dash-surface)';
                                    }}
                                >
                                    {/* Custom radio */}
                                    <div
                                        className="flex shrink-0 items-center justify-center h-[20px] w-[20px] rounded-full border-2 transition-all"
                                        style={isSelected
                                            ? { borderColor: 'hsl(var(--primary))' }
                                            : { borderColor: 'var(--dash-border)', background: 'transparent' }
                                        }
                                    >
                                        {isSelected && (
                                            <div className="h-[10px] w-[10px] rounded-full" style={{ background: 'hsl(var(--primary))' }} />
                                        )}
                                    </div>
                                    <span
                                        className="text-[16px] font-normal leading-normal truncate"
                                        style={{ color: isSelected ? 'var(--dash-text)' : 'var(--dash-text-muted)' }}
                                    >
                                        {opt.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {activeDomains.length === 0 && (
                        <p className="mt-[16px] text-[13px] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>
                            {t?.Domains?.noVerifiedDomains || 'No verified custom domains yet. Add and verify a custom domain first.'}
                        </p>
                    )}
                </div>

                {/* Footer buttons — Figma: Cancel ghost + Save gradient, mt-auto */}
                <div
                    className="flex items-center gap-[12px] px-[32px] pb-[32px] pt-[16px]"
                    style={{ borderTop: '1px solid var(--dash-border)' }}
                >
                    <Button
                        type="button"
                        onClick={onClose}
                        variant="dashSecondary"
                        className="flex-1 h-[50px] rounded-[16px] text-[16px] font-medium font-['Inter']"
                    >
                        {t?.Domains?.cancel || 'Cancel'}
                    </Button>
                    <Button
                        type="button"
                        disabled={isPending}
                        onClick={() => onSave(selected)}
                        variant="dashPrimary"
                        className="flex-1 h-[50px] rounded-[16px] text-[16px] font-['Inter']"
                    >
                        {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                        {t?.Domains?.save || 'Save'}
                    </Button>
                </div>
            </div>
        </>
    );
}

// ── TXT Challenge Card ──────────────────────────────────────────────────────
function formatTimeAgo(epochMs: number): string {
    const diff = Date.now() - epochMs;
    if (diff < 5000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

function TxtChallengeCard({
    domain,
    verification,
    onVerifyClick,
    isVerifying,
    lastCheckedAt,
}: {
    domain: string;
    verification: VercelDomainVerification[];
    onVerifyClick: () => void;
    isVerifying: boolean;
    lastCheckedAt: number | null;
}) {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copy = async (key: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        } catch {
            toast.error('Failed to copy to clipboard');
        }
    };

    const timeAgo = lastCheckedAt ? formatTimeAgo(lastCheckedAt) : null;

    return (
        <div
            className="mt-4 p-4 sm:p-6 rounded-[16px]"
            style={{ border: '1px solid hsl(var(--warning)/0.3)', background: 'hsl(var(--warning)/0.04)' }}
            role="region"
            aria-labelledby={`txt-challenge-${domain}`}
        >
            <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'hsl(var(--warning))' }} aria-hidden="true" />
                <div>
                    <h4 id={`txt-challenge-${domain}`} className="text-[15px] font-semibold font-['Inter']" style={{ color: 'var(--dash-text)' }}>
                        Verify domain ownership
                    </h4>
                    <p className="mt-1 text-[13px] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>
                        Add this TXT record to your DNS, then click Verify.
                    </p>
                </div>
            </div>

            {verification.map((v, i) => (
                <div
                    key={`${v.domain}-${i}`}
                    className="mb-4 p-4 rounded-[12px]"
                    style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                >
                    <p className="text-[12px] font-medium uppercase tracking-wide font-['Inter'] mb-3" style={{ color: 'var(--dash-text-muted)' }}>
                        TXT Record #{i + 1}
                    </p>

                    <label className="text-[12px] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>Name</label>
                    <div className="flex items-center gap-2 mt-1 mb-3">
                        <code className="flex-1 p-2 rounded-[8px] bg-white/[0.03] text-[13px] font-mono break-all" style={{ color: 'var(--dash-text)' }}>
                            {v.domain}
                        </code>
                        <button
                            type="button"
                            onClick={() => copy(`name-${i}`, v.domain)}
                            aria-label={`Copy TXT record name ${v.domain}`}
                            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-[8px] hover:bg-white/5 transition-colors"
                            style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}
                        >
                            {copiedKey === `name-${i}` ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                        </button>
                    </div>

                    <label className="text-[12px] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>Value</label>
                    <div className="flex items-center gap-2 mt-1 mb-2">
                        <code className="flex-1 p-2 rounded-[8px] bg-white/[0.03] text-[13px] font-mono break-all" style={{ color: 'var(--dash-text)' }}>
                            {v.value}
                        </code>
                        <button
                            type="button"
                            onClick={() => copy(`value-${i}`, v.value)}
                            aria-label="Copy TXT record value"
                            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-[8px] hover:bg-white/5 transition-colors"
                            style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}
                        >
                            {copiedKey === `value-${i}` ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                        </button>
                    </div>

                    {v.reason && (
                        <p className="text-[12px] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>Reason: {v.reason}</p>
                    )}
                </div>
            ))}

            {timeAgo && (
                <p className="text-[12px] font-['Inter'] mb-3" style={{ color: 'var(--dash-text-muted)' }} aria-live="polite">
                    Last checked: {timeAgo}
                </p>
            )}

            <Button
                type="button"
                onClick={onVerifyClick}
                disabled={isVerifying}
                aria-busy={isVerifying}
                variant="dashPrimary"
                className="h-[44px] px-6 rounded-[12px] text-[14px] font-['Inter']"
            >
                {isVerifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isVerifying ? 'Verifying…' : 'Verify Now'}
            </Button>
        </div>
    );
}

// ── Main DomainsClient ───────────────────────────────────────────────────────
export function DomainsClient({
    tenantId,
    tenantSlug,
    customDomains,
}: {
    tenantId: string;
    tenantSlug: string;
    customDomains: DomainEntry[];
}) {
    const { t } = useI18n();
    const sub = t.common.subscriptionErrors;
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSelectPrimaryOpen, setIsSelectPrimaryOpen] = useState(false);
    const [newDomainInput, setNewDomainInput] = useState('');
    const [isPending, startTransition] = useTransition();
    const [domains, setDomains] = useState<DomainEntry[]>(customDomains);
    const [verifyErrors, setVerifyErrors] = useState<Record<string, string>>({});
    const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
    const [removingDomain, setRemovingDomain] = useState<string | null>(null);
    const [verifications, setVerifications] = useState<Record<string, VercelDomainVerification[]>>(() =>
        Object.fromEntries(
            customDomains
                .filter(d => d.vercelVerification?.length)
                .map(d => [d.domain, d.vercelVerification!])
        )
    );
    const [lastCheckedAt, setLastCheckedAt] = useState<Record<string, number>>({});
    const lastVerifyClickRef = useRef<Record<string, number>>({});
    const [domainError, setDomainError] = useState('');

    // F23: Slug editor state
    const [currentSlug, setCurrentSlug] = useState(tenantSlug);
    const [isEditingSlug, setIsEditingSlug] = useState(false);
    const [slugInput, setSlugInput] = useState(tenantSlug);
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'>('idle');
    const [slugMessage, setSlugMessage] = useState('');
    const [showSlugConfirm, setShowSlugConfirm] = useState(false);
    const [savingSlug, setSavingSlug] = useState(false);
    const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const checkSlugAvailability = useCallback(async (slug: string) => {
        if (slug === currentSlug) { setSlugStatus('idle'); return; }
        if (slug.length < 3) { setSlugStatus('invalid'); setSlugMessage(t?.Domains?.slugMinChars || 'At least 3 characters'); return; }
        setSlugStatus('checking');
        try {
            const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(slug)}`);
            const data = await res.json();
            if (res.ok && data.available) { setSlugStatus('available'); setSlugMessage(''); }
            else if (res.status === 422) { setSlugStatus('invalid'); setSlugMessage(data.message || 'Invalid format'); }
            else if (res.status === 409) { setSlugStatus('unavailable'); setSlugMessage(t?.Domains?.slugReserved || 'Reserved'); }
            else { setSlugStatus('unavailable'); setSlugMessage(t?.Domains?.slugTaken || 'Already taken'); }
        } catch { setSlugStatus('invalid'); setSlugMessage(t?.Domains?.slugCheckFailed || 'Check failed'); }
    }, [currentSlug]);

    useEffect(() => {
        if (!isEditingSlug || slugInput === currentSlug) return;
        if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
        slugDebounceRef.current = setTimeout(() => checkSlugAvailability(slugInput), 400);
        return () => { if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current); };
    }, [slugInput, isEditingSlug, checkSlugAvailability, currentSlug]);

    const handleSaveSlug = async () => {
        setSavingSlug(true);
        try {
            const res = await fetch('/api/tenant/slug', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ slug: slugInput }),
            });
            const data = await res.json();
            if (res.ok) {
                setCurrentSlug(data.slug);
                setIsEditingSlug(false);
                setShowSlugConfirm(false);
                toast.success(t?.Domains?.subdomainUpdated || 'Subdomain updated successfully!');
            } else {
                toast.error(data.message || t?.Domains?.subdomainUpdateFailed || 'Failed to update subdomain');
            }
        } catch {
            toast.error(t?.Domains?.subdomainUpdateError || 'Failed to update subdomain. Please try again.');
        } finally {
            setSavingSlug(false);
        }
    };

    const handleAddDomain = () => {
        const raw = newDomainInput.trim();

        // BUG-F19.01: Block http/https prefix with warning
        if (/^https?:\/\//i.test(raw)) {
            setDomainError(t?.Domains?.errorHttpPrefix || 'Do not include http/https, enter the domain name only');
            return;
        }

        const domainValue = raw.toLowerCase().replace(/\/$/, '');

        // BUG-F19.04: Specific validation messages
        if (!domainValue) {
            setDomainError(t?.Domains?.errorRequired || 'Please enter a domain name');
            return;
        }
        if (/\s/.test(domainValue)) {
            setDomainError(t?.Domains?.errorSpaces || 'Domain name cannot contain spaces');
            return;
        }
        if (domainValue.length > 253) {
            setDomainError(t?.Domains?.errorTooLong || 'Domain name must not exceed 253 characters');
            return;
        }
        if (!/\./.test(domainValue)) {
            setDomainError(t?.Domains?.errorNoTld || 'Domain must include an extension (e.g., .com, .my)');
            return;
        }
        if (/[^a-zA-Z0-9.-]/.test(domainValue)) {
            setDomainError(t?.Domains?.errorInvalidChars || 'Domain contains invalid characters');
            return;
        }

        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
        if (!domainRegex.test(domainValue)) {
            setDomainError(t?.Domains?.errorInvalidFormat || 'Invalid domain format');
            return;
        }
        startTransition(async () => {
            const res = await addCustomDomain(domainValue);
            if (res.success) {
                setIsAddModalOpen(false);
                setNewDomainInput('');
                // Always pending — Verify button must be clicked after pointing DNS.
                setDomains(prev => [...prev, { domain: domainValue, status: 'pending' }]);
                if (res.verification && res.verification.length > 0) {
                    setVerifications(prev => ({ ...prev, [domainValue]: res.verification! }));
                }
                toast.success('Domain added. Point your DNS records below, then click Verify.');
                if (res.warning) {
                    toast.warning(res.warning);
                }
            } else {
                toast.error(resolveApiError(res, t?.Domains?.domainAddFailed || 'Failed to add domain', sub));
            }
        });
    };

    const handleVerify = (domain: string) => {
        // Client-side debounce — block double-clicks within 1s
        const now = Date.now();
        if (now - (lastVerifyClickRef.current[domain] ?? 0) < 1000) return;
        lastVerifyClickRef.current[domain] = now;


        setVerifyErrors(prev => { const next = { ...prev }; delete next[domain]; return next; });
        setVerifyingDomain(domain);
        const clickedAt = Date.now();
        startTransition(async () => {
            const res = await verifyCustomDomain(domain);
            setVerifyingDomain(null);
            setLastCheckedAt(prev => ({ ...prev, [domain]: clickedAt }));
            if (res.success) {
                setDomains(prev => prev.map(d => d.domain === domain ? { ...d, status: 'active' } : d));
                setVerifications(prev => { const next = { ...prev }; delete next[domain]; return next; });
                toast.success(`Domain connected! https://${domain} is now live.`);
            } else {
                if (res.verification && res.verification.length > 0) {
                    // Vercel returned new TXT challenges — update card.
                    setVerifications(prev => ({ ...prev, [domain]: res.verification! }));
                } else if (res.ownershipConfirmed) {
                    // Ownership confirmed by Vercel — TXT no longer needed, clear the card.
                    setVerifications(prev => { const next = { ...prev }; delete next[domain]; return next; });
                }
                if (res.ownershipConfirmed) {
                    toast.warning('DNS records are still propagating. This usually takes 5–30 minutes after you save them. Try again shortly.');
                } else {
                    const friendly = res.error || 'Verification failed. Please check your DNS records.';
                    setVerifyErrors(prev => ({ ...prev, [domain]: friendly }));
                    toast.error(`Verification failed: ${friendly}`);
                }
            }
        });
    };

    const handleRemoveConfirm = () => {
        if (!removingDomain) return;
        const domain = removingDomain;
        startTransition(async () => {
            const res = await removeCustomDomain(domain);
            setRemovingDomain(null);
            if (res.success) {
                setDomains(prev => prev.filter(d => d.domain !== domain));
                setVerifications(prev => { const next = { ...prev }; delete next[domain]; return next; });
                setLastCheckedAt(prev => { const next = { ...prev }; delete next[domain]; return next; });
                if (res.warning) {
                    toast.warning(res.warning);
                } else {
                    toast.success(t?.Domains?.domainRemoved || 'Custom domain removed.');
                }
            } else {
                toast.error(res.error || t?.Domains?.domainRemoveFailed || 'Failed to remove domain');
            }
        });
    };

    // Save primary domain from the panel
    const handleSavePrimary = (selected: string | null) => {
        startTransition(async () => {
            let res: { success: boolean; error?: string };
            if (selected === null) {
                // Reset to platform subdomain as primary
                res = await clearPrimaryDomain();
                if (res.success) {
                    setDomains(prev => prev.map(d => ({ ...d, isPrimary: false })));
                    toast.success(t?.Domains?.platformPrimary || 'Platform subdomain is now your primary domain.');
                }
            } else {
                res = await setPrimaryDomain(selected);
                if (res.success) {
                    setDomains(prev => prev.map(d => ({ ...d, isPrimary: d.domain === selected })));
                    toast.success((t?.Domains?.customPrimary || '"{domain}" is now your Primary Domain.').replace('{domain}', selected));
                }
            }
            if (!res.success) {
                toast.error(res.error || t?.Domains?.primaryUpdateFailed || 'Failed to update primary domain.');
            } else {
                setIsSelectPrimaryOpen(false);
            }
        });
    };

    // Derive current primary: find active domain with isPrimary, else null = platform subdomain
    const hasCustomPrimary = domains.some(d => d.status === 'active' && d.isPrimary);
    const currentPrimaryDomain = domains.find(d => d.status === 'active' && d.isPrimary)?.domain ?? null;

    return (
        <div className="w-full space-y-[28px]">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <div className="hidden sm:flex h-[50px] w-[50px] items-center justify-center rounded-[16px] bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] shrink-0">
                    <Globe className="h-6 w-6 text-[hsl(var(--primary))]" />
                </div>
                <div>
                    <h1 className="text-[24px] font-bold text-[var(--dash-text)]">{t?.Domains?.title || 'Domain Management'}</h1>
                    <p className="mt-1 text-[14px] text-[var(--dash-text-muted)] font-normal">{t?.Domains?.subtitle || 'Manage custom domains for your webstore'}</p>
                </div>
            </div>

            <div className="space-y-[16px]">
                {/* Banner — Figma 30872:1455, height: 102px, padding: 25px 25px 1px */}
                <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px] py-[25px] px-[25px] rounded-[16px]"
                    style={{ minHeight: '102px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                >
                    {/* Text — Figma layout_T77324: column, gap 4px — self-center to prevent stretch */}
                    <div className="self-center">
                        <h2 className="text-[18px] font-semibold leading-[1.556em] font-['Inter']" style={{ color: 'var(--dash-text)' }}>{t?.Domains?.addDomainHeading || 'Add a Domain to your store'}</h2>
                        <p className="mt-[4px] text-[14px] font-normal leading-[1.429em] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>{t?.Domains?.addDomainDesc || 'Connect your custom domain to make your store accessible'}</p>
                    </div>
                    {/* Buttons — stack on mobile, row on desktop */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[12px] sm:gap-[24px] shrink-0">
                        <Button
                            type="button"
                            onClick={() => setIsSelectPrimaryOpen(true)}
                            variant="dashSecondary"
                            size="dash"
                            className="whitespace-nowrap font-['Inter']"
                        >
                            {t?.Domains?.selectPrimary || 'Select primary domain'}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => { setIsAddModalOpen(true); setDomainError(''); setNewDomainInput(''); }}
                            variant="dashPrimary"
                            size="dash"
                            className="whitespace-nowrap font-['Inter']"
                        >
                            <Plus className="h-4 w-4" />
                            <span>{t?.Domains?.addCustomDomain || 'Add Custom Domain'}</span>
                        </Button>
                    </div>
                </div>

                {/* Platform subdomain card — F23: with slug editor */}
                <div
                    className="flex flex-col pt-[25px] px-[25px] pb-[25px] rounded-[16px] gap-[16px]"
                    style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px]">
                        <div className="flex flex-col gap-2">
                            {!isEditingSlug ? (
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-[18px] font-semibold" style={{ color: 'var(--dash-text)' }}>{currentSlug}.{PLATFORM_DOMAIN}</h3>
                                    {!hasCustomPrimary && (
                                        <div className="flex items-center justify-center h-[26px] px-3 rounded-full border border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.2)]">
                                            <span className="text-[12px] font-semibold text-[hsl(var(--info))]">{t?.Domains?.currentPrimary || 'Current Primary Domain'}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-0">
                                    <input
                                        type="text"
                                        value={slugInput}
                                        onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63))}
                                        className="h-[44px] w-full max-w-[240px] px-4 rounded-l-[12px] text-[14px] font-mono focus:outline-none transition-colors"
                                        style={{
                                            border: '1px solid var(--dash-border)',
                                            borderRight: 'none',
                                            background: 'var(--dash-surface)',
                                            color: 'var(--dash-text)',
                                        }}
                                        autoFocus
                                    />
                                    <div
                                        className="h-[44px] flex items-center px-3 rounded-r-[12px] text-[13px] text-slate-500 whitespace-nowrap"
                                        style={{ border: '1px solid var(--dash-border)', borderLeft: 'none', background: 'var(--dash-surface)' }}
                                    >
                                        .{PLATFORM_DOMAIN}
                                    </div>
                                    <div className="ml-2">
                                        {slugStatus === 'checking' && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
                                        {slugStatus === 'available' && <Check className="h-4 w-4 text-[hsl(var(--success))]" />}
                                        {(slugStatus === 'unavailable' || slugStatus === 'invalid') && (
                                            <span className="text-[12px] text-[hsl(var(--destructive))]">{slugMessage}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* "Connected" status badge — theme-aware via Badge success variant */}
                            <Badge variant="success" dot className="h-[34px] px-3 rounded-[12px] text-[14px] font-medium w-fit">
                                {t?.Domains?.connected || 'Connected'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {!isEditingSlug ? (
                                <Button
                                    type="button"
                                    onClick={() => { setIsEditingSlug(true); setSlugInput(currentSlug); setSlugStatus('idle'); }}
                                    variant="dashSecondary"
                                    className="py-[10px] px-[16px] h-auto rounded-[12px] text-[13px] font-medium"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    {t?.Domains?.changeSubdomain || 'Change subdomain'}
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        onClick={() => { setIsEditingSlug(false); setSlugInput(currentSlug); setSlugStatus('idle'); }}
                                        variant="dashSecondary"
                                        className="py-[10px] px-[16px] h-auto rounded-[12px] text-[13px] font-medium"
                                    >
                                        {t?.Domains?.cancel || 'Cancel'}
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={slugStatus !== 'available' || slugInput === currentSlug}
                                        onClick={() => setShowSlugConfirm(true)}
                                        variant="dashPrimary"
                                        className="py-[10px] px-[16px] h-auto rounded-[12px] text-[13px]"
                                    >
                                        {t?.Domains?.save || 'Save'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* F23: Slug change confirmation dialog */}
                {showSlugConfirm && (
                    <>
                        <div
                            className="fixed inset-0 z-[100] animate-in fade-in duration-200"
                            style={{ background: 'rgba(var(--dash-surface-rgb, 11,17,32), 0.6)' }}
                            onClick={() => setShowSlugConfirm(false)}
                        />
                        <div
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-[420px] rounded-[16px] p-6 shadow-xl animate-in zoom-in-95 duration-200"
                            style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                        >
                            <h3 className="text-[18px] font-semibold" style={{ color: 'var(--dash-text)' }}>{t?.Domains?.changeSubdomainTitle || 'Change subdomain?'}</h3>
                            <div className="mt-3 space-y-2">
                                <p className="text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>
                                    {(t?.Domains?.subdomainRedirectMsg || 'Your current subdomain {old} will redirect to {new} for 30 days.').replace('{old}', currentSlug).replace('{new}', slugInput)}
                                </p>
                                <p className="text-[14px] text-warning">
                                    {t?.Domains?.subdomainWarning || 'After 30 days, the old link will stop working. Update your marketing materials.'}
                                </p>
                            </div>
                            <div className="mt-5 flex justify-end gap-3">
                                <Button
                                    type="button"
                                    onClick={() => setShowSlugConfirm(false)}
                                    variant="dashSecondary"
                                    className="py-[10px] px-[20px] h-auto rounded-[12px] text-[14px] font-medium"
                                >
                                    {t?.Domains?.cancel || 'Cancel'}
                                </Button>
                                <Button
                                    type="button"
                                    disabled={savingSlug}
                                    onClick={handleSaveSlug}
                                    variant="dashPrimary"
                                    className="py-[10px] px-[20px] h-auto rounded-[12px] text-[14px]"
                                >
                                    {savingSlug && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {t?.Domains?.confirmChange || 'Confirm change'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {/* Custom Domain Cards */}
                {domains.map((domainObj) => {
                    const { domain, status } = domainObj;

                    if (status === 'pending') {
                        return (
                            <div
                                key={domain}
                                className="flex flex-col p-[25px] rounded-[16px] gap-[16px] animate-in slide-in-from-bottom-4 fade-in duration-300"
                                style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                            >
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-[18px] font-semibold" style={{ color: 'var(--dash-text)' }}>{domain}</h3>
                                    {/* Pending status — theme-aware warning badge */}
                                    <Badge variant="warning" dot className="h-[34px] px-3 rounded-[12px] text-[14px] font-medium w-fit">
                                        {t?.Domains?.pendingVerification || 'Pending Verification'}
                                    </Badge>
                                </div>

                                <div
                                    className="flex flex-col p-[16px] rounded-[16px] gap-4"
                                    style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }}
                                >
                                    <p className="text-[14px]" style={{ color: 'var(--dash-text)' }}>{t?.Domains?.configureDns || 'Configure these DNS records at your domain registrar:'}</p>
                                    <div className="flex flex-col gap-4">
                                        {/* A Record */}
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[12px] font-medium uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>{t?.Domains?.aRecord || 'A Record (Static IPs)'}</span>
                                            <div className="flex flex-col gap-2">
                                                {DNS_A_RECORD.split(',').map((ip, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <div
                                                            className="flex-1 h-[44px] flex items-center px-4 rounded-[12px]"
                                                            style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                                                        >
                                                            <span className="text-[14px] font-mono" style={{ color: 'var(--dash-text)' }}>{ip.trim()}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => { navigator.clipboard.writeText(ip.trim()); toast.success((t?.Domains?.copiedIp || 'Copied IP {n}!').replace('{n}', String(idx + 1))); }}
                                                            className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] transition-colors shrink-0"
                                                        >
                                                            <Copy className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <p className="text-[12px] text-slate-400">{t?.Domains?.pointToIps || 'Point your domain to any of these IPs.'}</p>
                                            </div>
                                        </div>
                                        {/* CNAME Record */}
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[12px] font-medium uppercase tracking-wider" style={{ color: 'var(--dash-text-muted)' }}>{t?.Domains?.cnameRecord || 'CNAME Record'}</span>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="flex-1 h-[44px] flex items-center px-4 rounded-[12px]"
                                                    style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                                                >
                                                    <span className="text-[14px] font-mono" style={{ color: 'var(--dash-text)' }}>{DNS_CNAME}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { navigator.clipboard.writeText(DNS_CNAME); toast.success(t?.Domains?.copied || 'Copied!'); }}
                                                    className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] transition-colors shrink-0"
                                                >
                                                    <Copy className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[12px]" style={{ color: 'var(--dash-text-muted)' }}>
                                        {t?.Domains?.cloudflareTip || 'Using Cloudflare? Disable the proxy (orange cloud → grey cloud) before verifying.'}
                                    </p>
                                </div>

                                {/* Error banner */}
                                {verifyErrors[domain] && (
                                    <div className="flex items-start gap-[12px] w-full p-[16px] rounded-[16px] border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] animate-in fade-in duration-200">
                                        <AlertCircle className="h-5 w-5 text-[hsl(var(--destructive))] shrink-0 mt-[1px]" strokeWidth={1.67} />
                                        <span className="text-[14px] font-normal leading-[1.43em] text-[hsl(var(--destructive))] font-['Inter']">
                                            {verifyErrors[domain]}
                                        </span>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-col sm:flex-row w-full gap-[12px]">
                                    <Button
                                        type="button"
                                        onClick={() => handleVerify(domain)}
                                        disabled={isPending || !!verifyingDomain}
                                        variant="dashPrimary"
                                        className="w-full sm:flex-1 h-[50px] rounded-[16px] text-[16px] font-['Inter'] gap-[8px]"
                                    >
                                        {verifyingDomain === domain ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={2.5} />}
                                        {verifyingDomain === domain ? (t?.Domains?.verifying || 'Verifying...') : (t?.Domains?.verifyConnection || 'Verify Connection')}
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => setRemovingDomain(domain)}
                                        disabled={isPending}
                                        className="w-full sm:w-[112px] flex items-center justify-center h-[50px] rounded-[16px] bg-transparent text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)] text-[16px] font-semibold font-['Inter'] transition-colors disabled:opacity-50"
                                        style={{ border: '1px solid hsl(var(--destructive)/0.3)' }}
                                    >
                                        {t?.Domains?.remove || 'Remove'}
                                    </button>
                                </div>

                                {/* TXT Challenge card — render only when verification present */}
                                {verifications[domain] && verifications[domain].length > 0 && (
                                    <TxtChallengeCard
                                        domain={domain}
                                        verification={verifications[domain]}
                                        onVerifyClick={() => handleVerify(domain)}
                                        isVerifying={verifyingDomain === domain}
                                        lastCheckedAt={lastCheckedAt[domain] ?? null}
                                    />
                                )}
                            </div>
                        );
                    }

                    if (status === 'active') {
                        const isPrimary = domainObj.isPrimary;
                        return (
                            <div key={domain} className="flex flex-col gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-[25px] px-[25px] pb-[1px] rounded-[16px] gap-[16px]"
                                    style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                                >
                                <div className="flex flex-col gap-2 pb-[25px]">
                                    <h3 className="text-[18px] font-semibold" style={{ color: 'var(--dash-text)' }}>{domain}</h3>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {/* Active status — theme-aware success badge */}
                                        <Badge variant="success" dot className="h-[34px] px-3 rounded-[12px] text-[14px] font-medium">
                                            {t?.Domains?.connectedSecured || 'Connected & Secured'}
                                        </Badge>
                                        {isPrimary && (
                                            <div className="flex items-center justify-center h-[26px] px-3 rounded-full border border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.2)]">
                                                <span className="text-[12px] font-semibold text-[hsl(var(--info))]">{t?.Domains?.currentPrimary || 'Current Primary Domain'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Remove button — visible on all screen sizes */}
                                <div className="flex items-center gap-3 pb-[25px]">
                                    <button
                                        type="button"
                                        onClick={() => setRemovingDomain(domain)}
                                        disabled={isPending || isPrimary === true}
                                        className="flex items-center justify-center h-[44px] px-[16px] rounded-[12px] bg-transparent text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] text-[14px] font-semibold transition-colors font-['Inter'] disabled:opacity-50"
                                        style={{ border: '1px solid hsl(var(--destructive)/0.3)' }}
                                        title={isPrimary ? 'Cannot remove the primary domain' : 'Remove domain'}
                                    >
                                        {t?.Domains?.removeDomain || 'Remove Domain'}
                                    </button>
                                </div>
                                </div>
                            </div>
                        );
                    }

                    return null;
                })}
            </div>

            {/* ── Add Domain Modal ──────────────────────────────────────────── */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    style={{ background: 'rgba(var(--dash-surface-rgb, 11,17,32), 0.8)' }}
                >
                    <div
                        className="flex flex-col w-[448px] max-w-full p-[25px] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-200"
                        style={{ background: 'var(--dash-surface-hover)', border: '1px solid var(--dash-border)' }}
                    >
                        {/* Heading + Note — Figma: heading y=25 h=28, note y=61 h=20 → gap=8px */}
                        <div className="flex flex-col">
                            {/* Dùng div + m-0 để triệt tiêu mọi margin mặc định từ global CSS (h3 thường tự có margin-bottom) */}
                            <div className="m-0 p-0 text-[20px] font-semibold leading-[1.4em] font-['Inter']" style={{ color: 'var(--dash-text)' }}>
                                {t?.Domains?.enterDomainTitle || 'Enter the domain name you own'}
                            </div>
                            {/* Dùng div + mt-[2px] m-0 để triệt tiêu mọi margin từ thẻ p (p thường có margin-top) */}
                            <div className="m-0 p-0 mt-[2px] text-[14px] font-bold leading-[1.428em] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>
                                {t?.Domains?.enterDomainNote || 'Note: Make sure you have access to your registrar'}
                            </div>
                        </div>
                        {/* Input — Figma: y=105, note bottom=81 → gap=24px */}
                        <Input
                            type="text"
                            value={newDomainInput}
                            onChange={(e) => { setNewDomainInput(e.target.value); setDomainError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && !isPending && handleAddDomain()}
                            placeholder="example.com"
                            autoFocus
                            className={cn("mt-[24px] h-[50px] py-[12px] px-[16px] rounded-[16px] text-[16px] font-normal font-['Inter']", domainError && "border-[hsl(var(--destructive))]")}
                        />
                        {domainError && (
                            <p className="text-destructive text-[13px] mt-[8px]">{domainError}</p>
                        )}
                        {/* Buttons — Figma: y=179, input bottom=155 → gap=24px */}
                        <div className="mt-[24px] flex items-center gap-[12px]">
                            <Button
                                type="button"
                                onClick={() => { setIsAddModalOpen(false); setNewDomainInput(''); }}
                                variant="dashSecondary"
                                className="flex-1 h-[50px] rounded-[16px] text-[16px] font-medium font-['Inter']"
                            >
                                {t?.Domains?.cancel || 'Cancel'}
                            </Button>
                            {/* Figma: dim gradient when empty, full gradient when input has value */}
                            <Button
                                type="button"
                                onClick={handleAddDomain}
                                disabled={isPending}
                                variant="dashPrimary"
                                className={cn("flex-1 h-[50px] rounded-[16px] text-[16px] font-['Inter']", !newDomainInput.trim() && 'opacity-50')}
                            >
                                {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                                {t?.Domains?.addDomain || 'Add Domain'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Select Primary Domain Panel ───────────────────────────────── */}
            {isSelectPrimaryOpen && (
                <SelectPrimaryPanel
                    tenantSlug={tenantSlug}
                    domains={domains}
                    currentPrimary={currentPrimaryDomain}
                    isPending={isPending}
                    onClose={() => setIsSelectPrimaryOpen(false)}
                    onSave={handleSavePrimary}
                    t={t}
                />
            )}

            {/* ── Remove Domain Confirmation Modal (TC-F19.14 QA) ─────────── */}
            {removingDomain && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    style={{ background: 'rgba(var(--dash-surface-rgb, 11,17,32), 0.8)' }}
                >
                    <div
                        className="flex flex-col w-[448px] max-w-full p-[25px] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-200"
                        style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                    >
                        <div className="flex flex-col">
                            <div className="m-0 p-0 text-[20px] font-semibold leading-[1.4em] font-['Inter']" style={{ color: 'var(--dash-text)' }}>
                                {t?.Domains?.removeDomainTitle || 'Remove domain'}
                            </div>
                            <div className="m-0 p-0 mt-[8px] text-[14px] font-normal leading-[1.428em] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>
                                {(t?.Domains?.removeDomainConfirm || 'Are you sure you want to remove {domain}? This will revoke the SSL certificate and the domain will no longer route to your store.').replace('{domain}', removingDomain)}
                            </div>
                        </div>
                        <div className="mt-[24px] flex items-center gap-[12px]">
                            <Button
                                type="button"
                                onClick={() => setRemovingDomain(null)}
                                variant="dashSecondary"
                                className="flex-1 h-[50px] rounded-[16px] text-[16px] font-medium font-['Inter']"
                            >
                                {t?.Domains?.cancel || 'Cancel'}
                            </Button>
                            <button
                                type="button"
                                onClick={handleRemoveConfirm}
                                disabled={isPending}
                                className="flex-1 flex items-center justify-center gap-2 h-[50px] rounded-[16px] border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] text-[16px] font-semibold leading-[1.5em] hover:bg-[hsl(var(--destructive)/0.2)] transition-colors font-['Inter'] disabled:opacity-50"
                            >
                                {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                                {t?.Domains?.removeDomain || 'Remove Domain'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
