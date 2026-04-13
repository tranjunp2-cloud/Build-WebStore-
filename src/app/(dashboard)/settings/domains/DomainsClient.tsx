"use client";

import React, { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { Globe, Plus, AlertCircle, AlertTriangle, Info, X, Copy, Check, ChevronRight, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { addCustomDomain, verifyCustomDomain, removeCustomDomain, setPrimaryDomain, clearPrimaryDomain } from './actions';
import type { VercelDomainVerification } from '@/lib/vercel/domains.types';

// Đọc từ env vars — deploy production chỉ cần set các biến này, không sửa code
const DNS_A_RECORD = process.env.NEXT_PUBLIC_VERCEL_APEX_IP ?? '76.76.21.21';
const DNS_CNAME = process.env.NEXT_PUBLIC_VERCEL_CNAME_TARGET ?? 'cname.vercel-dns.com';

type DomainEntry = { domain: string; status: string; isPrimary?: boolean | null };

// ── Select Primary Domain — Right-Side Panel ────────────────────────────────
function SelectPrimaryPanel({
    tenantSlug,
    domains,
    currentPrimary,
    isPending,
    onClose,
    onSave,
}: {
    tenantSlug: string;
    domains: DomainEntry[];
    currentPrimary: string | null;   // null = platform subdomain is primary
    isPending: boolean;
    onClose: () => void;
    onSave: (selected: string | null) => void;
}) {
    const platformDomain = `${tenantSlug}.${DNS_CNAME}`;
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
                className="fixed inset-0 z-[100] bg-[#0B1120]/60 animate-in fade-in duration-200"
                onClick={onClose}
            />
            {/* Slide-in panel from right — Figma: bg #0B1120, w-592px on desktop */}
            <div className="fixed right-0 top-0 bottom-0 z-[101] flex flex-col w-full max-w-[448px] sm:max-w-[448px] bg-[#0B1120] animate-in slide-in-from-right duration-300 shadow-[−25px_0_50px_-12px_rgba(0,0,0,0.5)]">

                {/* Close chevron button — Figma circular outlined accent */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-[20px] left-[-18px] flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#0B1120] border border-[#1F2937] text-white hover:bg-[#1E293B] transition-colors shrink-0 z-10"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>

                {/* Content */}
                <div className="flex flex-col flex-1 px-[32px] pt-[32px] pb-[24px] overflow-y-auto">
                    <h2 className="text-[20px] font-semibold text-[#F8FAFC] leading-[1.4em] font-['Inter'] mb-[24px]">
                        Select primary domain
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
                                    className={`flex items-center gap-[12px] w-full p-[16px] rounded-[8px] border transition-all text-left font-['Inter'] ${isSelected
                                        ? 'border-[#00D3D4] bg-[rgba(0,211,212,0.06)]'
                                        : 'border-[rgba(255,255,255,0.1)] bg-[#0B1120] hover:bg-white/[0.03]'
                                        }`}
                                >
                                    {/* Custom radio */}
                                    <div className={`flex shrink-0 items-center justify-center h-[20px] w-[20px] rounded-full border-2 transition-all ${isSelected
                                        ? 'border-[#00D3D4]'
                                        : 'border-white/30 bg-transparent'
                                        }`}>
                                        {isSelected && (
                                            <div className="h-[10px] w-[10px] rounded-full bg-[#00D3D4]" />
                                        )}
                                    </div>
                                    <span className={`text-[16px] font-normal leading-normal truncate ${isSelected ? 'text-white' : 'text-white/70'
                                        }`}>
                                        {opt.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {activeDomains.length === 0 && (
                        <p className="mt-[16px] text-[13px] text-[rgba(248,250,252,0.4)] font-['Inter']">
                            No verified custom domains yet. Add and verify a custom domain first.
                        </p>
                    )}
                </div>

                {/* Footer buttons — Figma: Cancel ghost + Save gradient, mt-auto */}
                <div className="flex items-center gap-[12px] px-[32px] pb-[32px] pt-[16px] border-t border-white/[0.06]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 flex items-center justify-center h-[50px] rounded-[16px] border border-white/[0.08] bg-transparent text-[#F8FAFC] text-[16px] font-medium hover:bg-white/5 transition-colors font-['Inter']"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onSave(selected)}
                        style={{ background: 'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(45,212,191,1) 100%)' }}
                        className="flex-1 flex items-center justify-center gap-2 h-[50px] rounded-[16px] text-white text-[16px] font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] font-['Inter'] disabled:opacity-50"
                    >
                        {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                        Save
                    </button>
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
            className="mt-4 p-4 sm:p-6 rounded-[16px] border border-[#FFB020]/30 bg-[rgba(255,176,32,0.04)]"
            role="region"
            aria-labelledby={`txt-challenge-${domain}`}
        >
            <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-5 w-5 text-[#FFB020] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                    <h4 id={`txt-challenge-${domain}`} className="text-[15px] font-semibold text-[#F8FAFC] font-['Inter']">
                        Verify domain ownership
                    </h4>
                    <p className="mt-1 text-[13px] text-[rgba(248,250,252,0.6)] font-['Inter']">
                        Add this TXT record to your DNS, then click Verify.
                    </p>
                </div>
            </div>

            {verification.map((v, i) => (
                <div key={`${v.domain}-${i}`} className="mb-4 p-4 rounded-[12px] bg-[#0B1120] border border-white/[0.06]">
                    <p className="text-[12px] font-medium text-[rgba(248,250,252,0.5)] uppercase tracking-wide font-['Inter'] mb-3">
                        TXT Record #{i + 1}
                    </p>

                    <label className="text-[12px] text-[rgba(248,250,252,0.6)] font-['Inter']">Name</label>
                    <div className="flex items-center gap-2 mt-1 mb-3">
                        <code className="flex-1 p-2 rounded-[8px] bg-white/[0.03] text-[13px] text-[#F8FAFC] font-mono break-all">
                            {v.domain}
                        </code>
                        <button
                            type="button"
                            onClick={() => copy(`name-${i}`, v.domain)}
                            aria-label={`Copy TXT record name ${v.domain}`}
                            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-[8px] border border-white/10 text-[rgba(248,250,252,0.6)] hover:bg-white/5 transition-colors"
                        >
                            {copiedKey === `name-${i}` ? <Check className="h-4 w-4 text-[#10B981]" /> : <Copy className="h-4 w-4" />}
                        </button>
                    </div>

                    <label className="text-[12px] text-[rgba(248,250,252,0.6)] font-['Inter']">Value</label>
                    <div className="flex items-center gap-2 mt-1 mb-2">
                        <code className="flex-1 p-2 rounded-[8px] bg-white/[0.03] text-[13px] text-[#F8FAFC] font-mono break-all">
                            {v.value}
                        </code>
                        <button
                            type="button"
                            onClick={() => copy(`value-${i}`, v.value)}
                            aria-label="Copy TXT record value"
                            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-[8px] border border-white/10 text-[rgba(248,250,252,0.6)] hover:bg-white/5 transition-colors"
                        >
                            {copiedKey === `value-${i}` ? <Check className="h-4 w-4 text-[#10B981]" /> : <Copy className="h-4 w-4" />}
                        </button>
                    </div>

                    {v.reason && (
                        <p className="text-[12px] text-[rgba(248,250,252,0.5)] font-['Inter']">Reason: {v.reason}</p>
                    )}
                </div>
            ))}

            {timeAgo && (
                <p className="text-[12px] text-[rgba(248,250,252,0.4)] font-['Inter'] mb-3" aria-live="polite">
                    Last checked: {timeAgo}
                </p>
            )}

            <button
                type="button"
                onClick={onVerifyClick}
                disabled={isVerifying}
                aria-busy={isVerifying}
                className="flex items-center justify-center gap-2 h-[44px] px-6 rounded-[12px] bg-[#00D3D4] text-[#0B1120] text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-['Inter']"
            >
                {isVerifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isVerifying ? 'Verifying…' : 'Verify Now'}
            </button>
        </div>
    );
}

// ── SSL Provisioning Banner ─────────────────────────────────────────────────
function SslProvisioningBanner({
    domain,
    shownAt,
    onDismiss,
}: {
    domain: string;
    shownAt: number;
    onDismiss: () => void;
}) {
    useEffect(() => {
        const timeout = setTimeout(onDismiss, 60000); // auto-dismiss after 60s
        return () => clearTimeout(timeout);
    }, [onDismiss, shownAt]);

    return (
        <div
            role="status"
            aria-live="polite"
            className="mt-3 flex items-start gap-3 p-3 rounded-[10px] bg-[rgba(0,211,212,0.06)] border border-[#00D3D4]/20"
        >
            <Info className="h-4 w-4 text-[#00D3D4] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="flex-1 text-[13px] text-[#F8FAFC] font-['Inter']">
                SSL certificate is being provisioned. May take 1-2 minutes.
                Try <code className="text-[#00D3D4]">https://{domain}</code> after a moment.
            </p>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss SSL provisioning notice"
                className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-[rgba(248,250,252,0.4)] hover:text-[#F8FAFC] transition-colors"
            >
                <X className="h-4 w-4" />
            </button>
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
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSelectPrimaryOpen, setIsSelectPrimaryOpen] = useState(false);
    const [newDomainInput, setNewDomainInput] = useState('');
    const [isPending, startTransition] = useTransition();
    const [domains, setDomains] = useState<DomainEntry[]>(customDomains);
    const [verifyErrors, setVerifyErrors] = useState<Record<string, string>>({});
    const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
    const [removingDomain, setRemovingDomain] = useState<string | null>(null);
    const [verifications, setVerifications] = useState<Record<string, VercelDomainVerification[]>>({});
    const [lastCheckedAt, setLastCheckedAt] = useState<Record<string, number>>({});
    const [sslProvisioningDomains, setSslProvisioningDomains] = useState<Record<string, number>>({});
    const lastVerifyClickRef = useRef<Record<string, number>>({});

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
        if (slug.length < 3) { setSlugStatus('invalid'); setSlugMessage('At least 3 characters'); return; }
        setSlugStatus('checking');
        try {
            const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(slug)}`);
            const data = await res.json();
            if (res.ok && data.available) { setSlugStatus('available'); setSlugMessage(''); }
            else if (res.status === 422) { setSlugStatus('invalid'); setSlugMessage(data.message || 'Invalid format'); }
            else if (res.status === 409) { setSlugStatus('unavailable'); setSlugMessage('Reserved'); }
            else { setSlugStatus('unavailable'); setSlugMessage('Already taken'); }
        } catch { setSlugStatus('invalid'); setSlugMessage('Check failed'); }
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
                toast.success('Subdomain updated successfully!');
            } else {
                toast.error(data.message || 'Failed to update subdomain');
            }
        } catch {
            toast.error('Failed to update subdomain. Please try again.');
        } finally {
            setSavingSlug(false);
        }
    };

    const handleAddDomain = () => {
        const domainValue = newDomainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

        if (!domainRegex.test(domainValue)) {
            toast.error('Invalid domain format. Please enter a valid domain (e.g., store.example.com)');
            return;
        }
        startTransition(async () => {
            const res = await addCustomDomain(domainValue);
            if (res.success) {
                setIsAddModalOpen(false);
                setNewDomainInput('');
                const hasVerification = !!(res.verification && res.verification.length > 0);
                setDomains(prev => [
                    ...prev,
                    { domain: domainValue, status: hasVerification ? 'pending' : 'active' },
                ]);
                if (hasVerification) {
                    setVerifications(prev => ({ ...prev, [domainValue]: res.verification! }));
                    toast.success('Add the TXT record below, then click Verify.');
                } else {
                    setSslProvisioningDomains(prev => ({ ...prev, [domainValue]: Date.now() }));
                    toast.success('Domain active. SSL provisioning may take 1-2 minutes.');
                }
                if (res.warning) {
                    toast.warning(res.warning);
                }
            } else {
                toast.error(res.error || 'Failed to add domain');
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
                setSslProvisioningDomains(prev => ({ ...prev, [domain]: Date.now() }));
                toast.success('Domain active. SSL provisioning may take 1-2 minutes.');
            } else {
                if (res.verification && res.verification.length > 0) {
                    setVerifications(prev => ({ ...prev, [domain]: res.verification! }));
                }
                const friendly = res.error || 'Verification failed. Please check your DNS records.';
                setVerifyErrors(prev => ({ ...prev, [domain]: friendly }));
                toast.error(`Verification failed: ${friendly}`);
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
                setSslProvisioningDomains(prev => { const next = { ...prev }; delete next[domain]; return next; });
                setLastCheckedAt(prev => { const next = { ...prev }; delete next[domain]; return next; });
                if (res.warning) {
                    toast.warning(res.warning);
                } else {
                    toast.success('Custom domain removed.');
                }
            } else {
                toast.error(res.error || 'Failed to remove domain');
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
                    toast.success('Platform subdomain is now your primary domain.');
                }
            } else {
                res = await setPrimaryDomain(selected);
                if (res.success) {
                    setDomains(prev => prev.map(d => ({ ...d, isPrimary: d.domain === selected })));
                    toast.success(`"${selected}" is now your Primary Domain.`);
                }
            }
            if (!res.success) {
                toast.error(res.error || 'Failed to update primary domain.');
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
                <div className="hidden sm:flex h-[50px] w-[50px] items-center justify-center rounded-[16px] bg-blue-500/10 border border-blue-500/20 shrink-0">
                    <Globe className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                    <h1 className="text-[24px] font-bold text-slate-50">Domain Management</h1>
                    <p className="mt-1 text-[14px] text-slate-50/60 font-normal">Manage custom domains for your webstore</p>
                </div>
            </div>

            <div className="space-y-[16px]">
                {/* Banner — Figma 30872:1455, height: 102px, padding: 25px 25px 1px */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px] py-[25px] px-[25px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60" style={{ minHeight: '102px' }}>
                    {/* Text — Figma layout_T77324: column, gap 4px — self-center to prevent stretch */}
                    <div className="self-center">
                        <h2 className="text-[18px] font-semibold text-[#F8FAFC] leading-[1.556em] font-['Inter']">Add a Domain to your store</h2>
                        <p className="mt-[4px] text-[14px] font-normal text-[rgba(248,250,252,0.6)] leading-[1.429em] font-['Inter']">Connect your custom domain to make your store accessible</p>
                    </div>
                    {/* Buttons — stack on mobile, row on desktop */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[12px] sm:gap-[24px] shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsSelectPrimaryOpen(true)}
                            className="flex items-center justify-center py-[12px] px-[24px] sm:px-[68px] rounded-[16px] border border-white/[0.08] bg-transparent text-[#F8FAFC] text-[14px] sm:text-[16px] font-medium leading-[1.5em] hover:bg-white/5 transition-colors whitespace-nowrap font-['Inter']"
                        >
                            Select primary domain
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(true)}
                            style={{ background: 'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(45,212,191,1) 100%)' }}
                            className="flex items-center justify-center gap-2 h-[48px] px-6 rounded-[16px] text-white text-[14px] sm:text-[16px] font-semibold shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] hover:opacity-90 transition-opacity whitespace-nowrap font-['Inter']"
                        >
                            <Plus className="h-5 w-5" />
                            <span>Add Custom Domain</span>
                        </button>
                    </div>
                </div>

                {/* Platform subdomain card — F23: with slug editor */}
                <div className="flex flex-col pt-[25px] px-[25px] pb-[25px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 gap-[16px]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px]">
                        <div className="flex flex-col gap-2">
                            {!isEditingSlug ? (
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-[18px] font-semibold text-[#F8FAFC]">{currentSlug}.{DNS_CNAME}</h3>
                                    {!hasCustomPrimary && (
                                        <div className="flex items-center justify-center h-[26px] px-3 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.2)]">
                                            <span className="text-[12px] font-semibold text-[#C4B5FD]">Current Primary Domain</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-0">
                                    <input
                                        type="text"
                                        value={slugInput}
                                        onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63))}
                                        className="h-[44px] w-full max-w-[240px] px-4 rounded-l-[12px] border border-r-0 border-white/[0.08] bg-[#0B1120]/60 text-[14px] text-[#F8FAFC] font-mono focus:outline-none focus:border-blue-500/50 transition-colors"
                                        autoFocus
                                    />
                                    <div className="h-[44px] flex items-center px-3 rounded-r-[12px] border border-l-0 border-white/[0.08] bg-[#0B1120]/40 text-[13px] text-slate-500 whitespace-nowrap">
                                        .{DNS_CNAME}
                                    </div>
                                    <div className="ml-2">
                                        {slugStatus === 'checking' && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
                                        {slugStatus === 'available' && <Check className="h-4 w-4 text-[#05DF72]" />}
                                        {(slugStatus === 'unavailable' || slugStatus === 'invalid') && (
                                            <span className="text-[12px] text-[#FF6467]">{slugMessage}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="flex h-[34px] w-fit items-center justify-center gap-[6px] rounded-[12px] border border-[#00C950]/30 bg-[#00C950]/10 pl-[12px] pr-[16px]">
                                <Check className="h-4 w-4 text-[#05DF72]" strokeWidth={2.5} />
                                <span className="text-[14px] font-medium leading-none text-[#B9F8CF]">Connected</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {!isEditingSlug ? (
                                <button
                                    type="button"
                                    onClick={() => { setIsEditingSlug(true); setSlugInput(currentSlug); setSlugStatus('idle'); }}
                                    className="flex items-center gap-2 py-[10px] px-[16px] rounded-[12px] border border-white/[0.08] bg-transparent text-[#F8FAFC] text-[13px] font-medium hover:bg-white/5 transition-colors"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Change subdomain
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setIsEditingSlug(false); setSlugInput(currentSlug); setSlugStatus('idle'); }}
                                        className="py-[10px] px-[16px] rounded-[12px] border border-white/[0.08] text-[#F8FAFC] text-[13px] font-medium hover:bg-white/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={slugStatus !== 'available' || slugInput === currentSlug}
                                        onClick={() => setShowSlugConfirm(true)}
                                        className="py-[10px] px-[16px] rounded-[12px] text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                                        style={{ background: slugStatus === 'available' ? 'linear-gradient(90deg, #3B82F6, #2DD4BF)' : '#374151' }}
                                    >
                                        Save
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* F23: Slug change confirmation dialog */}
                {showSlugConfirm && (
                    <>
                        <div className="fixed inset-0 z-[100] bg-[#0B1120]/60 animate-in fade-in duration-200" onClick={() => setShowSlugConfirm(false)} />
                        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-[420px] rounded-[16px] border border-white/[0.08] bg-[#1E293B] p-6 shadow-xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-[18px] font-semibold text-[#F8FAFC]">Change subdomain?</h3>
                            <div className="mt-3 space-y-2">
                                <p className="text-[14px] text-[rgba(248,250,252,0.6)]">
                                    Your current subdomain <span className="font-mono text-[#F8FAFC]">{currentSlug}</span> will redirect to <span className="font-mono text-[#F8FAFC]">{slugInput}</span> for 30 days.
                                </p>
                                <p className="text-[14px] text-orange-400">
                                    After 30 days, the old link will stop working. Update your marketing materials.
                                </p>
                            </div>
                            <div className="mt-5 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowSlugConfirm(false)}
                                    className="py-[10px] px-[20px] rounded-[12px] border border-white/[0.08] text-[#F8FAFC] text-[14px] font-medium hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={savingSlug}
                                    onClick={handleSaveSlug}
                                    className="flex items-center gap-2 py-[10px] px-[20px] rounded-[12px] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                                    style={{ background: 'linear-gradient(90deg, #3B82F6, #2DD4BF)' }}
                                >
                                    {savingSlug && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Confirm change
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Custom Domain Cards */}
                {domains.map((domainObj) => {
                    const { domain, status } = domainObj;

                    if (status === 'pending') {
                        return (
                            <div key={domain} className="flex flex-col p-[25px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 gap-[16px] animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-[18px] font-semibold text-[#F8FAFC]">{domain}</h3>
                                    <div className="flex h-[34px] w-fit items-center justify-center gap-[6px] rounded-[12px] border border-orange-500/30 bg-orange-500/10 pl-[12px] pr-[16px]">
                                        <AlertCircle className="h-4 w-4 text-orange-400" strokeWidth={2.5} />
                                        <span className="text-[14px] font-medium leading-none text-orange-300">Pending Verification</span>
                                    </div>
                                </div>

                                <div className="flex flex-col p-[16px] rounded-[16px] border border-white/[0.08] bg-[#0B1120]/50 gap-4">
                                    <p className="text-[14px] text-[#F8FAFC]">Configure these DNS records at your domain registrar:</p>
                                    <div className="flex flex-col gap-4">
                                        {/* A Record */}
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[12px] font-medium text-[rgba(248,250,252,0.6)] uppercase tracking-wider">A Record (Static IPs)</span>
                                            <div className="flex flex-col gap-2">
                                                {DNS_A_RECORD.split(',').map((ip, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <div className="flex-1 h-[44px] flex items-center px-4 rounded-[12px] border border-white/[0.08] bg-[#1E293B]/40">
                                                            <span className="text-[14px] text-[#F8FAFC] font-mono">{ip.trim()}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => { navigator.clipboard.writeText(ip.trim()); toast.success(`Copied IP ${idx + 1}! ✅`); }}
                                                            className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-colors shrink-0"
                                                        >
                                                            <Copy className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <p className="text-[12px] text-slate-400">Point your domain to any of these IPs.</p>
                                            </div>
                                        </div>
                                        {/* CNAME Record */}
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[12px] font-medium text-[rgba(248,250,252,0.6)] uppercase tracking-wider">CNAME Record</span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-[44px] flex items-center px-4 rounded-[12px] border border-white/[0.08] bg-[#1E293B]/40">
                                                    <span className="text-[14px] text-[#F8FAFC] font-mono">{DNS_CNAME}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { navigator.clipboard.writeText(DNS_CNAME); toast.success('Copied! ✅'); }}
                                                    className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-colors shrink-0"
                                                >
                                                    <Copy className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Error banner */}
                                {verifyErrors[domain] && (
                                    <div className="flex items-start gap-[12px] w-full p-[16px] rounded-[16px] border border-[rgba(251,44,54,0.3)] bg-[rgba(251,44,54,0.1)] animate-in fade-in duration-200">
                                        <AlertCircle className="h-5 w-5 text-[#FF6467] shrink-0 mt-[1px]" strokeWidth={1.67} />
                                        <span className="text-[14px] font-normal leading-[1.43em] text-[#FFC9C9] font-['Inter']">
                                            {verifyErrors[domain]}
                                        </span>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-col sm:flex-row w-full gap-[12px]">
                                    <button
                                        type="button"
                                        onClick={() => handleVerify(domain)}
                                        disabled={verifyingDomain === domain}
                                        className="w-full sm:flex-1 flex items-center justify-center h-[50px] rounded-[16px] hover:opacity-90 text-white text-[16px] font-semibold font-['Inter'] transition-opacity gap-[8px] shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] disabled:opacity-70"
                                        style={{ background: 'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(45,212,191,1) 100%)' }}
                                    >
                                        {verifyingDomain === domain ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={2.5} />}
                                        {verifyingDomain === domain ? 'Verifying...' : 'Verify Connection'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRemovingDomain(domain)}
                                        disabled={isPending}
                                        className="w-full sm:w-[112px] flex items-center justify-center h-[50px] rounded-[16px] border border-[rgba(251,44,54,0.3)] bg-transparent text-[#FF6467] hover:bg-[rgba(251,44,54,0.08)] text-[16px] font-semibold font-['Inter'] transition-colors disabled:opacity-50"
                                    >
                                        Remove
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
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-[25px] px-[25px] pb-[1px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 gap-[16px]">
                                <div className="flex flex-col gap-2 pb-[25px]">
                                    <h3 className="text-[18px] font-semibold text-[#F8FAFC]">{domain}</h3>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <div className="flex h-[34px] w-fit items-center justify-center gap-[6px] rounded-[12px] border border-[#00C950]/30 bg-[#00C950]/10 pl-[12px] pr-[16px]">
                                            <Check className="h-4 w-4 text-[#05DF72]" strokeWidth={2.5} />
                                            <span className="text-[14px] font-medium leading-none text-[#B9F8CF]">Connected & Secured</span>
                                        </div>
                                        {isPrimary && (
                                            <div className="flex items-center justify-center h-[26px] px-3 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.2)]">
                                                <span className="text-[12px] font-semibold text-[#C4B5FD]">Current Primary Domain</span>
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
                                        className="flex items-center justify-center h-[44px] px-[16px] rounded-[12px] border border-[#FB2C36]/30 bg-transparent text-[#FF6467] hover:bg-[#FB2C36]/10 text-[14px] font-semibold transition-colors font-['Inter'] disabled:opacity-50"
                                        title={isPrimary ? 'Cannot remove the primary domain' : 'Remove domain'}
                                    >
                                        Remove Domain
                                    </button>
                                </div>
                                </div>
                                {/* SSL Provisioning banner — render only when recently flipped active */}
                                {sslProvisioningDomains[domain] && (
                                    <SslProvisioningBanner
                                        domain={domain}
                                        shownAt={sslProvisioningDomains[domain]}
                                        onDismiss={() => setSslProvisioningDomains(prev => {
                                            const next = { ...prev };
                                            delete next[domain];
                                            return next;
                                        })}
                                    />
                                )}
                            </div>
                        );
                    }

                    return null;
                })}
            </div>

            {/* ── Add Domain Modal ──────────────────────────────────────────── */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B1120]/80 p-4 animate-in fade-in duration-200">
                    <div className="flex flex-col w-[448px] max-w-full p-[25px] rounded-[16px] bg-[#1E293B] border border-white/[0.08] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-200">
                        {/* Heading + Note — Figma: heading y=25 h=28, note y=61 h=20 → gap=8px */}
                        <div className="flex flex-col">
                            {/* Dùng div + m-0 để triệt tiêu mọi margin mặc định từ global CSS (h3 thường tự có margin-bottom) */}
                            <div className="m-0 p-0 text-[20px] font-semibold text-[#F8FAFC] leading-[1.4em] font-['Inter']">
                                Enter the domain name you own
                            </div>
                            {/* Dùng div + mt-[2px] m-0 để triệt tiêu mọi margin từ thẻ p (p thường có margin-top) */}
                            <div className="m-0 p-0 mt-[2px] text-[14px] font-bold text-[rgba(248,250,252,0.6)] leading-[1.428em] font-['Inter']">
                                Note: Make sure you have access to your registrar
                            </div>
                        </div>
                        {/* Input — Figma: y=105, note bottom=81 → gap=24px */}
                        <input
                            type="text"
                            value={newDomainInput}
                            onChange={(e) => setNewDomainInput(e.target.value.replace(/https?:\/\//i, ''))}
                            onKeyDown={(e) => e.key === 'Enter' && !isPending && handleAddDomain()}
                            placeholder="example.com"
                            autoFocus
                            className="mt-[24px] w-full h-[50px] py-[12px] px-[16px] rounded-[16px] bg-[#0B1120] border border-white/[0.08] text-[16px] font-normal text-[#F8FAFC] placeholder:text-[rgba(248,250,252,0.4)] focus:outline-none transition-all font-['Inter']"
                        />
                        {/* Buttons — Figma: y=179, input bottom=155 → gap=24px */}
                        <div className="mt-[24px] flex items-center gap-[12px]">
                            <button
                                type="button"
                                onClick={() => { setIsAddModalOpen(false); setNewDomainInput(''); }}
                                className="flex-1 flex items-center justify-center h-[50px] rounded-[16px] border border-white/[0.08] bg-transparent text-[#F8FAFC] text-[16px] font-medium leading-[1.5em] hover:bg-white/5 transition-colors font-['Inter']"
                            >
                                Cancel
                            </button>
                            {/* Figma: dim gradient when empty, full gradient when input has value */}
                            <button
                                type="button"
                                onClick={handleAddDomain}
                                disabled={isPending}
                                style={{ background: 'linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)' }}
                                className={`flex-1 flex items-center justify-center gap-2 h-[50px] rounded-[16px] text-white text-[16px] font-semibold leading-[1.5em] transition-all shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] font-['Inter'] ${newDomainInput.trim() ? 'opacity-100 hover:opacity-90' : 'opacity-50'} ${isPending ? 'opacity-50' : ''}`}
                            >
                                {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                                Add Domain
                            </button>
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
                />
            )}

            {/* ── Remove Domain Confirmation Modal (TC-F19.14 QA) ─────────── */}
            {removingDomain && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B1120]/80 p-4 animate-in fade-in duration-200">
                    <div className="flex flex-col w-[448px] max-w-full p-[25px] rounded-[16px] bg-[#1E293B] border border-white/[0.08] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col">
                            <div className="m-0 p-0 text-[20px] font-semibold text-[#F8FAFC] leading-[1.4em] font-['Inter']">
                                Remove domain
                            </div>
                            <div className="m-0 p-0 mt-[8px] text-[14px] font-normal text-[rgba(248,250,252,0.6)] leading-[1.428em] font-['Inter']">
                                Are you sure you want to remove <span className="font-semibold text-[#F8FAFC]">{removingDomain}</span>? This will revoke the SSL certificate and the domain will no longer route to your store.
                            </div>
                        </div>
                        <div className="mt-[24px] flex items-center gap-[12px]">
                            <button
                                type="button"
                                onClick={() => setRemovingDomain(null)}
                                className="flex-1 flex items-center justify-center h-[50px] rounded-[16px] border border-white/[0.08] bg-transparent text-[#F8FAFC] text-[16px] font-medium leading-[1.5em] hover:bg-white/5 transition-colors font-['Inter']"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRemoveConfirm}
                                disabled={isPending}
                                className="flex-1 flex items-center justify-center gap-2 h-[50px] rounded-[16px] border border-[#FB2C36]/30 bg-[#FB2C36]/10 text-[#FF6467] text-[16px] font-semibold leading-[1.5em] hover:bg-[#FB2C36]/20 transition-colors font-['Inter'] disabled:opacity-50"
                            >
                                {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                                Remove Domain
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
