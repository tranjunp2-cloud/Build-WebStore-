'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { describeFailure, type ApiResult } from '@/lib/admin/ai-providers/browser-api'
import type { SettingsView } from '@/lib/admin/ai-providers/types'

export const TAKES_EFFECT = 'Saved. Takes effect within 1 min.'

/** One write at a time: busy flag, error sentence, a short "saved" note, and a router refresh after success. */
export function useWriter(onView: (view: SettingsView) => void) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [note, setNote] = useState<string | null>(null)
    useEffect(() => {
        if (!note) return
        const timer = setTimeout(() => setNote(null), 4000)
        return () => clearTimeout(timer)
    }, [note])
    const run = useCallback(async (call: () => Promise<ApiResult<SettingsView>>, message: string = TAKES_EFFECT, after?: (view: SettingsView) => void): Promise<boolean> => {
        setBusy(true)
        setError(null)
        const result = await call()
        setBusy(false)
        if (!result.ok) {
            setError(describeFailure(result))
            return false
        }
        if (result.data) {
            onView(result.data)
            after?.(result.data)
        }
        setNote(message)
        router.refresh()
        return true
    }, [onView, router])
    return { busy, error, note, setError, run }
}

export function Toast({ message }: { message: string | null }) {
    return message ? <div className="pm-toast" role="status">{message}</div> : null
}
