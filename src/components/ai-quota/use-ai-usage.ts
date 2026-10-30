'use client'

import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query'
import { useCallback, useContext, useEffect, useRef } from 'react'
import { type AiUsage, aiTone, parseAiUsage } from './quota-format'

export const AI_USAGE_KEY = ['ai-usage'] as const

// Rendered outside the app's QueryProvider (isolated renders, tests): never fetch, show nothing
const idleClient = new QueryClient()

async function fetchAiUsage(signal?: AbortSignal): Promise<AiUsage | null> {
    try {
        const res = await fetch('/api/agent/usage', { credentials: 'same-origin', signal, headers: { Accept: 'application/json' } })
        // signed out, AI not enabled here, platform unreachable: the allowance UI simply hides
        if (!res.ok) return null
        return parseAiUsage(await res.json())
    } catch {
        if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
        return null
    }
}

/** The shop's AI allowance. `usage` is null while loading or when it can't be shown (callers render nothing). */
export function useAiUsage() {
    const client = useContext(QueryClientContext)
    const query = useQuery(
        {
            queryKey: AI_USAGE_KEY,
            queryFn: ({ signal }) => fetchAiUsage(signal),
            staleTime: 60_000,
            refetchOnWindowFocus: true,
            retry: false,
            enabled: Boolean(client),
        },
        client ?? idleClient,
    )
    return { usage: query.data ?? null, loading: Boolean(client) && query.isPending }
}

/** Re-reads the allowance when an assistant reply finishes (busy → idle), so the chip and notice move. */
export function useRefreshAiUsageAfterReply(busy: boolean) {
    const client = useContext(QueryClientContext)
    const wasBusy = useRef(busy)
    const refresh = useCallback(() => void client?.invalidateQueries({ queryKey: AI_USAGE_KEY }), [client])
    useEffect(() => {
        if (wasBusy.current && !busy) refresh()
        wasBusy.current = busy
    }, [busy, refresh])
}

/** The shop's AI allowance is used up (or AI is paused): entry points that would start a reply hide. */
export function useAiAllowanceOut(): boolean {
    const { usage } = useAiUsage()
    return usage !== null && aiTone(usage) === 'out'
}
