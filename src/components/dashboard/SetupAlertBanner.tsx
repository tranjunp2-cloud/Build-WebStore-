'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'

interface SetupAlertBannerProps {
    hasPaymentConfigured: boolean
}

export function SetupAlertBanner({ hasPaymentConfigured }: SetupAlertBannerProps) {
    const { t } = useI18n()
    const b = t.dashboard.onboarding.banner
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        if (sessionStorage.getItem('onboarding_banner_dismissed') === 'true') {
            setDismissed(true)
        }
    }, [])

    if (hasPaymentConfigured || dismissed) return null

    function handleDismiss() {
        sessionStorage.setItem('onboarding_banner_dismissed', 'true')
        setDismissed(true)
    }

    return (
        <div className="flex items-start gap-4 rounded-2xl border border-[hsl(var(--info)/0.4)] bg-gradient-to-br from-[hsl(var(--info)/0.1)] to-[hsl(var(--primary)/0.1)] p-[25px] shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--info))] to-[hsl(var(--primary))] drop-shadow-[0_10px_7.5px_rgba(0,0,0,0.1)]">
                <Bell className="h-6 w-6 !text-white" />
            </div>
            <div className="flex-1">
                <h3 className="text-lg font-semibold text-dash-text">{b.title}</h3>
                <p className="mt-1 text-sm text-dash-text-muted">{b.description}</p>
                <div className="mt-4 flex gap-3">
                    <Link
                        href="/settings/payments"
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] px-4 text-sm font-medium !text-white drop-shadow-[0_4px_3px_rgba(0,0,0,0.1)] transition-opacity hover:opacity-90"
                    >
                        {b.completeBtn}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button
                        onClick={handleDismiss}
                        className="inline-flex h-[38px] items-center rounded-xl border border-dash-border bg-dash-surface-hover px-4 text-sm font-medium text-dash-text transition-opacity hover:opacity-80"
                    >
                        {b.dismissBtn}
                    </button>
                </div>
            </div>
        </div>
    )
}
