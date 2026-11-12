'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n'
import { clearClientAiState } from '@/lib/auth/clear-client-ai-state'

type Props = { merchantEmail: string; actorEmail: string; expiresAt: string }

/** Height reserved for the bar so page content, editor toolbars and toasts stay clear of it. */
const BAR_HEIGHT_PX = 40

export function formatTimeLeft(expiresAt: string, now: number): { hours: number; minutes: number } | null {
    const ms = new Date(expiresAt).getTime() - now
    if (!Number.isFinite(ms) || ms <= 0) return null
    const totalMinutes = Math.ceil(ms / 60_000)
    return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

/**
 * Fixed bottom bar shown while a Prime team member is signed in as a merchant (merchant access link).
 * Bottom, because the dashboard TopHeader is fixed at the top. Exit signs out like the avatar menu does.
 */
export function MerchantAccessBanner({ merchantEmail, actorEmail, expiresAt }: Props) {
    const { t, ti } = useI18n()
    // Null until mounted: the server and the browser would round the minutes differently (hydration mismatch).
    const [now, setNow] = useState<number | null>(null)
    const [exitFailed, setExitFailed] = useState(false)

    useEffect(() => {
        setNow(Date.now())
        const timer = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(timer)
    }, [])

    async function handleExit() {
        setExitFailed(false)
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
            if (!res.ok) throw new Error(`logout ${res.status}`)
        } catch {
            // Still signed in as the merchant: stay on the page and say so instead of pretending to exit.
            setExitFailed(true)
            return
        }
        clearClientAiState()
        window.location.href = '/login'
    }

    const left = now === null ? undefined : formatTimeLeft(expiresAt, now)
    const text = left === undefined
        ? ti(t.merchantAccessBanner.viewingNoTime, { merchant: merchantEmail, actor: actorEmail })
        : left
            ? ti(t.merchantAccessBanner.viewing, { merchant: merchantEmail, actor: actorEmail, hours: left.hours, minutes: left.minutes })
            : t.merchantAccessBanner.expired

    return (
        <>
            {/* Push toasts and page bottoms above the bar (toasts live in other components, so a global override). */}
            <style>{`
                body { padding-bottom: ${BAR_HEIGHT_PX}px; }
                .editor-shell { height: calc(100dvh - ${BAR_HEIGHT_PX}px) !important; }
                [data-sonner-toaster] { --offset: ${BAR_HEIGHT_PX + 16}px !important; --mobile-offset: ${BAR_HEIGHT_PX + 16}px !important; }
                [data-testid="notification-toast-container"] { bottom: ${BAR_HEIGHT_PX + 16}px !important; }
            `}</style>
            <div
                role="status"
                data-testid="merchant-access-banner"
                style={{ height: BAR_HEIGHT_PX }}
                className="fixed inset-x-0 bottom-0 z-[300] flex items-center justify-center gap-3 border-t border-amber-600 bg-amber-400 px-3 text-sm font-medium text-amber-950"
            >
                <span className="truncate">{text}</span>
                {exitFailed && <span role="alert" className="hidden text-red-900 sm:inline">{t.merchantAccessBanner.exitFailed}</span>}
                <button
                    type="button"
                    onClick={handleExit}
                    className="shrink-0 rounded bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900"
                >
                    {t.merchantAccessBanner.exit}
                </button>
            </div>
        </>
    )
}
