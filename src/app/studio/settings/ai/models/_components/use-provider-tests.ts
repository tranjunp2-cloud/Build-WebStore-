'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { callApi, describeFailure } from '@/lib/admin/ai-providers/browser-api'
import type { TestResult } from '@/lib/admin/ai-providers/types'

export interface TestState {
    result: TestResult | null
    running: boolean
    error?: string | null
}

/** Runs "Test" for a provider (stored key) and keeps the newest result until the server's own copy catches up. */
export function useProviderTests() {
    const router = useRouter()
    const [results, setResults] = useState<Record<string, TestResult>>({})
    const [running, setRunning] = useState<Record<string, boolean>>({})
    const [errors, setErrors] = useState<Record<string, string | null>>({})
    const test = useCallback(async (id: string) => {
        setRunning((current) => ({ ...current, [id]: true }))
        setErrors((current) => ({ ...current, [id]: null }))
        const result = await callApi<TestResult>('POST', `/providers/${id}/test`, {})
        setRunning((current) => ({ ...current, [id]: false }))
        if (!result.ok) return setErrors((current) => ({ ...current, [id]: describeFailure(result) }))
        setResults((current) => ({ ...current, [id]: result.data }))
        router.refresh()
    }, [router])
    const stateOf = (id: string, saved: TestResult | null): TestState => ({ result: results[id] ?? saved, running: Boolean(running[id]), error: errors[id] })
    return { test, stateOf }
}
