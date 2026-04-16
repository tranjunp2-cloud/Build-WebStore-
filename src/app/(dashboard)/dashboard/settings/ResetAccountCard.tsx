'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'

type ResetState = 'idle' | 'confirming' | 'loading'

interface ResetResponse {
    success: boolean
    data?: {
        resetAt: string
        tenantsReset: string[]
        collectionsCleared: Record<string, number>
    }
    error?: {
        code: string
        message: string
    }
}

export function ResetAccountCard() {
    const router = useRouter()
    const { t, ti } = useI18n()
    const r = t.dashboard.resetAccount
    const [state, setState] = useState<ResetState>('idle')
    const [confirmText, setConfirmText] = useState('')

    const canConfirm = confirmText === 'RESET'

    async function handleReset() {
        setState('loading')
        try {
            const res = await fetch('/api/account/reset', { method: 'POST' })
            const data: ResetResponse = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error?.message || r.resetFailed)
            }

            const total = Object.values(data.data?.collectionsCleared || {}).reduce((a, b) => a + b, 0)
            toast.success(ti(r.resetSuccess, { count: total }))
            router.push('/onboarding')
        } catch (err) {
            const message = err instanceof Error ? err.message : r.resetFailedRetry
            toast.error(message)
            setState('confirming')
        }
    }

    return (
        <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
                <CardTitle className="text-red-400">{r.dangerZone}</CardTitle>
                <CardDescription className="text-red-300/70">
                    {r.stagingOnly}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <h3 className="font-semibold text-white">{r.title}</h3>
                    <p className="text-sm text-gray-400">
                        {r.description}
                    </p>
                    <p className="text-sm font-medium text-red-400">
                        {r.cannotUndo}
                    </p>
                </div>

                {state === 'idle' && (
                    <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={() => setState('confirming')}
                    >
                        {r.resetButton}
                    </Button>
                )}

                {(state === 'confirming' || state === 'loading') && (
                    <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                        <p className="text-sm text-gray-300">
                            {ti(r.typeConfirm, { keyword: 'RESET' }).split('RESET').map((part, i, arr) =>
                                i < arr.length - 1
                                    ? <span key={i}>{part}<span className="font-mono font-bold text-red-400">RESET</span></span>
                                    : <span key={i}>{part}</span>
                            )}
                        </p>
                        <Input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={r.typeConfirmPlaceholder}
                            disabled={state === 'loading'}
                            className="border-red-500/30 bg-transparent"
                        />
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={state === 'loading'}
                                onClick={() => {
                                    setState('idle')
                                    setConfirmText('')
                                }}
                            >
                                {r.cancel}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={!canConfirm || state === 'loading'}
                                onClick={handleReset}
                            >
                                {state === 'loading' ? (
                                    <>
                                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        {r.resetting}
                                    </>
                                ) : (
                                    r.confirmReset
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
