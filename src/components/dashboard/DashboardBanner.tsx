'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'

export function DashboardBanner({ siteId, siteName }: { siteId: string; siteName: string }) {
    const [dismissed, setDismissed] = useState(false)

    if (dismissed) return null

    return (
        <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
                <p className="text-sm text-yellow-200">
                    <strong>{siteName}</strong> chưa live.{' '}
                    <Link
                        href={`/editor/${siteId}`}
                        className="font-medium text-yellow-400 underline underline-offset-2 hover:text-yellow-300"
                    >
                        Publish ngay →
                    </Link>
                </p>
            </div>
            <button
                onClick={() => setDismissed(true)}
                className="rounded p-1 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                aria-label="Dismiss banner"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}
