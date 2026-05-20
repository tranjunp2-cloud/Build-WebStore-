'use client'

import { Cloud, CloudOff, Loader2 } from 'lucide-react'

interface OfflineBannerProps {
    isOnline: boolean
    isSyncing: boolean
}

export function OfflineBanner({ isOnline, isSyncing }: OfflineBannerProps) {
    if (isOnline && !isSyncing) return null

    return (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs text-amber-400">
            {isSyncing ? (
                <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span>Syncing changes...</span>
                </>
            ) : (
                <>
                    <CloudOff className="h-3.5 w-3.5 shrink-0" />
                    <span>You&apos;re offline. Changes saved locally.</span>
                </>
            )}
        </div>
    )
}

export function ConnectivityIndicator({ isOnline, isSyncing }: OfflineBannerProps) {
    return (
        <span title={isOnline ? (isSyncing ? 'Syncing...' : 'Connected') : 'Offline'}>
            {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
            ) : isOnline ? (
                <Cloud className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
                <CloudOff className="h-3.5 w-3.5 text-amber-400" />
            )}
        </span>
    )
}
