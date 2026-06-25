"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { CreditCard, Banknote, Landmark, QrCode, UploadCloud, Trash2, Info, Shield, AlertTriangle, MapPin, User, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getPaymentSettings, updatePaymentSettings, uploadQrMedia, disconnectStripe, saveXenditKeys, disconnectXendit } from './actions';
import { useI18n } from '@/i18n';
import { resolveApiError } from '@/lib/ui/resolve-api-error';
import { StripeConnectBlock } from './StripeConnectBlock';
import { StripeConnectedBar } from './StripeConnectedBar';
import { XenditConnectBlock } from './XenditConnectBlock';
import { XenditConnectedBar } from './XenditConnectedBar';
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
    // Model C: xenditConnected = xenditSecretKey is set in DB
    xenditConnected = false,
}: {
    tenantId?: string;
    stripeOnboardingComplete?: boolean;
    stripeAccountId?: string | null;
    initialCardEnabled?: boolean;
    initialFpxEnabled?: boolean;
    xenditConnected?: boolean;
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
    const [isOnboarding, setIsOnboarding] = useState(false);
    const [detailsSubmitted, setDetailsSubmitted] = useState(false);
    // Xendit Connect states (Model C)
    const [xenditIsConnected, setXenditIsConnected] = useState(xenditConnected ?? false);
    const [isDirty, setIsDirty] = useState(false);
    const [showAllBanks, setShowAllBanks] = useState(false);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bankTransferFormRef = useRef<HTMLDivElement>(null);
    const firstBankInputRef = useRef<HTMLInputElement>(null);
    // Guard: only scroll when user-triggered (not on initial data load)
    const bankFormUserTriggeredRef = useRef(false);
    // Holds the setInterval ID while polling Stripe status after opening the connect new tab
    const stripePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [bankTransferErrors, setBankTransferErrors] = useState<{ accountHolderName?: string; accountNumber?: string }>({});
    const [serverPaymentValues, setServerPaymentValues] = useState<{
        paymentCod: boolean; paymentQr: boolean; cardEnabled: boolean; fpxEnabled: boolean;
        qrImageId: string | number | null; qrPreviewUrl: string | null; qrFileName: string | null;
        accountHolderName: string; bankName: string; accountNumber: string;
    } | null>(null);
    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;
    const sub = t.common.subscriptionErrors;

    const stopStripePolling = () => {
        if (stripePollingRef.current) {
            clearInterval(stripePollingRef.current)
            stripePollingRef.current = null
        }
    }

    // Poll /api/stripe/connect/status after opening a new tab — catches the case where
    // BroadcastChannel doesn't fire (tab closed before redirect, or unsupported browser).
    // mode='connect': stops when account is first connected (OAuth complete).
    // mode='onboard': stops only when onboardingComplete=true (KYC done) — avoids premature
    //   toast when account is already connected but KYC is still in progress.
    const startStripePolling = (mode: 'connect' | 'onboard') => {
        if (!tenantId || stripePollingRef.current) return
        stripePollingRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/stripe/connect/status?tenantId=${tenantId}`)
                const data = await res.json()
                if (!data.success) return
                if (mode === 'connect' && data.data.connected) {
                    setHasAccount(true)
                    if (data.data.accountId) setCurrentAccountId(data.data.accountId)
                    stopStripePolling()
                } else if (mode === 'onboard' && data.data.onboardingComplete) {
                    setHasAccount(true)
                    setIsVerified(true)
                    setIsChargesEnabled(true)
                    if (data.data.accountId) setCurrentAccountId(data.data.accountId)
                    toast.success(pt.stripeReturnSuccess)
                    stopStripePolling()
                }
            } catch { /* best-effort — silent on network error */ }
        }, 5000)
    }

    useEffect(() => {
        if (!tenantId) { setIsLoading(false); return; }
        getPaymentSettings()
            .then(res => {
                const d = res.success && res.payments ? res.payments : {};
                const cod = d.payment_cod || false;
                const qr = d.payment_qr || false;
                let imgId: string | number | null = null;
                let imgUrl: string | null = null;
                let imgName: string | null = null;
                if (d.qr_image) {
                    const img = d.qr_image;
                    imgId = typeof img === 'string' ? img : img.id;
                    imgUrl = getImageUrl(img as Media);
                    if (typeof img === 'object' && (img as any).filename) imgName = (img as any).filename;
                }
                const holderName = (d.account_holder_name as string) || '';
                const bank = (d.bank_name as string) || '';
                const acctNum = (d.account_number as string) || '';

                setPaymentCod(cod);
                setPaymentQr(qr);
                if (imgId) setQrImageId(imgId);
                if (imgUrl) setQrPreviewUrl(imgUrl);
                if (imgName) setQrFileName(imgName);
                if (holderName) setAccountHolderName(holderName);
                if (bank) setBankName(bank);
                if (acctNum) setAccountNumber(acctNum);

                // Capture server snapshot for Cancel; card/fpx come from props (not server action)
                setServerPaymentValues({
                    paymentCod: cod, paymentQr: qr,
                    cardEnabled: initialCardEnabled, fpxEnabled: initialFpxEnabled,
                    qrImageId: imgId, qrPreviewUrl: imgUrl, qrFileName: imgName,
                    accountHolderName: holderName, bankName: bank, accountNumber: acctNum,
                });
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [tenantId]);

    // Handle ?stripe=complete or ?stripe=refresh return from Stripe onboarding (TC-F13.26, 27, 28).
    // Also broadcasts result to parent tab via BroadcastChannel when this page loaded in the new tab
    // opened by handleConnectStripe / handleOnboardStripe.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const stripeReturn = params.get('stripe');
        if (!stripeReturn) return;

        // Scope channel by tenantId — prevents cross-tenant signal bleed in multi-tenant same-domain sessions
        const bcName = tenantId ? `stripe-connect-${tenantId}` : 'stripe-connect'
        const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(bcName) : null;

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
                            bc?.postMessage({ type: 'stripe-verified', onboardingComplete: true, accountId: data.data.accountId });
                        } else {
                            if (data.success && data.data.detailsSubmitted) setDetailsSubmitted(true);
                            toast.info(pt.stripeReturnKycPending);
                            bc?.postMessage({ type: 'stripe-verified', onboardingComplete: false, accountId: data.data?.accountId });
                        }
                    })
                    .catch(() => {
                        toast.warning(pt.stripeReturnRefresh);
                        bc?.postMessage({ type: 'stripe-verified', onboardingComplete: false });
                    })
                    .finally(() => {
                        bc?.close();
                        // Attempt to close the new tab — works when opened via window.open().
                        // Silently no-ops if browser blocks (user just sees a second payments tab).
                        setTimeout(() => window.close(), 300);
                    });
            } else {
                bc?.close();
            }
        } else if (stripeReturn === 'complete') {
            setHasAccount(true); // ensure Verify button is shown
            if (isChargesEnabled) {
                toast.success(pt.stripeReturnSuccess);
            } else {
                toast.info(pt.stripeReturnKycPending);
            }
            bc?.postMessage({ type: 'stripe-connected' });
            bc?.close();
            setTimeout(() => window.close(), 300);
        } else if (stripeReturn === 'refresh') {
            if (stripeAccountId) setHasAccount(true); // only restore if they had an account before redirect
            toast.warning(pt.stripeReturnRefresh);
            bc?.close();
        }

        router.replace('/settings/payments');
    }, []); // intentionally once on mount

    // Receive Stripe connect result broadcast from the new tab — fires as soon as Stripe redirects
    // back to /settings/payments?stripe=*, so the parent tab updates without waiting for polling.
    useEffect(() => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
        const bcName = tenantId ? `stripe-connect-${tenantId}` : 'stripe-connect'
        const channel = new BroadcastChannel(bcName)
        channel.addEventListener('message', (event: MessageEvent) => {
            const { type, onboardingComplete, accountId } = event.data ?? {}
            if (type === 'stripe-connected') {
                setHasAccount(true)
                if (accountId) setCurrentAccountId(accountId)
                toast.info(pt.stripeReturnKycPending)
                if (stripePollingRef.current) { clearInterval(stripePollingRef.current); stripePollingRef.current = null }
            } else if (type === 'stripe-verified') {
                setHasAccount(true)
                if (accountId) setCurrentAccountId(accountId)
                if (onboardingComplete) {
                    setIsVerified(true)
                    setIsChargesEnabled(true)
                    toast.success(pt.stripeReturnSuccess)
                } else {
                    toast.info(pt.stripeReturnKycPending)
                }
                if (stripePollingRef.current) { clearInterval(stripePollingRef.current); stripePollingRef.current = null }
            }
        })
        return () => channel.close()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup polling if component unmounts while the Stripe new tab is still open
    useEffect(() => () => { if (stripePollingRef.current) clearInterval(stripePollingRef.current) }, [])

    // Scroll bank transfer form into view when user expands it (Bug 2)
    // Use ref flag instead of isLoading — React 18 batches setPaymentQr+setIsLoading into one render,
    // so isLoading is already false when this effect fires after initial data load.
    useEffect(() => {
        if (!bankFormUserTriggeredRef.current) return;
        if (paymentQr || qrWidgetExpanded) {
            bankFormUserTriggeredRef.current = false;
            bankTransferFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const timer = setTimeout(() => firstBankInputRef.current?.focus(), 350);
            return () => clearTimeout(timer);
        }
    }, [paymentQr, qrWidgetExpanded]);

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
                window.open(data.data.oauthUrl, '_blank', 'noopener,noreferrer')
                startStripePolling('connect')
            } else {
                toast.error(resolveApiError(data, pt.failSaveSettings, sub));
            }
        } catch {
            toast.error(pt.failSaveSettings);
        } finally {
            setIsConnecting(false);
        }
    };

    // Redirect to Stripe Account Link to complete business onboarding (KYC, bank account)
    const handleOnboardStripe = async () => {
        if (!tenantId || isOnboarding) return;
        setIsOnboarding(true);
        try {
            const res = await fetch('/api/stripe/connect/account-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId }),
            });
            const data = await res.json();
            if (data.success && data.data?.url) {
                window.open(data.data.url, '_blank', 'noopener,noreferrer')
                startStripePolling('onboard')
            } else {
                toast.error(resolveApiError(data, pt.failSaveSettings, sub));
            }
        } catch {
            toast.error(pt.failSaveSettings);
        } finally {
            setIsOnboarding(false);
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
                if (data.data.detailsSubmitted) setDetailsSubmitted(true);
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
        if (!checked && !paymentCod && !paymentQr && !fpxEnabled) {
            toast.error(pt.lastMethodWarning); return;
        }
        setCardEnabled(checked);
        setIsDirty(true);
    };

    const handleToggleFpx = (checked: boolean) => {
        if (!checked && !paymentCod && !paymentQr && !cardEnabled) {
            toast.error(pt.lastMethodWarning); return;
        }
        setFpxEnabled(checked);
        setIsDirty(true);
    };

    const handleToggleCod = (checked: boolean) => {
        if (!checked && !paymentQr && !cardEnabled && !fpxEnabled) {
            toast.error(pt.lastMethodWarning); return;
        }
        setPaymentCod(checked);
        setIsDirty(true);
    };

    const handleToggleQr = (checked: boolean) => {
        if (checked && !qrImageId && !qrPreviewUrl) {
            bankFormUserTriggeredRef.current = true;
            setQrWidgetExpanded(true);
            return;
        }
        if (!checked && !paymentCod && !cardEnabled && !fpxEnabled) {
            toast.error(pt.lastMethodWarning); return;
        }
        bankFormUserTriggeredRef.current = checked;
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
        if (val.trim()) setBankTransferErrors(prev => ({ ...prev, accountHolderName: undefined }));
    }, []);

    const handleBankNameChange = useCallback((val: string) => {
        setBankName(val);
        setIsDirty(true);
    }, []);

    const handleAccountNumberChange = useCallback((val: string) => {
        setAccountNumber(val);
        setIsDirty(true);
        if (val.trim()) setBankTransferErrors(prev => ({ ...prev, accountNumber: undefined }));
    }, []);

    const validateBankTransfer = (): { accountHolderName?: string; accountNumber?: string } => {
        if (!paymentQr) return {};
        const errs: { accountHolderName?: string; accountNumber?: string } = {};
        if (!accountHolderName.trim()) errs.accountHolderName = pt.errAccountHolderRequired;
        const acctTrimmed = accountNumber.trim();
        if (!acctTrimmed) {
            errs.accountNumber = pt.errAccountNumberRequired;
        } else if (!/^\d{6,}$/.test(acctTrimmed)) {
            errs.accountNumber = pt.errAccountNumberFormat;
        }
        return errs;
    };

    const handleCancel = () => {
        if (!isDirty) { setQrWidgetExpanded(false); return; }
        if (serverPaymentValues) {
            setPaymentCod(serverPaymentValues.paymentCod);
            setPaymentQr(serverPaymentValues.paymentQr);
            setCardEnabled(serverPaymentValues.cardEnabled);
            setFpxEnabled(serverPaymentValues.fpxEnabled);
            setQrImageId(serverPaymentValues.qrImageId);
            setQrPreviewUrl(serverPaymentValues.qrPreviewUrl);
            setQrFileName(serverPaymentValues.qrFileName);
            setAccountHolderName(serverPaymentValues.accountHolderName);
            setBankName(serverPaymentValues.bankName);
            setAccountNumber(serverPaymentValues.accountNumber);
            if (!serverPaymentValues.paymentQr) setQrWidgetExpanded(false);
        }
        setBankTransferErrors({});
        setIsDirty(false);
    };

    const handleXenditDisconnect = async () => {
        const res = await disconnectXendit();
        if (!res.success) { toast.error('Failed to disconnect Xendit'); return; }
        setXenditIsConnected(false);
        setIsDirty(false);
    };

    const handleSaveXenditKeys = async (secretKey: string, callbackToken: string) => {
        const res = await saveXenditKeys(secretKey, callbackToken);
        if (!res.success) {
            const errKey = res.error as keyof typeof pt;
            const msg = errKey && errKey in pt && typeof pt[errKey] === 'string'
                ? (pt[errKey] as string)
                : (res.error ?? pt.xenditValidationRequired);
            throw new Error(msg);
        }
        setXenditIsConnected(true);
        toast.success(pt.xenditConnectSuccess);
    };

    const handleSaveAll = async () => {
        if (!isDirty || isSavingAll) return;
        // Client-side guard: card/fpx cannot be enabled without completed Stripe onboarding
        if ((cardEnabled || fpxEnabled) && !isChargesEnabled) {
            setCardEnabled(false);
            setFpxEnabled(false);
            toast.error(pt.failVerifyStripe);
            return;
        }
        // Validate required bank transfer fields (Bug 3)
        const errs = validateBankTransfer();
        if (Object.keys(errs).length > 0) {
            setBankTransferErrors(errs);
            toast.error(pt.fixBankErrors);
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
                setBankTransferErrors({});
                // Update server snapshot so Cancel targets the just-saved state
                setServerPaymentValues({
                    paymentCod, paymentQr, cardEnabled, fpxEnabled,
                    qrImageId, qrPreviewUrl, qrFileName,
                    accountHolderName, bankName, accountNumber,
                });
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

            {/* P0 warning: no payment method at all — buyers can't checkout */}
            {!paymentCod && !paymentQr && !cardEnabled && !fpxEnabled && (
                <div className="flex items-start gap-[14px] p-[18px_20px] rounded-[14px] border border-red-500/[0.30] bg-red-500/[0.07]">
                    <div className="w-10 h-10 rounded-[10px] bg-red-500/[0.12] border border-red-500/[0.28] text-red-400 grid place-items-center shrink-0">
                        <AlertTriangle className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                        <h4 className="text-[14px] font-semibold text-slate-100 m-0 mb-[3px]">{pt.noMethodsWarningTitle}</h4>
                        <p className="text-[13px] text-slate-400 m-0 leading-[1.55]">{pt.noMethodsWarningDesc}</p>
                    </div>
                </div>
            )}
            {isChargesEnabled && isVerified && !cardEnabled && !fpxEnabled && (paymentCod || paymentQr) && (
                <div className="flex items-start gap-[14px] p-[18px_20px] rounded-[14px] border border-amber-500/[0.24] bg-amber-500/[0.06]">
                    <div className="w-10 h-10 rounded-[10px] bg-amber-500/[0.12] border border-amber-500/[0.22] text-amber-400 grid place-items-center shrink-0">
                        <AlertTriangle className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                        <h4 className="text-[14px] font-semibold text-slate-100 m-0 mb-[3px]">{pt.noCardMethodsTitle}</h4>
                        <p className="text-[13px] text-slate-400 m-0 leading-[1.55]">{pt.noCardMethodsDesc}</p>
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
                    <StripeConnectedBar accountId={currentAccountId} tenantId={tenantId ?? ''} onDisconnect={async () => {
                        const res = await disconnectStripe();
                        if (res.success) {
                            setIsVerified(false);
                            setIsChargesEnabled(false);
                            setHasAccount(false);
                            setDetailsSubmitted(false);
                            setCardEnabled(false);
                            setFpxEnabled(false);
                        } else {
                            toast.error('Failed to disconnect Stripe');
                        }
                    }} />
                ) : (isVerified || hasAccount) && !isChargesEnabled ? (
                    // Connected but onboarding incomplete:
                    // - detailsSubmitted=false → seller hasn't filled Stripe business form yet → show Complete Setup
                    // - detailsSubmitted=true  → submitted but Stripe still reviewing → show Verify
                    <StripeConnectBlock
                        mode={detailsSubmitted ? 'verify' : 'onboard'}
                        onOnboard={handleOnboardStripe}
                        isOnboarding={isOnboarding}
                        onVerify={handleVerifyStripe}
                        isVerifying={isVerifying}
                        connectedAccountId={currentAccountId}
                        tenantId={tenantId ?? ''}
                        onDisconnect={async () => {
                            const res = await disconnectStripe();
                            if (res.success) {
                                setIsVerified(false);
                                setIsChargesEnabled(false);
                                setHasAccount(false);
                                setDetailsSubmitted(false);
                                setCardEnabled(false);
                                setFpxEnabled(false);
                            } else {
                                toast.error('Failed to disconnect Stripe');
                            }
                        }}
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
                                        {(showAllBanks ? FPX_BANKS : FPX_BANKS.slice(0, 10)).map(b => (
                                            <span key={b} className="text-[11.5px] px-[9px] py-[4px] rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400">
                                                {b}
                                            </span>
                                        ))}
                                        {FPX_BANKS.length > 10 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllBanks(v => !v)}
                                                className="text-[11.5px] px-[9px] py-[4px] rounded-full bg-white/[0.04] border border-white/[0.08] text-sky-400 hover:bg-sky-500/[0.12] hover:border-sky-500/[0.24] transition-all cursor-pointer"
                                            >
                                                {showAllBanks ? '−' : `+${FPX_BANKS.length - 10}`} {showAllBanks ? 'Show less' : 'more'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </PaymentMethodCard>
                        </div>
                    </div>
                )}
            </section>

            {/* ─── Xendit (F34) ─── */}
            <section className="space-y-[14px]">
                <div className="flex items-center gap-[10px] px-[4px] mt-[2px]">
                    <span className="w-[6px] h-[6px] rounded-full bg-cyan-400 shrink-0" style={{ boxShadow: '0 0 10px #22d3ee' }} />
                    <h2 className="text-[13px] font-bold text-slate-300 uppercase tracking-[0.06em] m-0">
                        {pt.xenditSectionTitle}
                    </h2>
                    <span className="ml-auto text-[12px] text-slate-500">{pt.xenditPoweredBy}</span>
                </div>

                {xenditIsConnected ? (
                    <XenditConnectedBar
                        accountId={null}
                        tenantId={tenantId ?? ''}
                        onDisconnect={handleXenditDisconnect}
                    />
                ) : (
                    <XenditConnectBlock
                        tenantId={tenantId}
                        onSaveKeys={handleSaveXenditKeys}
                    />
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
                            <div ref={bankTransferFormRef} className="mt-[18px] pt-[18px]" style={{ borderTop: '1px dashed var(--dash-border)' }}>
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
                                        <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] px-[7px] py-[2px] rounded-full bg-white/[0.04] border border-white/[0.08]">{pt.required}</span>
                                    </label>
                                    <div
                                        className="flex items-center rounded-[10px] overflow-hidden transition-all"
                                        style={{ background: 'var(--dash-surface)', border: `1px solid ${bankTransferErrors.accountHolderName ? '#ef4444' : 'var(--dash-border)'}` }}
                                        onFocusCapture={e => !bankTransferErrors.accountHolderName && (e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)', e.currentTarget.style.borderColor = '#0ea5e9')}
                                        onBlurCapture={e => (e.currentTarget.style.boxShadow = '', e.currentTarget.style.borderColor = bankTransferErrors.accountHolderName ? '#ef4444' : 'var(--dash-border)')}
                                    >
                                        <div className="px-[12px] h-[40px] grid place-items-center shrink-0" style={{ borderRight: '1px solid var(--dash-border)' }}>
                                            <User className="w-[14px] h-[14px] text-dash-text-muted" />
                                        </div>
                                        <input
                                            ref={firstBankInputRef}
                                            type="text"
                                            value={accountHolderName}
                                            onChange={e => handleAccountHolderNameChange(e.target.value)}
                                            placeholder={pt.accountHolderNamePlaceholder}
                                            className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600 min-w-0"
                                        />
                                    </div>
                                    {bankTransferErrors.accountHolderName ? (
                                        <p className="text-[12px] text-red-400">{bankTransferErrors.accountHolderName}</p>
                                    ) : (
                                        <div className="flex items-center gap-[6px] text-[12px] text-slate-500">
                                            <Info className="w-[12px] h-[12px]" />
                                            <span>{pt.accountHolderNameHelper}</span>
                                        </div>
                                    )}
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
                                                className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-mono font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            />
                                        </div>
                                        <div className="flex items-center gap-[6px] text-[12px] text-slate-500">
                                            <Info className="w-[12px] h-[12px]" />
                                            <span>{pt.bankNameHelper}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-[6px]">
                                        <label className="flex items-center text-[13px] font-semibold text-slate-300">
                                            {pt.accountNumberLabel}
                                            <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] px-[7px] py-[2px] rounded-full bg-white/[0.04] border border-white/[0.08]">{pt.required}</span>
                                        </label>
                                        <div
                                            className="flex items-center rounded-[10px] overflow-hidden transition-all"
                                            style={{ background: 'var(--dash-surface)', border: `1px solid ${bankTransferErrors.accountNumber ? '#ef4444' : 'var(--dash-border)'}` }}
                                            onFocusCapture={e => !bankTransferErrors.accountNumber && (e.currentTarget.style.boxShadow = '0 0 0 1px #0ea5e9, 0 0 0 4px rgba(14,165,233,0.15)', e.currentTarget.style.borderColor = '#0ea5e9')}
                                            onBlurCapture={e => (e.currentTarget.style.boxShadow = '', e.currentTarget.style.borderColor = bankTransferErrors.accountNumber ? '#ef4444' : 'var(--dash-border)')}
                                        >
                                            <div className="px-[12px] h-[40px] grid place-items-center font-mono text-[13px] text-slate-400 font-medium shrink-0" style={{ borderRight: '1px solid var(--dash-border)' }}>
                                                MYR
                                            </div>
                                            <input
                                                type="text"
                                                value={accountNumber}
                                                onChange={e => handleAccountNumberChange(e.target.value)}
                                                placeholder="5141 2287 ••••"
                                                className="flex-1 bg-transparent border-none outline-none px-[12px] h-[40px] text-[14px] text-slate-100 font-mono font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600 min-w-0"
                                            />
                                        </div>
                                        {bankTransferErrors.accountNumber ? (
                                            <p className="text-[12px] text-red-400">{bankTransferErrors.accountNumber}</p>
                                        ) : (
                                            <div className="flex items-center gap-[6px] text-[12px] text-slate-500">
                                                <Shield className="w-[12px] h-[12px]" />
                                                <span>{pt.accountNumberHelper}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </PaymentMethodCard>
                </div>
            </section>

            {/* Save bar — sticky bottom so it sticks at viewport bottom when scrolling */}
            <div
                className="sticky bottom-4 z-40 flex items-center justify-between px-[18px] py-[12px] rounded-[14px] border border-white/[0.08] mt-6"
                style={{ background: 'var(--save-bar-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 20px 30px -10px rgba(0,0,0,0.6)' }}
            >
                <div className="flex items-center gap-2 text-[13px]">
                    {isDirty ? (
                        <>
                            <AlertCircle className="w-[14px] h-[14px] text-amber-400 shrink-0" />
                            <span className="text-amber-300 font-medium">{pt.unsavedChanges}</span>
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
                        onClick={handleCancel}
                        disabled={isSavingAll}
                        className="inline-flex items-center h-[34px] px-[14px] rounded-[8px] text-[13px] font-semibold text-slate-300 border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {pt.cancel}
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
