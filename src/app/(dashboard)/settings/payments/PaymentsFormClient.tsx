"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { CreditCard, Banknote, Landmark, QrCode, UploadCloud, Trash2, Info, Shield, AlertTriangle, MapPin, User, CheckCircle2, ExternalLink, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getPaymentSettings, updatePaymentSettings, uploadQrMedia, disconnectStripe } from './actions';
import { useI18n } from '@/i18n';
import { StripeConnectBlock } from './StripeConnectBlock';
import { StripeConnectedBar } from './StripeConnectedBar';
import { PaymentMethodCard } from './PaymentMethodCard';

type Media = { id: string | number; url?: string; thumbnailURL?: string };

function getImageUrl(image: Media | string | null): string | null {
    if (!image || typeof image === 'string') return null;
    let url = image.url || image.thumbnailURL || null;
    if (!url) return null;
    if (url.includes('/api/media/file/') || url.includes('minio:') || url.includes('localhost:9000')) {
        if (process.env.NEXT_PUBLIC_S3_ENDPOINT) {
            const filename = url.split('/').pop();
            if (!filename) return null;
            url = `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/primeweb-media/${filename}`;
        }
    }
    // minio hostname is not browser-resolvable; map to localhost for local dev
    if (process.env.NODE_ENV === 'development' && url.includes('minio:')) {
        url = url.replace(/minio:\d+/, 'localhost:9000');
    }
    return url;
}

function isLocalOrBlob(urlStr: string | null): boolean {
    if (!urlStr) return false;
    if (urlStr.startsWith('blob:')) return true;
    try {
        const u = new URL(urlStr);
        return process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(u.hostname);
    } catch { return false; }
}

const FPX_BANKS = [
    'Maybank2u', 'CIMB Clicks', 'Public Bank', 'RHB', 'Hong Leong',
    'AmBank', 'Bank Islam', 'OCBC', 'HSBC', 'Standard Chartered',
    'BSN', 'Affin Bank', 'Alliance', 'Bank Rakyat', 'UOB',
];

export function PaymentsFormClient({
    tenantId,
    stripeOnboardingComplete = false,
    stripeAccountId = null,
    initialCardEnabled = false,
    initialFpxEnabled = false,
}: {
    tenantId?: string;
    stripeOnboardingComplete?: boolean;
    stripeAccountId?: string | null;
    initialCardEnabled?: boolean;
    initialFpxEnabled?: boolean;
}) {
    const router = useRouter();
    const [paymentCod, setPaymentCod] = useState(false);
    const [paymentQr, setPaymentQr] = useState(false);
    const [cardEnabled, setCardEnabled] = useState(initialCardEnabled);
    const [fpxEnabled, setFpxEnabled] = useState(initialFpxEnabled);
    const [qrWidgetExpanded, setQrWidgetExpanded] = useState(false);
    const [qrImageId, setQrImageId] = useState<string | number | null>(null);
    const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
    const [qrFileName, setQrFileName] = useState<string | null>(null);
    const [accountHolderName, setAccountHolderName] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    // Stripe Connect states
    const [isVerified, setIsVerified] = useState(!!stripeAccountId); // account connected
    const [isChargesEnabled, setIsChargesEnabled] = useState(stripeOnboardingComplete); // KYC complete
    const [hasAccount, setHasAccount] = useState(!!stripeAccountId);
    const [currentAccountId, setCurrentAccountId] = useState(stripeAccountId);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;

    useEffect(() => {
        if (!tenantId) { setIsLoading(false); return; }
        getPaymentSettings()
            .then(res => {
                if (res.success && res.payments) {
                    const d = res.payments;
                    setPaymentCod(d.payment_cod || false);
                    setPaymentQr(d.payment_qr || false);
                    if (d.qr_image) {
                        const img = d.qr_image;
                        setQrImageId(typeof img === 'string' ? img : img.id);
                        setQrPreviewUrl(getImageUrl(img as Media));
                        if (typeof img === 'object' && (img as any).filename) {
                            setQrFileName((img as any).filename);
                        }
                    }
                    if (d.account_holder_name) setAccountHolderName(d.account_holder_name as string);
                    if (d.bank_name) setBankName(d.bank_name as string);
                    if (d.account_number) setAccountNumber(d.account_number as string);
                }
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [tenantId]);

    // Handle ?stripe=complete or ?stripe=refresh return from Stripe onboarding (TC-F13.26, 27, 28)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const stripeReturn = params.get('stripe');
        if (!stripeReturn) return;

        if (stripeReturn === 'verified') {
            setHasAccount(true);
            // Confirm with server before unlocking card/fpx toggles — URL param is not trusted
            if (tenantId) {
                fetch(`/api/stripe/connect/status?tenantId=${tenantId}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data.success && data.data.onboardingComplete) {
                            setIsVerified(true);
                            setIsChargesEnabled(true);
                            toast.success(pt.stripeReturnSuccess);
                        } else {
                            toast.info(pt.stripeReturnKycPending);
                        }
                    })
                    .catch(() => toast.warning(pt.stripeReturnRefresh));
            }
        } else if (stripeReturn === 'complete') {
            setHasAccount(true); // ensure Verify button is shown
            if (isChargesEnabled) {
                toast.success(pt.stripeReturnSuccess);
            } else {
                toast.info(pt.stripeReturnKycPending);
            }
        } else if (stripeReturn === 'refresh') {
            if (stripeAccountId) setHasAccount(true); // only restore if they had an account before redirect
            toast.warning(pt.stripeReturnRefresh);
        }

        router.replace('/settings/payments');
    }, []); // intentionally once on mount

    // Redirect to Stripe OAuth onboarding (TC-F13.24)
    const handleConnectStripe = async () => {
        if (!tenantId || isConnecting) return;
        setIsConnecting(true);
        try {
            const res = await fetch('/api/stripe/connect/onboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId }),
            });
            const data = await res.json();
            if (data.success && data.data?.oauthUrl) {
                window.location.href = data.data.oauthUrl;
            } else {
                toast.error(pt.failSaveSettings);
            }
        } catch {
            toast.error(pt.failSaveSettings);
        } finally {
            setIsConnecting(false);
        }
    };

    // Check Stripe account status and unlock UI if approved (TC-F13.26)
    const handleVerifyStripe = async () => {
        if (!tenantId || isVerifying) return;
        setIsVerifying(true);
        try {
            const res = await fetch(`/api/stripe/connect/status?tenantId=${tenantId}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(pt.failVerifyStripe);
                return;
            }
            if (data.data.connected) {
                setIsVerified(true);
                if (data.data.accountId) setCurrentAccountId(data.data.accountId);
            }
            if (data.data.onboardingComplete) {
                setIsChargesEnabled(true);
                toast.success(pt.stripeReturnSuccess);
            } else {
                toast.warning(pt.stripeVerifyPending);
            }
        } catch {
            toast.error(pt.failVerifyStripe);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleToggleCard = (checked: boolean) => {
        setCardEnabled(checked);
        setIsDirty(true);
    };

    const handleToggleFpx = (checked: boolean) => {
        setFpxEnabled(checked);
        setIsDirty(true);
    };

    const handleToggleCod = (checked: boolean) => {
        setPaymentCod(checked);
        setIsDirty(true);
    };

    const handleToggleQr = (checked: boolean) => {
        if (checked && !qrImageId && !qrPreviewUrl) { setQrWidgetExpanded(true); return; }
        setPaymentQr(checked);
        if (!checked) setQrWidgetExpanded(false);
        setIsDirty(true);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast.error(t.payments.imageTooLarge); return; }
        const objectUrl = URL.createObjectURL(file);
        setQrPreviewUrl(objectUrl);
        setQrFileName(file.name);
        toast.loading(pt.uploadingQr, { id: 'upload-qr' });
        try {
            const fd = new FormData();
            fd.append('file', file);
            const uploadRes = await uploadQrMedia(fd);
            if (!uploadRes.success || !uploadRes.doc) throw new Error(uploadRes.error || 'Upload failed');
            const qrDocId = uploadRes.doc.id;
            setQrImageId(qrDocId);
            const serverUrl = getImageUrl(uploadRes.doc as Media);
            if (serverUrl) setQrPreviewUrl(serverUrl);
            setPaymentQr(true);
            setIsDirty(true);
            toast.dismiss('upload-qr');
            toast.success(pt.uploadingQr);
        } catch (e: unknown) {
            toast.dismiss('upload-qr');
            toast.error(pt.uploadError + (e instanceof Error ? e.message : 'Upload failed'));
            setQrPreviewUrl(null);
            setPaymentQr(false);
        }
    };

    const handleRemoveImage = () => {
        setQrImageId(null); setQrPreviewUrl(null); setQrFileName(null); setPaymentQr(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsDirty(true);
    };

    const handleAccountHolderNameChange = useCallback((val: string) => {
        setAccountHolderName(val);
        setIsDirty(true);
    }, []);

    const handleBankNameChange = useCallback((val: string) => {
        setBankName(val);
        setIsDirty(true);
    }, []);

    const handleAccountNumberChange = useCallback((val: string) => {
        setAccountNumber(val);
        setIsDirty(true);
    }, []);

    const handleSaveAll = async () => {
        if (!isDirty || isSavingAll) return;
        // Client-side guard: card/fpx cannot be enabled without completed Stripe onboarding
        if ((cardEnabled || fpxEnabled) && !isChargesEnabled) {
            setCardEnabled(false);
            setFpxEnabled(false);
            toast.error(pt.failVerifyStripe);
            return;
        }
        setIsSavingAll(true);
        try {
            const res = await updatePaymentSettings({
                payment_cod: paymentCod,
                payment_qr: paymentQr,
                payment_card: cardEnabled,
                payment_fpx: fpxEnabled,
                qr_image: qrImageId,
                account_holder_name: accountHolderName || null,
                bank_name: bankName || null,
                account_number: accountNumber || null,
            });
            if (res.success) {
                setIsDirty(false);
                toast.success(pt.successSave);
            } else {
                toast.error(pt.failSaveSettings);
            }
        } catch {
            toast.error(pt.failSaveSettings);
        } finally {
            setIsSavingAll(false);
        }
    };

    if (isLoading) return <div className="p-8 text-white">{pt.loading}</div>;

    return (
        <div className="w-full space-y-[32px]">
            {/* Page header */}
            <div className="flex items-center gap-4">
                <div className="w-[46px] h-[46px] flex items-center justify-center rounded-[12px] bg-sky-500/[0.12] border border-sky-500/[0.20] shrink-0">
                    <CreditCard className="w-[22px] h-[22px] text-sky-400" />
                </div>
                <div>
                    <h1 className="text-[28px] font-bold text-slate-50 tracking-[-0.015em]">{pt.title}</h1>
                    <p className="mt-[4px] text-[14px] text-slate-400">{pt.subtitle}</p>
                </div>
            </div>

            {isChargesEnabled && isVerified && !cardEnabled && !fpxEnabled && (
                <div className="flex items-start gap-[14px] p-[18px_20px] rounded-[14px] border border-amber-500/[0.24] bg-amber-500/[0.06]">
                    <div className="w-10 h-10 rounded-[10px] bg-amber-500/[0.12] border border-amber-500/[0.22] text-amber-400 grid place-items-center shrink-0">
                        <AlertTriangle className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                        <h4 className="text-[14px] font-semibold text-slate-100 m-0 mb-[3px]">No card payment methods active</h4>
                        <p className="text-[13px] text-slate-400 m-0 leading-[1.55]">
                            Your storefront is live, but Card and FPX are both off. Buyers can only pay by COD or bank transfer. Enable at least one Stripe method for the smoothest checkout.
                        </p>
                    </div>
                </div>
            )}

            <section className="space-y-[14px]">
                <div className="flex items-center gap-[10px] px-[4px] mt-[2px]">
                    <span className="w-[6px] h-[6px] rounded-full bg-sky-400 shrink-0" style={{ boxShadow: '0 0 10px #38bdf8' }} />
                    <h2 className="text-[13px] font-bold text-slate-300 uppercase tracking-[0.06em] m-0">{pt.stripeSectionTitle}</h2>
                    <span className="ml-auto text-[12px] text-slate-500">{pt.stripeSectionDesc}</span>
                </div>

                {isVerified && isChargesEnabled ? (
                    <StripeConnectedBar accountId={currentAccountId} onDisconnect={async () => {
                        const res = await disconnectStripe();
                        if (res.success) {
                            setIsVerified(false);
                            setIsChargesEnabled(false);
                            setHasAccount(false);
                            setCardEnabled(false);
                            setFpxEnabled(false);
                        } else {
                            toast.error('Failed to disconnect Stripe');
                        }
                    }} />
                ) : (isVerified && !isChargesEnabled) || hasAccount ? (
                    // Connected but KYC/onboarding not yet confirmed — must verify before enabling Card/FPX
                    <StripeConnectBlock
                        mode="verify"
                        onVerify={handleVerifyStripe}
                        isVerifying={isVerifying}
                    />
                ) : (
                    <StripeConnectBlock
                        mode="connect"
                        onConnect={handleConnectStripe}
                        isConnecting={isConnecting}
                    />
                )}

                {isVerified && isChargesEnabled && (
                    <div className="space-y-[12px]">
                        <div className="anim-pay-card-d1">
                            <PaymentMethodCard
                                icon={<CreditCard className="w-[22px] h-[22px]" />}
                                iconTone="brand"
                                title={pt.cardTitle}
                                feePill={pt.cardFee}
                                desc={pt.cardDesc}
                                on={cardEnabled}
                                onChange={handleToggleCard}
                                highlight={cardEnabled}
                                statusExtra={<span>{pt.cardMeta}</span>}
                            />
                        </div>
                        <div className="anim-pay-card-d2">
                            <PaymentMethodCard
                                icon={<Landmark className="w-[22px] h-[22px]" />}
                                iconTone="purple"
                                title={pt.fpxTitle}
                                feePill={pt.fpxFee}
                                desc={pt.fpxDesc}
                                on={fpxEnabled}
                                onChange={handleToggleFpx}
                                highlight={fpxEnabled}
                                statusExtra={<span>{pt.fpxMeta}</span>}
                            >
                                {fpxEnabled && (
                                    <div className="flex flex-wrap gap-[6px] mt-[14px]">
                                        {FPX_BANKS.slice(0, 10).map(b => (
                                            <span key={b} className="text-[11.5px] px-[9px] py-[4px] rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400">
                                                {b}
                                            </span>
                                        ))}
                                        {FPX_BANKS.length > 10 && (
                                            <span className="text-[11.5px] px-[9px] py-[4px] rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400">
                                                +{FPX_BANKS.length - 10} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </PaymentMethodCard>
                        </div>
                    </div>
                )}
            </section>

            {/* ─── Manual Methods ─── */}
            <section className="space-y-[14px]">
                <div className="flex items-center gap-[10px] px-[4px]">
                    <span className="w-[6px] h-[6px] rounded-full bg-purple-400 shrink-0" style={{ boxShadow: '0 0 10px #c084fc' }} />
                    <h2 className="text-[13px] font-bold text-slate-300 uppercase tracking-[0.06em] m-0">{pt.manualSectionTitle}</h2>
                    <span className="ml-auto text-[12px] text-slate-500">{pt.manualSectionDesc}</span>
                </div>

                <div className="space-y-[12px]">
                    <PaymentMethodCard
                        icon={<Banknote className="w-[22px] h-[22px]" />}
                        iconTone="amber"
                        title={pt.codTitle}
                        desc={pt.codDesc}
                        on={paymentCod}
                        onChange={handleToggleCod}
                        highlight={paymentCod}
                        statusExtra={paymentCod ? (
                            <span className="inline-flex items-center gap-[5px] text-[12px] text-slate-500">
                                <MapPin className="w-3 h-3" />
                                {pt.codStatusMeta}
                            </span>
                        ) : undefined}
                    />

                    <PaymentMethodCard
                        icon={<QrCode className="w-[22px] h-[22px]" />}
                        iconTone="teal"
                        title={pt.bankTransferTitle}
                        desc={pt.bankTransferDesc}
                        on={paymentQr}
                        onChange={handleToggleQr}
                        highlight={paymentQr}
                    >
                        {(paymentQr || qrWidgetExpanded) && (
                            <div className="mt-[18px] pt-[18px]" style={{ borderTop: '1px dashed var(--dash-border)' }}>
                                <label className="block text-[13px] font-semibold text-slate-300 mb-[10px]">{pt.qrCodeLabel}</label>

                                {qrPreviewUrl ? (
                                    <div className="flex items-center gap-[16px] p-[14px] rounded-[12px] border border-white/[0.08] bg-[#0d1525]">
                                        {/* QR thumb */}
                                        <div className="w-[76px] h-[76px] rounded-[10px] shrink-0 overflow-hidden border-[4px] border-white bg-white">
                                            <NextImage
                                                src={qrPreviewUrl}
                                                alt="QR Code"
                                                width={76}
                                                height={76}
                                                unoptimized={isLocalOrBlob(qrPreviewUrl)}
                                                className="object-cover w-full h-full"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15px] font-bold text-slate-50 m-0 mb-[4px] truncate tracking-tight">
                                                {qrFileName || 'duitnow-qr.png'}
                                            </p>
                                            <p className="font-mono text-[12px] text-slate-400 m-0">{pt.qrUploadedMeta}</p>
                                        </div>
                                        <div className="flex gap-[6px] shrink-0">
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-[8px] text-slate-400 border border-white/[0.08] hover:bg-red-500/[0.12] hover:text-red-400 hover:border-red-500/[0.24] transition-all"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-[14px] h-[14px]" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center text-center rounded-[12px] cursor-pointer transition-all group"
                                        style={{
                                            padding: '32px 20px',
                                            border: '1.5px dashed var(--dash-border)',
                                            background: 'transparent',
                                            borderRadius: '12px',
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(14,165,233,0.45)';
                                            (e.currentTarget as HTMLDivElement).style.background = 'rgba(14,165,233,0.04)';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--dash-border)';
                                            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                                        }}
                                    >
                                        <div className="w-[48px] h-[48px] rounded-full bg-sky-500/[0.10] text-sky-400 grid place-items-center mb-[12px]">
                                            <UploadCloud className="w-5 h-5" />
                                        </div>
                                        <p className="text-[13px] font-semibold text-slate-100 mb-[2px]">{pt.uploadQrSub}</p>
                                        <p className="text-[11.5px] text-slate-500">{pt.uploadHint}</p>
                                    </div>
                                )}

                                <input type="file" accept="image/png, image/jpeg" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

                                {/* Account holder name */}
                                <div className="flex flex-col gap-[6px] mt-[16px]">
                                    <label className="flex items-center text-[13px] font-semibold text-slate-300">
                                        {pt.accountHolderNameLabel}
                                        <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] px-[7px] py-[2px] rounded-full bg-white/[0.04] border border-white/[0.08]">Required</span>
                                    </label>
                                    <div
                                        className="flex items-center rounded-[10px] overflow-hidden transition-all"
                                        style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                                        onFocusCapture={e => (e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)', e.currentTarget.style.borderColor = '#0ea5e9')}
                                        onBlurCapture={e => (e.currentTarget.style.boxShadow = '', e.currentTarget.style.borderColor = 'var(--dash-border)')}
                                    >
                                        <div className="px-[12px] h-[40px] grid place-items-center shrink-0" style={{ borderRight: '1px solid var(--dash-border)' }}>
                                            <User className="w-[14px] h-[14px] text-slate-400 opacity-70" />
                                        </div>
                                        <input
                                            type="text"
                                            value={accountHolderName}
                                            onChange={e => handleAccountHolderNameChange(e.target.value)}
                                            placeholder={pt.accountHolderNamePlaceholder}
                                            className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-medium placeholder:text-slate-600 min-w-0"
                                        />
                                    </div>
                                    <div className="flex items-center gap-[6px] text-[12px] text-slate-500">
                                        <Info className="w-[12px] h-[12px]" />
                                        <span>{pt.accountHolderNameHelper}</span>
                                    </div>
                                </div>

                                {/* Bank name + Account number */}
                                <div className="grid grid-cols-2 gap-[16px] mt-[16px]">
                                    <div className="flex flex-col gap-[6px]">
                                        <label className="text-[13px] font-semibold text-slate-300">{pt.bankNameLabel}</label>
                                        <div
                                            className="flex items-center rounded-[10px] overflow-hidden transition-all"
                                            style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                                            onFocusCapture={e => (e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)', e.currentTarget.style.borderColor = '#0ea5e9')}
                                            onBlurCapture={e => (e.currentTarget.style.boxShadow = '', e.currentTarget.style.borderColor = 'var(--dash-border)')}
                                        >
                                            <input
                                                type="text"
                                                value={bankName}
                                                onChange={e => handleBankNameChange(e.target.value)}
                                                placeholder="e.g. Maybank Berhad"
                                                className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-mono font-medium placeholder:text-slate-600"
                                            />
                                        </div>
                                        <div className="flex items-center gap-[6px] text-[12px] text-slate-500">
                                            <Info className="w-[12px] h-[12px]" />
                                            <span>{pt.bankNameHelper}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-[6px]">
                                        <label className="text-[13px] font-semibold text-slate-300">{pt.accountNumberLabel}</label>
                                        <div
                                            className="flex items-center rounded-[10px] overflow-hidden transition-all"
                                            style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                                            onFocusCapture={e => (e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)', e.currentTarget.style.borderColor = '#0ea5e9')}
                                            onBlurCapture={e => (e.currentTarget.style.boxShadow = '', e.currentTarget.style.borderColor = 'var(--dash-border)')}
                                        >
                                            <div className="px-[12px] h-[40px] grid place-items-center font-mono text-[13px] text-slate-400 font-medium shrink-0" style={{ borderRight: '1px solid var(--dash-border)' }}>
                                                MYR
                                            </div>
                                            <input
                                                type="text"
                                                value={accountNumber}
                                                onChange={e => handleAccountNumberChange(e.target.value)}
                                                placeholder="5141 2287 ••••"
                                                className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-mono font-medium placeholder:text-slate-600 min-w-0"
                                            />
                                        </div>
                                        <div className="flex items-center gap-[6px] text-[12px] text-slate-500">
                                            <Shield className="w-[12px] h-[12px]" />
                                            <span>{pt.accountNumberHelper}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </PaymentMethodCard>
                </div>
            </section>

            {/* Save bar */}
            <div
                className="sticky bottom-4 flex items-center justify-between px-[18px] py-[12px] rounded-[14px] border border-white/[0.08] mt-6"
                style={{ background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(12px)', boxShadow: '0 20px 30px -10px rgba(0,0,0,0.6)' }}
            >
                <div className="flex items-center gap-2 text-[13px]">
                    {isDirty ? (
                        <>
                            <AlertCircle className="w-[14px] h-[14px] text-amber-400 shrink-0" />
                            <span className="text-amber-300 font-medium">Unsaved changes</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-[14px] h-[14px] text-emerald-400 shrink-0" />
                            <span className="text-slate-400">{pt.savesAutomatic}</span>
                        </>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center gap-[6px] h-[34px] px-[12px] rounded-[8px] text-[13px] font-semibold text-slate-300 border border-white/[0.08] hover:bg-white/[0.04] hover:text-slate-50 hover:border-white/[0.18] transition-all"
                        onClick={() => toast.info(pt.infoDesc)}
                    >
                        <ExternalLink className="w-[13px] h-[13px]" />
                        {pt.previewCheckout}
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveAll}
                        disabled={!isDirty || isSavingAll}
                        className="inline-flex items-center gap-[6px] h-[34px] px-[14px] rounded-[8px] text-[13px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                        style={{
                            background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
                            boxShadow: isDirty ? '0 6px 18px rgba(37,99,235,0.35)' : 'none',
                        }}
                    >
                        <Save className="w-[13px] h-[13px]" />
                        {isSavingAll ? pt.saving : pt.saveChanges}
                    </button>
                </div>
            </div>

        </div>
    );
}
