"use client";

import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Banknote, Upload, UploadCloud, X, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function PaymentsFormClient({ tenantId }: { tenantId: string | undefined }) {
    const [paymentCod, setPaymentCod] = useState(false);
    const [paymentQr, setPaymentQr] = useState(false);
    const [qrWidgetExpanded, setQrWidgetExpanded] = useState(false);
    const [qrImageId, setQrImageId] = useState<string | null>(null);
    const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);

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
                const res = await fetch(`/api/tenants/${tenantId}`);
                if (res.ok) {
                    const data = await res.json();
                    setPaymentCod(data.payment_cod || false);
                    setPaymentQr(data.payment_qr || false);

                    if (data.qr_image) {
                        setQrImageId(typeof data.qr_image === 'string' ? data.qr_image : data.qr_image.id);
                        setQrPreviewUrl(typeof data.qr_image === 'object' && data.qr_image.url ? data.qr_image.url : null);
                        // If it's just an ID and no URL, you might need a separate fetch for the media url
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

    const handleToggleCod = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setPaymentCod(checked);
        toast.success("Changes saved! ✅");
    };

    const handleToggleQr = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        if (checked && !qrImageId && !qrPreviewUrl) {
            setQrWidgetExpanded(true);
            return;
        }
        setPaymentQr(checked);
        if (!checked) setQrWidgetExpanded(false);
        toast.success("Changes saved! ✅");
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image must be smaller than 2MB");
            return;
        }

        // Preview
        const objectUrl = URL.createObjectURL(file);
        setQrPreviewUrl(objectUrl);
        setPaymentQr(true); // Auto-activate once file is loaded
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('_payload', JSON.stringify({ alt: 'QR Code for Bank Transfer' }));

            // Assuming this is your media upload endpoint
            const res = await fetch('/api/media', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText);
            }
            
            const data = await res.json();
            setQrImageId(data.doc.id);
            setQrPreviewUrl(data.doc.url);
            toast.success("Changes saved! ✅");

        } catch (error: any) {
            console.error("Upload error:", error);
            toast.error("Upload Error: " + (error.message || "Failed to upload image"));
            setQrPreviewUrl(null);
        }
    };

    const handleRemoveImage = () => {
        setQrImageId(null);
        setQrPreviewUrl(null);
        setPaymentQr(false); // Auto disable QR method if image removed
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
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
                    payment_cod: paymentCod,
                    payment_qr: paymentQr,
                    qr_image: qrImageId,
                }),
            });

            if (!res.ok) throw new Error("Failed to save settings");
            toast.success("Changes saved! ✅");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-white">Loading configuration...</div>;
    }

    return (
        <div className="w-full space-y-[28px]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-[50px] w-[50px] items-center justify-center rounded-[16px] bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 shrink-0">
                    <CreditCard className="h-6 w-6 text-[#2DD4BF]" />
                </div>
                <div>
                    <h1 className="text-[24px] font-bold text-slate-50 heading-responsive">Payment Methods</h1>
                    <p className="mt-1 text-[14px] text-slate-50/60 font-normal relative">Configure how customers can pay for their orders</p>
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
                                <h3 className="text-[18px] font-semibold text-slate-50">Credit/Debit Gateway</h3>
                                <p className="mt-1 text-[14px] text-slate-50/60 max-w-[320px]">Accept credit and debit card payments via Stripe</p>
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
                            <span className="text-[14px] font-medium leading-none text-slate-50/50">Inactive</span>
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
                                <h3 className="text-[18px] font-semibold text-slate-50">Cash on Delivery (COD)</h3>
                                <p className="mt-1 text-[14px] text-slate-50/60 max-w-[320px]">Allow manual cash collection upon delivery</p>
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
                                <span className="text-[14px] font-medium leading-none text-[#B9F8CF]">Active</span>
                            </div>
                        ) : (
                            <div className="flex w-[79px] h-[34px] items-center justify-center rounded-[12px] border border-white/[0.05] bg-[#0B1120]/50">
                                <span className="text-[14px] font-medium leading-none text-slate-50/50">Inactive</span>
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
                                <h3 className="text-[18px] font-semibold text-slate-50">Bank Transfer / DuitNow QR</h3>
                                <p className="mt-1 text-[14px] text-slate-50/60 max-w-[320px]">Accept payments via bank transfer with QR code</p>
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
                                <span className="text-[14px] font-medium leading-none text-[#B9F8CF]">Active</span>
                            </div>
                        ) : (
                            <div className="flex w-[79px] h-[34px] items-center justify-center rounded-[12px] border border-white/[0.05] bg-[#0B1120]/50">
                                <span className="text-[14px] font-medium leading-none text-slate-50/50">Inactive</span>
                            </div>
                        )}
                    </div>

                    {/* QR Upload Widget */}
                    {(paymentQr || qrWidgetExpanded) && (
                        <div className="flex flex-col p-[17px] rounded-[16px] border border-white/5 bg-[#0B1120]/50 gap-[12px] animate-in fade-in slide-in-from-top-4 duration-300">
                            <h4 className="text-[14px] font-medium text-slate-50">Upload QR Code Image</h4>
                            <div className="flex flex-col w-full">
                                {qrPreviewUrl ? (
                                    <div className="relative inline-flex self-start border border-white/[0.08] rounded-2xl overflow-hidden bg-[#0B1120]/50 p-3">
                                        <img
                                            src={qrPreviewUrl}
                                            alt="QR Code"
                                            className="w-48 h-48 object-contain bg-white rounded-xl shadow-inner"
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
                                            <p className="text-[14px] font-medium text-[#F8FAFC]">Click to upload QR Code</p>
                                            <p className="text-[12px] font-medium text-slate-50/50 mt-[4px]">JPG or PNG. Max size: 2MB</p>
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
                        <h4 className="text-[16px] font-semibold text-slate-50 mt-[2px]">Payment Method Setup</h4>
                        <p className="mt-1 text-[14px] text-slate-50/60 leading-relaxed w-full">
                            Customers will only see enabled payment methods during checkout. For Stripe integration, you'll need to connect your account in the advanced settings.
                        </p>
                    </div>
                </div>


            </form>
        </div>
    );
}
