'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { useI18n } from '@/i18n'

export default function AnalyticsError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
    const { t } = useI18n()

    useEffect(() => {
        toast.error(t.dashboard.analytics.error)
    }, [error, t])

    return (
        <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-white/10 bg-[#1E293B]/50 p-6 text-center shadow-sm">
            <AlertTriangle className="mb-4 h-12 w-12 text-red-500/80" />
            <h2 className="text-lg font-bold text-white mb-2">
                {t.dashboard.analytics.error}
            </h2>
            <button
                onClick={reset}
                className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
            >
                <RefreshCcw className="h-4 w-4" />
                {t.dashboard.analytics.retry}
            </button>
        </div>
    )
}
