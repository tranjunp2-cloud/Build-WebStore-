'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useI18n } from '@/i18n'

interface DeleteProductModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<void>
    productName: string
    isDeleting?: boolean
}

export function DeleteProductModal({
    isOpen,
    onClose,
    onConfirm,
    productName,
    isDeleting = false
}: DeleteProductModalProps) {
    const { t } = useI18n()
    const [isVisible, setIsVisible] = useState(false)
    const [isRendered, setIsRendered] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setIsRendered(true)
            // Small delay to ensure the element is rendered before adding the visible class for transition
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsVisible(true)
                })
            })
            document.body.style.overflow = 'hidden'
        } else {
            setIsVisible(false)
            const timer = setTimeout(() => {
                setIsRendered(false)
                document.body.style.overflow = ''
            }, 300) // Match the transition duration
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    if (!isRendered) return null

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 bg-black/60 backdrop-blur-[4px] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={!isDeleting ? onClose : undefined}
            />

            {/* Modal Container */}
            <div 
                className={`relative w-full max-w-[448px] overflow-hidden rounded-[16px] bg-[#1E293B] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] transition-all duration-300 transform ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
            >
                {/* Close Button Top Right */}
                <button 
                    onClick={onClose}
                    disabled={isDeleting}
                    className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border-none outline-none bg-transparent transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                    <X className="h-5 w-5 text-white/60" />
                </button>

                <div className="flex flex-col gap-4 p-6 pt-6">
                    {/* Header */}
                    <div className="flex flex-row items-center gap-3 w-full">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#FB2C36]/30 bg-[#FB2C36]/10">
                            <AlertTriangle className="h-6 w-6 text-[#FB2C36]" strokeWidth={2} />
                        </div>
                        <h2 className="text-[20px] font-bold leading-[1.4] text-[#F8FAFC]">
                            {t.dashboard.products.form.deleteConfirmTitle}
                        </h2>
                    </div>

                    {/* Warning Message Box */}
                    <div className="flex flex-col gap-3 rounded-[16px] border border-[#FB2C36]/20 bg-[#FB2C36]/5 p-4">
                        <p className="text-[16px] font-normal leading-[1.625] text-[#F8FAFC]/90 m-0">
                            {t.dashboard.products.form.deleteConfirmText} <span className="font-semibold">&quot;{productName}&quot;</span>?
                        </p>
                        <p className="text-[16px] font-normal leading-[1.625] text-[#F8FAFC]/90 m-0">
                            {t.dashboard.products.form.deleteWarning}
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-2 flex w-full flex-row gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isDeleting}
                            className="flex h-14 flex-1 items-center justify-center rounded-[16px] border-none outline-none bg-[#0B1120]/50 text-[16px] font-semibold text-[#F8FAFC] transition-colors hover:bg-white/5 disabled:opacity-50"
                        >
                            {t.dashboard.products.form.cancel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="flex h-14 flex-1 items-center justify-center rounded-[16px] border-none outline-none bg-gradient-to-r from-[#E7000B] to-[#FB2C36] text-[16px] font-bold text-white shadow-[0_4px_6px_-4px_rgba(251,44,54,0.3),0_10px_15px_-3px_rgba(251,44,54,0.3)] transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                            {isDeleting ? t.dashboard.products.form.deleting : t.dashboard.products.form.confirmDeleteBtn}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
