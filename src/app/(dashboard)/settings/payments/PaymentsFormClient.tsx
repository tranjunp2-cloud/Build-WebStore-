"use client";

import React, { useState, useEffect, useRef } from 'react';
import NextImage from 'next/image';
import { CreditCard, Banknote, Upload, UploadCloud, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getPaymentSettings, updatePaymentSettings, uploadQrMedia, type PaymentUpdates } from './actions';
import { useI18n } from '@/i18n';

type Media = {
    id: string | number;
    url?: string;
    thumbnailURL?: string;
};

function getImageUrl(image: Media | string | null): string | null {
    if (!image || typeof image === 'string') return null;
    let url = image.url || image.thumbnailURL || null;
    if (url && url.includes('minio:9000')) {
        url = url.replace('minio:9000', 'localhost:9000');
    }
    return url || null;
}

function isLocalOrBlob(urlStr: string | null): boolean {
    if (!urlStr) return false;
    if (urlStr.startsWith('blob:')) return true;
    try {
        const url = new URL(urlStr);
        return ['localhost', '127.0.0.1', 'minio'].includes(url.hostname);
    } catch {
        return false;
    }
}

export function PaymentsFormClient({ tenantId }: { tenantId: string | undefined }) {
    const [paymentCod, setPaymentCod] = useState(false);
    const [paymentQr, setPaymentQr] = useState(false);
    const [qrWidgetExpanded, setQrWidgetExpanded] = useState(false);
    const [qrImageId, setQrImageId] = useState<string | number | null>(null);
    const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);

    const { t } = useI18n();
    const pt = t.dashboard.settings.payments;

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch initial settings
    useEffect(() => {
        if (!tenantId) {
            setIsLoading(false);
            return;
        }

        const fetchSettings = async () => {
            try {
                const res = await getPaymentSettings();
                if (res.success && res.payments) {
                    const data = res.payments;
                    setPaymentCod(data.payment_cod || false);
                    setPaymentQr(data.payment_qr || false);

                    if (data.qr_image) {
                        const qrImg = data.qr_image;
                        setQrImageId(typeof qrImg === 'string' ? qrImg : qrImg.id);
                        
                        const url = getImageUrl(qrImg as Media);
                        setQrPreviewUrl(url);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch tenant settings:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [tenantId]);

    const saveTenantSettings = async (updates: PaymentUpdates) => {
            if (!tenantId) return false;
            try {
                const res = await updatePaymentSettings({
                    payment_cod: paymentCod,
                    payment_qr: paymentQr,
                    qr_image: qrImageId,
                    ...updates
                });
                if (!res.success) throw new Error(res.error || "Failed to save settings");
                return true;
            } catch (error: unknown) {
                console.error("Save error:", error);
                const errorMessage = error instanceof Error ? error.message : "Failed to save changes. Please try again.";
                toast.error(errorMessage);
                return false;
            }
        };

    const handleToggleCod = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setPaymentCod(checked);
        const success = await saveTenantSettings({ payment_cod: checked });
        if (success) {
            toast.success(pt.successSave);
        } else {
            setPaymentCod(!checked);
            toast.error(pt.failSaveSettings);
        }
    };

    const handleToggleQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        if (checked && !qrImageId && !qrPreviewUrl) {
            setQrWidgetExpanded(true);
            return;
        }
        setPaymentQr(checked);
        if (!checked) setQrWidgetExpanded(false);
        
        const success = await saveTenantSettings({ payment_qr: checked });
        if (success) {
            toast.success(pt.successSave);
        } else {
            setPaymentQr(!checked);
            toast.error(pt.failSaveConfig);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image must be smaller than 2MB");
            return;
        }

        // Preview instantly with blob URL
        const objectUrl = URL.createObjectURL(file);
        setQrPreviewUrl(objectUrl);
        // Do not auto-activate here; wait until success
            toast.loading(pt.uploadingQr, { id: 'upload-qr' });
            try {
                const formData = new FormData();
                formData.append('file', file);
    
                const uploadRes = await uploadQrMedia(formData);
    
                if (!uploadRes.success || !uploadRes.doc) {
                    throw new Error(uploadRes.error || "Upload failed");
                }
                
                const qrDocId = uploadRes.doc.id;
                setQrImageId(qrDocId);

                // Update preview URL to the server URL so it persists after navigation.
                // getImageUrl handles minio:9000 → localhost:9000 for local dev;
                // on staging it returns the S3/CDN URL directly.
                const serverUrl = getImageUrl(uploadRes.doc as Media);
                if (serverUrl) {
                    setQrPreviewUrl(serverUrl);
                }
                // If serverUrl is somehow unavailable, blob URL from above is already showing.
            
            setPaymentQr(true); // Now activate
            
            // Auto-save setting
            const success = await saveTenantSettings({ payment_qr: true, qr_image: qrDocId });
            
            toast.dismiss('upload-qr');
            if (success) {
                toast.success(pt.successSave);
            } else {
                toast.error(pt.failSaveConfig);
                // Revert completely
                setPaymentQr(false);
                setQrPreviewUrl(null);
                setQrImageId(null);
            }

        } catch (error: unknown) {
            console.error("Upload error:", error);
            toast.dismiss('upload-qr');
            const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
            toast.error(pt.uploadError + errorMessage);
            setQrPreviewUrl(null);
            setPaymentQr(false); // Revert state
        }
    };

    const handleRemoveImage = async () => {
        setQrImageId(null);
        setQrPreviewUrl(null);
        setPaymentQr(false); // Auto disable QR method if image removed
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        
        const success = await saveTenantSettings({ payment_qr: false, qr_image: null });
        if (success) {
            toast.success(pt.removeSuccess);
        } else {
            toast.error(pt.failClearQR);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/tenants/${tenantId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    payments: {
                        payment_cod: paymentCod,
                        payment_qr: paymentQr,
                        qr_image: qrImageId,
                    }
                }),
                credentials: 'include',
            });

            if (!res.ok) throw new Error("Failed to save settings");
            toast.success(pt.successSave);
        } catch (error) {
            console.error(error);
            toast.error(pt.failSaveSettings);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-white">{pt.loading}</div>;
    }

    return (
        <div className="w-full space-y-[28px]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-[50px] w-[50px] items-center justify-center rounded-[16px] bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 shrink-0">
                    <CreditCard className="h-6 w-6 text-[#2DD4BF]" />
                </div>
                <div>
                    <h1 className="text-[24px] font-bold text-slate-50 heading-responsive">{pt.title}</h1>
                    <p className="mt-1 text-[14px] text-slate-50/60 font-normal relative">{pt.subtitle}</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-[16px]">

                {/* Stripe / Card Section */}
                <div className="flex flex-col p-[25px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 transition-colors gap-[16px]">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-[16px] bg-white/5 border border-white/[0.08] shrink-0">
                                <CreditCard className="h-6 w-6 text-slate-200" />
                            </div>
                            <div>
                                <h3 className="text-[18px] font-semibold text-slate-50">{pt.gatewayTitle}</h3>
                                <p className="mt-1 text-[14px] text-slate-50/60 max-w-[320px]">{pt.gatewaySubtitle}</p>
                            </div>
                        </div>
                        {/* Mock Stripe Toggle */}
                        <div className="mt-4 sm:mt-0">
                            <label className="relative inline-flex cursor-not-allowed items-center text-slate-50">
                                <div className="h-[32px] w-[56px] rounded-full bg-[#1E293B] border border-white/[0.12] relative">
                                    <div className="absolute left-[4px] top-[3px] h-[24px] w-[24px] rounded-full bg-slate-400/50 transition-all shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]"></div>
                                </div>
                            </label>
                        </div>
                    </div>
                    {/* Status Pill matching Text alignment */}
                    <div>
                        <div className="flex w-[79px] h-[34px] items-center justify-center rounded-[12px] border border-white/[0.05] bg-[#0B1120]/50">
                            <span className="text-[14px] font-medium leading-none text-slate-50/50">{pt.inactive}</span>
                        </div>
                    </div>
                </div>

                {/* COD Card */}
                <div className={cn(
                    "flex flex-col p-[25px] rounded-[16px] transition-all duration-300 gap-[16px]",
                    paymentCod ? "border-blue-500/30 bg-[#1E293B]/60 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "border-white/[0.08] bg-[#1E293B]/60"
                )}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "flex h-[50px] w-[50px] items-center justify-center rounded-[16px] border shrink-0 transition-colors duration-300",
                                paymentCod ? "bg-blue-500/10 border-blue-500/20" : "bg-white/5 border-white/[0.08]"
                            )}>
                                <Banknote className={cn("h-6 w-6 transition-colors duration-300", paymentCod ? "text-blue-500" : "text-slate-200")} />
                            </div>
                            <div>
                                <h3 className="text-[18px] font-semibold text-slate-50">{pt.codTitle}</h3>
                                <p className="mt-1 text-[14px] text-slate-50/60 max-w-[320px]">{pt.codSubtitle}</p>
                            </div>
                        </div>
                        <div className="mt-4 sm:mt-0">
                            <label className="relative inline-flex cursor-pointer items-center text-slate-50">
                                <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={paymentCod}
                                    onChange={handleToggleCod}
                                />
                                <div className={cn(
                                    "h-[32px] w-[56px] rounded-full border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 after:absolute after:left-[4px] after:top-[3px] after:h-[24px] after:w-[24px] after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-[24px] after:shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]",
                                    paymentCod ? "bg-gradient-to-r from-blue-500 to-teal-400 border-transparent shadow-[0_0_12px_rgba(59,130,246,0.4)]" : "bg-[#1E293B] border-white/[0.12]"
                                )}></div>
                            </label>
                        </div>
                    </div>
                    {/* Status Pill */}
                    <div>
                        {paymentCod ? (
                            <div className="flex h-[34px] w-fit items-center justify-center gap-[6px] rounded-[12px] border border-[#00C950]/30 bg-[#00C950]/10 pl-[12px] pr-[16px]">
                                <Check className="h-4 w-4 text-[#05DF72]" strokeWidth={2.5} />
                                <span className="text-[14px] font-medium leading-none text-[#B9F8CF]">{pt.active}</span>
                            </div>
                        ) : (
                            <div className="flex w-[79px] h-[34px] items-center justify-center rounded-[12px] border border-white/[0.05] bg-[#0B1120]/50">
                                <span className="text-[14px] font-medium leading-none text-slate-50/50">{pt.inactive}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* QR Banking Card */}
                <div className={cn(
                    "flex flex-col p-[25px] rounded-[16px] transition-all duration-300 gap-[16px]",
                    paymentQr ? "border-blue-500/30 bg-[#1E293B]/60 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "border-white/[0.08] bg-[#1E293B]/60"
                )}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "flex h-[50px] w-[50px] items-center justify-center rounded-[16px] border shrink-0 transition-colors duration-300",
                                paymentQr ? "bg-blue-500/10 border-blue-500/20" : "bg-white/5 border-white/[0.08]"
                            )}>
                                <Upload className={cn("h-6 w-6 transition-colors duration-300", paymentQr ? "text-blue-500" : "text-slate-200")} />
                            </div>
                            <div>
                                <h3 className="text-[18px] font-semibold text-slate-50">{pt.bankTransferTitle}</h3>
                                <p className="mt-1 text-[14px] text-slate-50/60 max-w-[320px]">{pt.bankTransferSubtitle}</p>
                            </div>
                        </div>
                        <div className="mt-4 sm:mt-0">
                            <label className="relative inline-flex cursor-pointer items-center text-slate-50">
                                <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={paymentQr}
                                    onChange={handleToggleQr}
                                />
                                <div className={cn(
                                    "h-[32px] w-[56px] rounded-full border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 after:absolute after:left-[4px] after:top-[3px] after:h-[24px] after:w-[24px] after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-[24px] after:shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]",
                                    paymentQr ? "bg-gradient-to-r from-blue-500 to-teal-400 border-transparent shadow-[0_0_12px_rgba(59,130,246,0.4)]" : "bg-[#1E293B] border-white/[0.12]"
                                )}></div>
                            </label>
                        </div>
                    </div>
                    {/* Status Pill */}
                    <div>
                        {paymentQr ? (
                            <div className="flex h-[34px] w-fit items-center justify-center gap-[6px] rounded-[12px] border border-[#00C950]/30 bg-[#00C950]/10 pl-[12px] pr-[16px]">
                                <Check className="h-4 w-4 text-[#05DF72]" strokeWidth={2.5} />
                                <span className="text-[14px] font-medium leading-none text-[#B9F8CF]">{pt.active}</span>
                            </div>
                        ) : (
                            <div className="flex w-[79px] h-[34px] items-center justify-center rounded-[12px] border border-white/[0.05] bg-[#0B1120]/50">
                                <span className="text-[14px] font-medium leading-none text-slate-50/50">{pt.inactive}</span>
                            </div>
                        )}
                    </div>

                    {/* QR Upload Widget */}
                    {(paymentQr || qrWidgetExpanded) && (
                        <div className="flex flex-col p-[17px] rounded-[16px] border border-white/5 bg-[#0B1120]/50 gap-[12px] animate-in fade-in slide-in-from-top-4 duration-300">
                            <h4 className="text-[14px] font-medium text-slate-50">{pt.uploadQrTitle}</h4>
                            <div className="flex flex-col w-full">
                                {qrPreviewUrl ? (
                                    <div className="relative inline-flex self-start border border-white/[0.08] rounded-2xl overflow-hidden bg-[#0B1120]/50 p-3">
                                        <NextImage
                                            src={qrPreviewUrl}
                                            alt="QR Code"
                                            width={192}
                                            height={192}
                                            unoptimized={isLocalOrBlob(qrPreviewUrl)}
                                            className="object-contain bg-white rounded-xl shadow-inner"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRemoveImage}
                                            className="absolute top-2 right-2 p-1 bg-red-500/90 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex flex-col items-center justify-center gap-[12px] w-full h-[200px] rounded-[16px] border-[2px] border-dashed border-white/[0.08] hover:border-blue-500/50 transition-colors cursor-pointer group"
                                    >
                                        <div className="p-4 rounded-full bg-blue-500/10 text-blue-500 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
                                            <UploadCloud className="h-6 w-6" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[14px] font-medium text-[#F8FAFC]">{pt.uploadQrSub}</p>
                                            <p className="text-[12px] font-medium text-slate-50/50 mt-[4px]">{pt.uploadHint}</p>
                                        </div>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Box */}
                <div className="flex items-start gap-4 p-[25px] rounded-[16px] border border-blue-500/20 bg-[#0b1b36] shadow-[0_4px_24px_rgba(59,130,246,0.1)]">
                    <div className="flex h-[40px] w-[40px] items-center justify-center shrink-0 rounded-[12px] bg-blue-500/10">
                        <CreditCard className="h-5 w-5 text-[#3B82F6]" />
                    </div>
                    <div>
                        <h4 className="text-[16px] font-semibold text-slate-50 mt-[2px]">{pt.infoTitle}</h4>
                        <p className="mt-1 text-[14px] text-slate-50/60 leading-relaxed w-full">
                            {pt.infoDesc}
                        </p>
                    </div>
                </div>


            </form>
        </div>
    );
}
