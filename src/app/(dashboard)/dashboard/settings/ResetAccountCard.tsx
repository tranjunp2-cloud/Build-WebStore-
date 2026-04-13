'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    const [state, setState] = useState<ResetState>('idle')
    const [confirmText, setConfirmText] = useState('')

    const canConfirm = confirmText === 'RESET'

    async function handleReset() {
        setState('loading')
        try {
            const res = await fetch('/api/account/reset', { method: 'POST' })
            const data: ResetResponse = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error?.message || 'Reset failed')
            }

            const total = Object.values(data.data?.collectionsCleared || {}).reduce((a, b) => a + b, 0)
            toast.success(`Account reset! ${total} records deleted.`)
            router.push('/onboarding')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Reset failed. Try again.'
            toast.error(message)
            setState('confirming')
        }
    }

    return (
        <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
                <CardTitle className="text-red-400">Danger Zone</CardTitle>
                <CardDescription className="text-red-300/70">
                    Staging only — not visible in production
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <h3 className="font-semibold text-white">Reset Account</h3>
                    <p className="text-sm text-gray-400">
                        Delete ALL data including tenants, sites, products, orders, media,
                        templates, and analytics. You will go through onboarding again.
                        Your email and password will be preserved.
                    </p>
                    <p className="text-sm font-medium text-red-400">
                        This action cannot be undone.
                    </p>
                </div>

                {state === 'idle' && (
                    <Button
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={() => setState('confirming')}
                    >
                        Reset Account
                    </Button>
                )}

                {(state === 'confirming' || state === 'loading') && (
                    <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                        <p className="text-sm text-gray-300">
                            Type <span className="font-mono font-bold text-red-400">RESET</span> to confirm:
                        </p>
                        <Input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Type RESET to confirm"
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
                                Cancel
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
                                        Resetting...
                                    </>
                                ) : (
                                    'Confirm Reset'
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
