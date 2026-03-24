"use client";

import React, { useState, useTransition } from 'react';
import { Globe, Plus, AlertCircle, Copy, Check, X, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { addCustomDomain, verifyCustomDomain, removeCustomDomain, setPrimaryDomain, clearPrimaryDomain } from './actions';

// Đọc từ env vars — deploy production chỉ cần set 2 biến này, không sửa code
const DNS_A_RECORD = process.env.NEXT_PUBLIC_SERVER_IP ?? '192.168.1.1';  // fallback cho dev
const DNS_CNAME = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'primeweb.app';

export function DomainsClient({
    tenantId,
    tenantSlug,
    customDomains
}: {
    tenantId: string;
    tenantSlug: string;
    customDomains: Array<{ domain: string; status: string; isPrimary?: boolean | null }>;
}) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newDomainInput, setNewDomainInput] = useState("");
    const [isPending, startTransition] = useTransition();
    const [domains, setDomains] = useState(customDomains);
    const [verifyErrors, setVerifyErrors] = useState<Record<string, string>>({});

    const handleAddDomain = () => {
        if (!newDomainInput.trim() || !newDomainInput.includes(".")) {
            toast.error("Please enter a valid domain name");
            return;
        }
        const domainValue = newDomainInput.trim().toLowerCase();
        startTransition(async () => {
            const res = await addCustomDomain(tenantId, domainValue);
            if (res.success) {
                setIsAddModalOpen(false);
                setNewDomainInput("");
                // Optimistic update — show immediately in UI
                setDomains(prev => [...prev, { domain: domainValue, status: 'pending' }]);
                toast.success("Domain added successfully! Please configure DNS.");
            } else {
                toast.error(res.error || "Failed to add domain");
            }
        });
    };

    const handleVerify = (domain: string) => {
        setVerifyErrors(prev => { const next = { ...prev }; delete next[domain]; return next; }); // clear on retry
        startTransition(async () => {
            const res = await verifyCustomDomain(tenantId, domain);
            if (res.success) {
                setDomains(prev => prev.map(d => d.domain === domain ? { ...d, status: 'active' } : d));
                toast.success("Domain verified successfully! SSL connection secured.");
            } else {
                setVerifyErrors(prev => ({ ...prev, [domain]: res.error || 'Verification failed.' }));
            }
        });
    };

    const handleRemove = (domain: string) => {
        startTransition(async () => {
            const res = await removeCustomDomain(tenantId, domain);
            if (res.success) {
                setDomains(prev => prev.filter(d => d.domain !== domain));
                toast.success("Custom domain removed.");
            } else {
                toast.error(res.error || "Failed to remove domain");
            }
        });
    };

    const handleSetPrimary = (domain: string) => {
        startTransition(async () => {
            const res = await setPrimaryDomain(tenantId, domain);
            if (res.success) {
                setDomains(prev => prev.map(d => ({ ...d, isPrimary: d.domain === domain })));
                toast.success(`"${domain}" is now your Primary Domain.`);
            } else {
                toast.error(res.error || 'Failed to set primary domain.');
            }
        });
    };

    // Derive: is there a custom domain set as primary?
    const hasCustomPrimary = domains.some(d => d.status === 'active' && d.isPrimary);

    return (
        <div className="w-full space-y-[28px]">
            {/* Header */}
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
                {/* Add Domain Banner */}
                <div className="flex flex-col gap-4 p-[25px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 transition-colors sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-[18px] font-semibold text-slate-50">Add a Domain to your store</h2>
                        <p className="mt-1 text-[14px] text-slate-50/60">Connect your custom domain to make your store accessible</p>
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex w-full sm:w-auto items-center justify-center gap-2 h-[48px] px-6 rounded-[16px] bg-gradient-to-r from-blue-500 to-teal-400 text-white font-semibold shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] hover:opacity-90 transition-opacity whitespace-nowrap"
                    >
                        <Plus className="h-5 w-5" />
                        <span>Add Custom Domain</span>
                    </button>
                </div>

                {/* Primary Domain Card — platform subdomain, always present */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-[25px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 transition-colors gap-[16px]">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-[18px] font-semibold text-slate-50">{tenantSlug}.echprime.com</h3>
                            {/* Show purple primary badge only when NO custom domain is set as primary */}
                            {!hasCustomPrimary && (
                                <div className="flex items-center justify-center h-[26px] px-3 rounded-full border border-purple-500/30 bg-purple-500/20">
                                    <span className="text-[12px] font-semibold text-[#C4B5FD]">Current Primary Domain</span>
                                </div>
                            )}
                        </div>
                        <div className="flex h-[34px] w-fit items-center justify-center gap-[6px] rounded-[12px] border border-[#00C950]/30 bg-[#00C950]/10 pl-[12px] pr-[16px] mt-2">
                            <Check className="h-4 w-4 text-[#05DF72]" strokeWidth={2.5} />
                            <span className="text-[14px] font-medium leading-none text-[#B9F8CF]">Connected</span>
                        </div>
                    </div>
                    {/* When a custom domain is primary, allow resetting to platform subdomain */}
                    {hasCustomPrimary && (
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                                startTransition(async () => {
                                    const res = await clearPrimaryDomain(tenantId);
                                    if (res.success) {
                                        setDomains(prev => prev.map(d => ({ ...d, isPrimary: false })));
                                        toast.success('Reset to platform subdomain as primary.');
                                    } else {
                                        toast.error(res.error || 'Failed to reset primary domain.');
                                    }
                                });
                            }}
                            className="hidden sm:flex items-center justify-center h-[44px] px-[16px] rounded-[12px] border border-purple-500/30 bg-purple-500/10 text-[#C4B5FD] hover:bg-purple-500/20 text-[14px] font-semibold transition-colors font-['Inter'] disabled:opacity-50 whitespace-nowrap"
                        >
                            Set as Default Primary
                        </button>
                    )}
                </div>

                {/* Custom Domain Cards */}
                {domains && domains.map((domainObj) => {
                    const { domain, status } = domainObj;

                    if (status === 'pending') {
                        return (
                            <div key={domain} className="flex flex-col p-[25px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 transition-colors gap-[16px] animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-[18px] font-semibold text-slate-50">{domain}</h3>
                                    <div className="flex h-[34px] w-fit items-center justify-center gap-[6px] rounded-[12px] border border-orange-500/30 bg-orange-500/10 pl-[12px] pr-[16px] mt-2">
                                        <AlertCircle className="h-4 w-4 text-orange-400" strokeWidth={2.5} />
                                        <span className="text-[14px] font-medium leading-none text-orange-300">Pending Verification</span>
                                    </div>
                                </div>

                                <div className="flex flex-col p-[16px] rounded-[16px] border border-white/[0.08] bg-[#0B1120]/50 mt-2 gap-4">
                                    <p className="text-[14px] text-slate-50">Configure these DNS records at your domain registrar:</p>

                                    <div className="flex flex-col gap-4">
                                        {/* A Record */}
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[12px] font-medium text-slate-50/60 uppercase tracking-wider">A Record</span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-[44px] flex items-center px-4 rounded-[12px] border border-white/[0.08] bg-[#1E293B]/40">
                                                    <span className="text-[14px] text-slate-50 font-mono">{DNS_A_RECORD}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { navigator.clipboard.writeText(DNS_A_RECORD); toast.success("Copied! ✅"); }}
                                                    className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-colors shrink-0"
                                                >
                                                    <Copy className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* CNAME Record */}
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[12px] font-medium text-slate-50/60 uppercase tracking-wider">CNAME Record</span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-[44px] flex items-center px-4 rounded-[12px] border border-white/[0.08] bg-[#1E293B]/40">
                                                    <span className="text-[14px] text-slate-50 font-mono">{DNS_CNAME}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { navigator.clipboard.writeText(DNS_CNAME); toast.success("Copied! ✅"); }}
                                                    className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] bg-blue-500/10 border border-blue-500/20 text-blue-500 hover:bg-blue-500/20 transition-colors shrink-0"
                                                >
                                                    <Copy className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Error banner — Figma layout_VZFFIU: pt-16 pl-16 gap-12, bg rgba(251,44,54,0.1), stroke rgba(251,44,54,0.3), text #FFC9C9 */}
                                {verifyErrors[domain] && (
                                    <div className="flex items-start gap-[12px] w-full pt-[16px] pl-[16px] pb-[16px] pr-4 rounded-[16px] border border-[rgba(251,44,54,0.3)] bg-[rgba(251,44,54,0.1)] animate-in fade-in duration-200">
                                        <AlertCircle className="h-5 w-5 text-[#FF6467] shrink-0 mt-[1px]" strokeWidth={1.67} />
                                        <span className="text-[14px] font-normal leading-[1.43em] text-[#FFC9C9] font-['Inter']">
                                            {verifyErrors[domain]}
                                        </span>
                                    </div>
                                )}

                                {/* Action buttons — Figma layout_03IVFF: column, gap 12px, both buttons w-full 50px */}
                                <div className="flex flex-col sm:flex-row w-full gap-[12px]">
                                    <button
                                        type="button"
                                        onClick={() => handleVerify(domain)}
                                        disabled={isPending}
                                        className="w-full sm:flex-1 flex items-center justify-center h-[50px] rounded-[16px] bg-gradient-to-r from-blue-500 to-teal-400 hover:opacity-90 text-white text-[16px] font-semibold font-['Inter'] transition-opacity gap-[8px] shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] disabled:opacity-50 border-none"
                                    >
                                        {isPending ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <Check className="h-5 w-5" strokeWidth={2.5} />
                                        )}
                                        {isPending ? "Verifying..." : "Verify Connection"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(domain)}
                                        disabled={isPending}
                                        className="w-full sm:w-[112px] flex items-center justify-center h-[50px] rounded-[16px] border border-[rgba(251,44,54,0.3)] bg-transparent text-[#FF6467] hover:bg-[rgba(251,44,54,0.08)] text-[16px] font-semibold font-['Inter'] transition-colors disabled:opacity-50"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    if (status === 'active') {
                        const isPrimary = domainObj.isPrimary;
                        return (
                            // Active domain card: mobile shows domain+badges only; desktop shows action buttons
                            <div key={domain} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-[25px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 transition-colors gap-[16px] animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-[18px] font-semibold text-slate-50">{domain}</h3>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {/* Connected badge */}
                                        <div className="flex h-[34px] w-fit items-center justify-center gap-[6px] rounded-[12px] border border-[#00C950]/30 bg-[#00C950]/10 pl-[12px] pr-[16px]">
                                            <Check className="h-4 w-4 text-[#05DF72]" strokeWidth={2.5} />
                                            <span className="text-[14px] font-medium leading-none text-[#B9F8CF]">Connected & Secured</span>
                                        </div>
                                        {/* Primary badge — Figma: rgba(139,92,246,0.2) bg, rgba(139,92,246,0.3) border, #C4B5FD text */}
                                        {isPrimary && (
                                            <div className="flex items-center justify-center h-[26px] px-3 rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.2)]">
                                                <span className="text-[12px] font-semibold text-[#C4B5FD]">Current Primary Domain</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Desktop actions: Set as Primary (if not primary) + Remove */}
                                <div className="hidden sm:flex items-center gap-3">
                                    {!isPrimary && (
                                        <button
                                            type="button"
                                            onClick={() => handleSetPrimary(domain)}
                                            disabled={isPending}
                                            className="flex items-center justify-center h-[44px] px-[16px] rounded-[12px] border border-purple-500/30 bg-purple-500/10 text-[#C4B5FD] hover:bg-purple-500/20 text-[14px] font-semibold transition-colors font-['Inter'] disabled:opacity-50 whitespace-nowrap"
                                        >
                                            Set as Primary
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(domain)}
                                        disabled={isPending || isPrimary === true}
                                        className="flex items-center justify-center h-[44px] px-[16px] rounded-[12px] border border-[#FB2C36]/30 bg-transparent text-[#FF6467] hover:bg-[#FB2C36]/10 text-[14px] font-semibold transition-colors font-['Inter'] disabled:opacity-50"
                                        title={isPrimary ? 'Cannot remove the primary domain' : 'Remove domain'}
                                    >
                                        Remove Domain
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    return null;
                })}

            </div>

            {/* Modal Overlay */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B1120]/80 p-4 animate-in fade-in duration-200">
                    <div
                        className="flex flex-col w-[448px] max-w-full p-[25px] rounded-[16px] bg-[#1E293B] border border-white/[0.08] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] relative animate-in zoom-in-95 duration-200 gap-[24px]"
                    >

                        {/* Title & Note */}
                        <div className="flex flex-col gap-[8px]">
                            <h3 className="m-0 text-[20px] font-semibold text-[#F8FAFC] leading-[1.4em] font-['Inter']">
                                Enter the domain name you own
                            </h3>
                            <p className="m-0 text-[14px] font-bold text-[rgba(248,250,252,0.6)] leading-[1.42857em] font-['Inter']">
                                Note: Make sure you have access to your registrar
                            </p>
                        </div>

                        {/* Input */}
                        <div className="w-[398px] max-w-full">
                            <input
                                type="text"
                                value={newDomainInput}
                                onChange={(e) => setNewDomainInput(e.target.value.replace(/https?:\/\//i, ''))} // Auto-strip http
                                onKeyDown={(e) => e.key === 'Enter' && !isPending && handleAddDomain()}
                                placeholder="example.com"
                                autoFocus
                                className="w-[398px] max-w-full h-[50px] px-[16px] py-[12px] rounded-[16px] bg-[#0B1120] border border-white/[0.08] text-[16px] font-normal text-[#F8FAFC] placeholder:text-[rgba(248,250,252,0.4)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-['Inter']"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center justify-between gap-[12px] w-[398px] max-w-full h-[50px]">
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 flex items-center justify-center h-[50px] rounded-[16px] border border-white/[0.08] bg-transparent text-[#F8FAFC] text-[16px] font-medium hover:bg-white/5 transition-colors font-['Inter']"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddDomain}
                                disabled={isPending}
                                style={{ background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.5) 0%, rgba(45, 212, 191, 0.5) 100%)' }}
                                className="flex-1 flex items-center justify-center h-[50px] rounded-[16px] border-none text-white text-[16px] font-semibold hover:opacity-90 transition-opacity shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] font-['Inter'] disabled:opacity-50"
                            >
                                {isPending && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                                Add Domain
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
