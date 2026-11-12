'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n'

/**
 * "Couldn't load — try again" for a dashboard page whose data (or the session check) failed on our side, e.g. a
 * database incident. Never a login redirect: the session is still valid. `onRetry` lets an error boundary reset
 * itself; the server data is always re-fetched (router.refresh).
 */
export function LoadRetryState({ onRetry }: { onRetry?: () => void }) {
    const { t } = useI18n()
    const router = useRouter()
    const [pending, startTransition] = useTransition()

    const retry = () =>
        startTransition(() => {
            router.refresh()
            onRetry?.()
        })

    return (
        <div role="alert" className="flex w-full flex-col items-center justify-center px-6 py-16 md:py-24">
            <div className="flex w-full max-w-[448px] flex-col items-center gap-3 text-center">
                <h2 className="m-0 text-[22px] font-bold leading-tight text-[hsl(var(--foreground))]">
                    {t.common.loadRetry.title}
                </h2>
                <p className="m-0 text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {t.common.loadRetry.description}
                </p>
                <button
                    type="button"
                    onClick={retry}
                    disabled={pending}
                    className="mt-2 rounded-[10px] bg-[hsl(var(--primary))] px-5 py-2 text-[15px] font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                    {t.common.loadRetry.retry}
                </button>
            </div>
        </div>
    )
}
