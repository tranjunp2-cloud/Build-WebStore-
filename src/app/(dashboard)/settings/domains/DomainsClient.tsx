"use client";

import React, { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Plus, AlertCircle, AlertTriangle, Copy, Check, ChevronRight, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { WebsiteStatusCard } from './WebsiteStatusCard';
import type { WebsiteStatus } from './website-status';
import { useI18n } from '@/i18n';
import { resolveApiError } from '@/lib/ui/resolve-api-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
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

    if (typeof document === 'undefined') return null

    return createPortal(
        <>
            {/* Backdrop — rendered via portal at document.body to escape ancestor stacking context */}
            <div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />
            {/* Slide-in panel from right — Figma: bg --dash-surface, w-592px on desktop */}
            <div
                className="fixed right-0 top-0 bottom-0 z-[101] flex flex-col w-full max-w-[448px] sm:max-w-[448px] animate-in slide-in-from-right duration-300 shadow-[−25px_0_50px_-12px_rgba(0,0,0,0.5)]"
                style={{ background: 'var(--dash-surface)' }}
            >

                {/* Close chevron button — Figma circular outlined accent */}
                <Button
                    type="button"
                    onClick={onClose}
                    variant="ghost"
                    size="icon"
                    className="absolute top-[20px] left-[-18px] h-[36px] w-[36px] rounded-full shrink-0 z-10"
                    style={{
                        background: 'var(--dash-surface)',
                        border: '1px solid var(--dash-border)',
                        color: 'var(--dash-text)',
                    }}
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>

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
                                <Button
                                    key={opt.value ?? '__platform__'}
                                    type="button"
                                    onClick={() => setSelected(opt.value)}
                                    variant="ghost"
                                    className="flex items-center gap-[12px] w-full p-[16px] h-auto rounded-lg transition-all justify-start font-['Inter']"
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
                                        className="min-w-0 text-left text-[16px] font-normal leading-normal whitespace-normal [overflow-wrap:anywhere]"
                                        style={{ color: isSelected ? 'var(--dash-text)' : 'var(--dash-text-muted)' }}
                                    >
                                        {opt.label}
                                    </span>
                                </Button>
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
                        size="dash"
                        className="flex-1 font-medium"
                    >
                        {t?.Domains?.cancel || 'Cancel'}
                    </Button>
                    <Button
                        type="button"
                        disabled={isPending}
                        onClick={() => onSave(selected)}
                        variant="dashPrimary"
                        size="dash"
                        className="flex-1"
                    >
                        {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
                        {t?.Domains?.save || 'Save'}
                    </Button>
                </div>
            </div>
        </>,
        document.body
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

                    <Label className="text-[12px] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>Name</Label>
                    <div className="flex items-center gap-2 mt-1 mb-3">
                        <code className="flex-1 p-2 rounded-[8px] bg-white/[0.03] text-[13px] font-mono break-all" style={{ color: 'var(--dash-text)' }}>
                            {v.domain}
                        </code>
                        <Button
                            type="button"
                            onClick={() => copy(`name-${i}`, v.domain)}
                            aria-label={`Copy TXT record name ${v.domain}`}
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}
                        >
                            {copiedKey === `name-${i}` ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>

                    <Label className="text-[12px] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>Value</Label>
                    <div className="flex items-center gap-2 mt-1 mb-2">
                        <code className="flex-1 p-2 rounded-[8px] bg-white/[0.03] text-[13px] font-mono break-all" style={{ color: 'var(--dash-text)' }}>
                            {v.value}
                        </code>
                        <Button
                            type="button"
                            onClick={() => copy(`value-${i}`, v.value)}
                            aria-label="Copy TXT record value"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            style={{ border: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}
                        >
                            {copiedKey === `value-${i}` ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                        </Button>
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
                size="dash"
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
    website,
}: {
    tenantId: string;
    tenantSlug: string;
    customDomains: DomainEntry[];
    /** US-F05-10: website publish status (absent when the tenant has no site yet). */
    website?: { siteId: string; status: WebsiteStatus; siteUrl: string | null; canUnpublish: boolean } | null;
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
    // F23 #1459: track IME composition so we don't sanitize mid-composition (drops Vietnamese chars)
    const isComposingRef = useRef(false);
    // GH-1583 review: state mirror của isComposingRef cho effect debounce (ref không làm effect
    // chạy lại) — đổi state ở compositionEnd đảm bảo effect re-run kể cả khi buffer sau sanitize
    // không đổi giá trị (vd 'shopd'), không thì check cuối bị nuốt.
    const [isComposingSlug, setIsComposingSlug] = useState(false);
    // GH-1583 review: seq tăng mỗi lần input/mode đổi; response fetch về muộn mang seq cũ bị bỏ —
    // chặn check đang bay đè status của input đã gõ khác / đã revert / đã Cancel.
    const slugCheckSeqRef = useRef(0);
    const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63);

    const checkSlugAvailability = useCallback(async (slug: string, seq: number) => {
        if (slug === currentSlug) { setSlugStatus('idle'); return; }
        if (slug.length < 3) { setSlugStatus('invalid'); setSlugMessage(t?.Domains?.slugMinChars || 'At least 3 characters'); return; }
        setSlugStatus('checking');
        try {
            const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(slug)}`);
            const data = await res.json();
            // Seq cũ = input đã đổi trong lúc chờ response → kết quả này mô tả slug khác, bỏ.
            if (seq !== slugCheckSeqRef.current) return;
            if (res.ok && data.available) { setSlugStatus('available'); setSlugMessage(''); }
            else if (res.status === 422) { setSlugStatus('invalid'); setSlugMessage(data.message || 'Invalid format'); }
            else if (res.status === 409) { setSlugStatus('unavailable'); setSlugMessage(t?.Domains?.slugReserved || 'Reserved'); }
            else { setSlugStatus('unavailable'); setSlugMessage(t?.Domains?.slugTaken || 'Already taken'); }
        } catch {
            if (seq !== slugCheckSeqRef.current) return;
            setSlugStatus('invalid'); setSlugMessage(t?.Domains?.slugCheckFailed || 'Check failed');
        }
    }, [currentSlug, t]);

    useEffect(() => {
        // Mọi thay đổi input/mode vô hiệu hóa check đang bay (seq guard trong checkSlugAvailability).
        slugCheckSeqRef.current += 1;
        if (!isEditingSlug) return;
        // Buffer IME chưa chốt không phải slug candidate — không check, không reset;
        // isComposingSlug là state nên compositionEnd chắc chắn kéo effect chạy lại.
        if (isComposingSlug) return;
        if (slugInput === currentSlug) {
            // GH-1583: gõ về đúng slug hiện tại thì reset về idle — nhánh này không
            // schedule checkSlugAvailability nên message lỗi cũ sẽ treo nếu không reset.
            setSlugStatus('idle');
            setSlugMessage('');
            return;
        }
        // Verdict cũ hết hiệu lực NGAY khi gõ tiếp — không reset thì Save vẫn sáng ~400ms
        // với status 'available' của slug trước đó trong lúc chờ debounce.
        setSlugStatus('idle');
        setSlugMessage('');
        if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
        const seq = slugCheckSeqRef.current;
        slugDebounceRef.current = setTimeout(() => checkSlugAvailability(slugInput, seq), 400);
        return () => { if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current); };
    }, [slugInput, isEditingSlug, isComposingSlug, checkSlugAvailability, currentSlug]);

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

            {website && (
                <WebsiteStatusCard
                    siteId={website.siteId}
                    status={website.status}
                    siteUrl={website.siteUrl}
                    canUnpublish={website.canUnpublish}
                />
            )}

            <div className="space-y-[16px]">
                {/* Banner — Figma 30872:1455, height: 102px, padding: 25px 25px 1px */}
                <div
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px] p-[16px] sm:py-[25px] sm:px-[25px] rounded-[16px]"
                    style={{ minHeight: '102px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                >
                    {/* Text — Figma layout_T77324: column, gap 4px — self-center to prevent stretch */}
                    <div className="self-center">
                        <h2 className="text-[18px] font-semibold leading-[1.556em] font-['Inter']" style={{ color: 'var(--dash-text)' }}>{t?.Domains?.addDomainHeading || 'Add a Domain to your store'}</h2>
                        <p className="mt-[4px] text-[14px] font-normal leading-[1.429em] font-['Inter']" style={{ color: 'var(--dash-text-muted)' }}>{t?.Domains?.addDomainDesc || 'Connect your custom domain to make your store accessible'}</p>
                    </div>
                    {/* Buttons — one row on all sizes (mobile: both share the row via flex-1,
                        text shrinks + wraps if needed at very narrow widths). Desktop unchanged. */}
                    <div className="flex flex-row items-stretch sm:items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            onClick={() => setIsSelectPrimaryOpen(true)}
                            variant="dashSecondary"
                            size="dash"
                            className="flex-1 sm:flex-none min-w-0 h-auto min-h-9 px-3 sm:px-4 py-1.5 leading-tight whitespace-normal sm:whitespace-nowrap text-xs sm:text-[13px] font-['Inter']"
                        >
                            {t?.Domains?.selectPrimary || 'Select primary domain'}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => { setIsAddModalOpen(true); setDomainError(''); setNewDomainInput(''); }}
                            variant="dashPrimary"
                            size="dash"
                            className="flex-1 sm:flex-none min-w-0 h-auto min-h-9 px-3 sm:px-4 py-1.5 leading-tight whitespace-normal sm:whitespace-nowrap text-xs sm:text-[13px] font-['Inter']"
                        >
                            <Plus className="h-4 w-4" />
                            <span>{t?.Domains?.addCustomDomain || 'Add Custom Domain'}</span>
                        </Button>
                    </div>
                </div>

                {/* Platform subdomain card — F23: with slug editor */}
                <div
                    className="flex flex-col p-[16px] sm:pt-[25px] sm:px-[25px] sm:pb-[25px] rounded-[16px] gap-[16px]"
                    style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px]">
                        <div className="flex min-w-0 flex-col gap-2">
                            {!isEditingSlug ? (
                                <div className="flex min-w-0 flex-wrap items-center gap-3">
                                    <h3 className="min-w-0 text-[18px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--dash-text)' }}>{currentSlug}.{PLATFORM_DOMAIN}</h3>
                                    {!hasCustomPrimary && (
                                        <div className="flex items-center justify-center h-[26px] px-3 rounded-full border border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.2)]">
                                            <span className="text-[12px] font-semibold text-[hsl(var(--info))]">{t?.Domains?.currentPrimary || 'Current Primary Domain'}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    {/* GH-1583: flex-wrap để cụm status/message rớt xuống dưới input trên mobile
                                        (input w-full chiếm trọn hàng) thay vì tràn khỏi viewport; desktop không đổi
                                        vì input max-w-[520px], gap-x-2 giữ đúng 8px như ml-2 cũ. */}
                                    {/* Input-group: viền + focus-ring nằm ở khung bao ngoài (focus-within)
                                        nên cả cụm input + hậu tố .domain sáng viền liền mạch khi focus.
                                        Input bên trong để trong suốt (cùng pattern ô tiền "RM" form discount). */}
                                    <div
                                        className="flex h-10 w-full sm:max-w-[520px] items-center rounded-lg border border-[hsl(var(--input-border))] transition-colors focus-within:border-[hsl(var(--ring))] focus-within:ring-1 focus-within:ring-[hsl(var(--ring))]"
                                        style={{ background: 'var(--dash-surface)' }}
                                    >
                                        <input
                                            type="text"
                                            value={slugInput}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                // While IME is composing, keep the raw buffer so Vietnamese
                                                // (Telex/VNI) chars aren't dropped; sanitize on compositionEnd.
                                                setSlugInput(isComposingRef.current ? raw : sanitizeSlug(raw));
                                            }}
                                            onCompositionStart={() => { isComposingRef.current = true; setIsComposingSlug(true); }}
                                            onCompositionEnd={(e) => {
                                                isComposingRef.current = false;
                                                setIsComposingSlug(false);
                                                setSlugInput(sanitizeSlug(e.currentTarget.value));
                                            }}
                                            className="h-full min-w-0 flex-1 border-0 bg-transparent pl-3 pr-1 text-[13px] font-mono outline-none"
                                            style={{ color: 'var(--dash-text)' }}
                                            autoFocus
                                        />
                                        <span className="flex h-full items-center pr-3 text-[13px] text-slate-500 whitespace-nowrap shrink-0">
                                            .{PLATFORM_DOMAIN}
                                        </span>
                                    </div>
                                    {/* Idle không render — div rỗng sẽ wrap thành dòng thừa (gap-y) trên mobile. */}
                                    {slugStatus !== 'idle' && (
                                        <div className="min-w-0">
                                            {slugStatus === 'checking' && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
                                            {slugStatus === 'available' && <Check className="h-4 w-4 text-[hsl(var(--success))]" />}
                                            {(slugStatus === 'unavailable' || slugStatus === 'invalid') && (
                                                <span className="text-[12px] text-[hsl(var(--destructive))] break-words">{slugMessage}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* "Connected" status badge — theme-aware via Badge success variant */}
                            <Badge variant="success" dot className="h-[34px] px-3 rounded-[12px] text-[14px] font-medium w-fit">
                                {t?.Domains?.connected || 'Connected'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                            {!isEditingSlug ? (
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setIsEditingSlug(true); setSlugInput(currentSlug); setSlugStatus('idle');
                                        // Cancel giữa IME composition unmount input trước khi compositionend kịp bắn
                                        // → flag kẹt true và effect debounce bỏ qua mọi check ở session sau. Reset ở đây.
                                        setIsComposingSlug(false); isComposingRef.current = false;
                                    }}
                                    variant="dashSecondary"
                                    size="dash"
                                    className="w-full sm:w-auto justify-center"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    {t?.Domains?.changeSubdomain || 'Change subdomain'}
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <Button
                                        type="button"
                                        onClick={() => { setIsEditingSlug(false); setSlugInput(currentSlug); setSlugStatus('idle'); }}
                                        variant="dashSecondary"
                                        size="dash"
                                        className="flex-1 sm:flex-none justify-center"
                                    >
                                        {t?.Domains?.cancel || 'Cancel'}
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={slugStatus !== 'available' || slugInput === currentSlug}
                                        onClick={() => setShowSlugConfirm(true)}
                                        variant="dashPrimary"
                                        size="dash"
                                        className="flex-1 sm:flex-none justify-center"
                                    >
                                        {t?.Domains?.save || 'Save'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* F23: Slug change confirmation dialog */}
                {showSlugConfirm && typeof document !== 'undefined' && createPortal(
                    <>
                        <div
                            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
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
                                    size="dash"
                                    className="font-medium"
                                >
                                    {t?.Domains?.cancel || 'Cancel'}
                                </Button>
                                <Button
                                    type="button"
                                    disabled={savingSlug}
                                    onClick={handleSaveSlug}
                                    variant="dashPrimary"
                                    size="dash"
                                >
                                    {savingSlug && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {t?.Domains?.confirmChange || 'Confirm change'}
                                </Button>
                            </div>
                        </div>
                    </>,
                    document.body
                )}

                {/* Custom Domain Cards */}
                {domains.map((domainObj) => {
                    const { domain, status } = domainObj;

                    if (status === 'pending') {
                        return (
                            <div
                                key={domain}
                                className="flex flex-col p-[16px] sm:p-[25px] rounded-[16px] gap-[16px] animate-in slide-in-from-bottom-4 fade-in duration-300"
                                style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                            >
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-[18px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--dash-text)' }}>{domain}</h3>
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
                                                            className="flex-1 h-10 flex items-center px-4 rounded-[12px]"
                                                            style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                                                        >
                                                            <span className="text-[14px] font-mono" style={{ color: 'var(--dash-text)' }}>{ip.trim()}</span>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            onClick={() => { navigator.clipboard.writeText(ip.trim()); toast.success((t?.Domains?.copiedIp || 'Copied IP {n}!').replace('{n}', String(idx + 1))); }}
                                                            aria-label={`Copy A record IP ${idx + 1}`}
                                                            variant="ghost"
                                                            size="icon"
                                                            className="bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] shrink-0"
                                                        >
                                                            <Copy className="h-5 w-5" />
                                                        </Button>
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
                                                    className="flex-1 h-10 flex items-center px-4 rounded-[12px]"
                                                    style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                                                >
                                                    <span className="text-[14px] font-mono" style={{ color: 'var(--dash-text)' }}>{DNS_CNAME}</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={() => { navigator.clipboard.writeText(DNS_CNAME); toast.success(t?.Domains?.copied || 'Copied!'); }}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] shrink-0"
                                                >
                                                    <Copy className="h-5 w-5" />
                                                </Button>
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
                                        size="dash"
                                        className="w-full sm:flex-1 gap-[8px]"
                                    >
                                        {verifyingDomain === domain ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={2.5} />}
                                        {verifyingDomain === domain ? (t?.Domains?.verifying || 'Verifying...') : (t?.Domains?.verifyConnection || 'Verify Connection')}
                                    </Button>
                                    {/* Shared <Button> dashSecondary, outline destructive (GH-1290 Bug 1) */}
                                    <Button
                                        type="button"
                                        variant="dashSecondary"
                                        size="dash"
                                        onClick={() => setRemovingDomain(domain)}
                                        disabled={isPending}
                                        className="w-full sm:w-[112px] font-semibold [border:1px_solid_hsl(var(--destructive)/0.3)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)]"
                                    >
                                        {t?.Domains?.remove || 'Remove'}
                                    </Button>
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
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-[16px] px-[16px] pb-[1px] sm:pt-[25px] sm:px-[25px] rounded-[16px] gap-[16px]"
                                    style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
                                >
                                    <div className="flex min-w-0 flex-col gap-2 pb-[16px] sm:pb-[25px]">
                                        <h3 className="text-[18px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--dash-text)' }}>{domain}</h3>
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
                                    <div className="flex shrink-0 items-center gap-3 pb-[16px] sm:pb-[25px]">
                                        {/* Shared <Button> dashSecondary, outline destructive (GH-1290 Bug 1) */}
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="dashSecondary"
                                                        size="dash"
                                                        onClick={() => setRemovingDomain(domain)}
                                                        disabled={isPending || isPrimary === true}
                                                        className="font-semibold [border:1px_solid_hsl(var(--destructive)/0.3)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)]"
                                                    >
                                                        {t?.Domains?.removeDomain || 'Remove Domain'}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {isPrimary ? 'Cannot remove the primary domain' : 'Remove domain'}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return null;
                })}
            </div>

            {/* ── Add Domain Modal ──────────────────────────────────────────── */}
            {isAddModalOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
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
                            className={cn("mt-[24px] text-[13px]", domainError && "border-[hsl(var(--destructive))]")}
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
                                size="dash"
                                className="flex-1 font-medium"
                            >
                                {t?.Domains?.cancel || 'Cancel'}
                            </Button>
                            {/* Figma: dim gradient when empty, full gradient when input has value */}
                            <Button
                                type="button"
                                onClick={handleAddDomain}
                                disabled={isPending}
                                variant="dashPrimary"
                                size="dash"
                                className={cn("flex-1", !newDomainInput.trim() && 'opacity-50')}
                            >
                                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t?.Domains?.addDomain || 'Add Domain'}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
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
            <ConfirmModal
                open={!!removingDomain}
                onConfirm={handleRemoveConfirm}
                onCancel={() => setRemovingDomain(null)}
                title={t?.Domains?.removeDomainTitle || 'Remove domain'}
                description={removingDomain ? (t?.Domains?.removeDomainConfirm || 'Are you sure you want to remove {domain}? This will revoke the SSL certificate and the domain will no longer route to your store.').replace('{domain}', removingDomain) : undefined}
                confirmLabel={t?.Domains?.removeDomain || 'Remove Domain'}
                cancelLabel={t?.Domains?.cancel || 'Cancel'}
                variant="danger"
                loading={isPending}
            />
        </div>
    );
}
