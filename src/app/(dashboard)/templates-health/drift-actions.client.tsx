'use client'

/**
 * DriftActions — client island with two super-admin actions:
 * 1. Re-seed templates (v3 blueprint seeder).
 * 2. Run harness:quick via API route (spawns CLI).
 *
 * Relies on existing session cookie for auth (same-origin fetch).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function DriftActions() {
    const router = useRouter()
    const [seeding, setSeeding] = useState(false)
    const [running, setRunning] = useState(false)

    async function handleReseed() {
        setSeeding(true)
        try {
            const res = await fetch('/api/templates/seed?v3=true&force=true', {
                method: 'POST',
                credentials: 'include',
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || data?.success === false) {
                const msg = data?.error?.message ?? `HTTP ${res.status}`
                toast.error(`Re-seed failed: ${msg}`)
                return
            }
            const created = data?.data?.created ?? data?.data?.total ?? '?'
            toast.success(`Re-seeded templates (${created} composed). Refreshing…`)
            router.refresh()
        } catch (err) {
            toast.error(`Re-seed failed: ${(err as Error).message}`)
        } finally {
            setSeeding(false)
        }
    }

    async function handleRunHarness() {
        setRunning(true)
        try {
            const res = await fetch('/api/admin/harness/gen', {
                method: 'POST',
                credentials: 'include',
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || data?.success === false) {
                const msg = data?.error?.message ?? `HTTP ${res.status}`
                toast.error(`Harness failed: ${msg}`)
                return
            }
            const s = data?.summary ?? {}
            toast.success(`Harness done — composed ${s.composed ?? '?'} / errors ${s.errors ?? '?'} (${s.durationMs ?? '?'}ms)`)
        } catch (err) {
            toast.error(`Harness failed: ${(err as Error).message}`)
        } finally {
            setRunning(false)
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleReseed} disabled={seeding}>
                {seeding ? 'Re-seeding…' : 'Re-seed templates'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRunHarness} disabled={running}>
                {running ? 'Running…' : 'Run harness quick'}
            </Button>
        </div>
    )
}
