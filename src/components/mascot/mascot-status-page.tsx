'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Mascot, type SceneName } from '@/mascot'

type StatusKind = 'notFound' | 'forbidden' | 'error' | 'offline'

const SCENE: Record<StatusKind, SceneName> = {
    notFound: 'notFound',
    forbidden: 'security',
    error: 'error',
    offline: 'offline',
}

const CODE: Partial<Record<StatusKind, string>> = { notFound: '404', forbidden: '403' }

interface MascotStatusPageProps {
    kind: StatusKind
    /** error / offline: the retry. Without it the way out is a link back to the dashboard. */
    onRetry?: () => void
}

/** Full-page status (not found, no access, crashed): the mascot acts it out, one way back. */
export function MascotStatusPage({ kind, onRetry }: MascotStatusPageProps) {
    const { t } = useI18n()
    const copy = t.mascot.statusPages[kind]
    const code = CODE[kind]
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center">
            <Mascot scene={SCENE[kind]} size={200} fps={30} className="max-w-full" />
            {code && (
                <p className="mt-2 text-sm font-semibold tracking-[0.08em] tabular-nums" style={{ color: 'var(--dash-text-muted)' }}>
                    {code}
                </p>
            )}
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--dash-text)' }}>{copy.title}</h1>
            <p className="mt-2 max-w-[420px] text-sm" style={{ color: 'var(--dash-text-muted)' }}>{copy.description}</p>
            <div className="mt-6">
                {onRetry ? (
                    <Button variant="dashPrimary" size="dash" onClick={onRetry}>{copy.cta}</Button>
                ) : (
                    <Button asChild variant="dashPrimary" size="dash">
                        <Link href="/dashboard">{copy.cta}</Link>
                    </Button>
                )}
            </div>
        </div>
    )
}
