'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
    ShoppingCart,
    Megaphone,
    CircleAlert,
    FileText,
    ClipboardCheck,
    Bell,
    X,
    type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@/i18n'

interface LiveToastProps {
    id: string
    title: string
    type?: string
    message?: string
    onDismiss: (id: string) => void
}

const AUTO_DISMISS_MS = 5000
const EXIT_ANIMATION_MS = 300

export function LiveToast({ id, title, type, message, onDismiss }: LiveToastProps) {
    const [isExiting, setIsExiting] = useState(false)
    const dismissedRef = useRef(false)
    const { t } = useI18n()

    const dismiss = useCallback(() => {
        if (dismissedRef.current) return
        dismissedRef.current = true
        setIsExiting(true)
        setTimeout(() => onDismiss(id), EXIT_ANIMATION_MS)
    }, [id, onDismiss])

    useEffect(() => {
        const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
        return () => clearTimeout(timer)
    }, [dismiss])

    // Icon + color mapping (mirrors NotificationItem.tsx)
    let Icon: LucideIcon = Bell
    let iconBgClass = 'bg-blue-500/10 text-blue-400'

    if (type === 'ORDER_NEW') {
        Icon = ShoppingCart
        iconBgClass = 'bg-[#00BC7D]/10 text-[#00BC7D]'
    } else if (type === 'SYSTEM_ALERT') {
        Icon = Megaphone
        iconBgClass = 'bg-[#2B7FFF]/10 text-[#51A2FF]'
    } else if (type === 'PRODUCT_LOW_STOCK') {
        Icon = CircleAlert
        iconBgClass = 'bg-[#FF6900]/10 text-[#FF8904]'
    } else if (type === 'BLOG_PUBLISHED') {
        Icon = FileText
        iconBgClass = 'bg-white/10 text-white'
    } else if (type === 'AUTOMATION_REMINDER') {
        Icon = ClipboardCheck
        iconBgClass = 'bg-[#2DD4BF]/10 text-[#2DD4BF]'
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-3 w-[320px] sm:w-[360px] p-4 rounded-2xl bg-[#1E293B] border border-white/10 shadow-2xl transition-all duration-300 ${
                isExiting
                    ? 'opacity-0 translate-x-4'
                    : 'opacity-100 translate-x-0 animate-slide-in-right'
            }`}
        >
            <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconBgClass}`}
            >
                <Icon className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-white truncate">{title}</p>
                {message && (
                    <p className="text-[12px] text-[#94A3B8] truncate mt-0.5">{message}</p>
                )}
                <p className="text-[11px] text-[#64748B] mt-1">
                    {t.notifications.toast.justNow}
                </p>
            </div>

            <button
                onClick={dismiss}
                aria-label={t.notifications.toast.dismiss}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors text-[#64748B] hover:text-white"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}
