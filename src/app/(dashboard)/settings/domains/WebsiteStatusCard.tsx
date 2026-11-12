'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Globe } from 'lucide-react'
import { UnpublishModal } from '@/components/editor/UnpublishModal'
import { useI18n } from '@/i18n'
import type { WebsiteStatus } from './website-status'

interface WebsiteStatusCardProps {
    siteId: string
    status: WebsiteStatus
    siteUrl: string | null
    /** Server-computed with `canBuildSite` — same rule the DELETE API enforces (403 otherwise). */
    canUnpublish: boolean
}

const BADGE_CLS: Record<WebsiteStatus, string> = {
    live: 'bg-emerald-500/15 text-emerald-500',
    maintenance: 'bg-amber-500/15 text-amber-500',
    draft: 'bg-[var(--dash-surface-hover)] text-[var(--dash-text-muted)]',
}

export function WebsiteStatusCard({ siteId, status: initialStatus, siteUrl, canUnpublish }: WebsiteStatusCardProps) {
    const { t } = useI18n()
    const router = useRouter()
    const ws = t.Domains.websiteStatus
    const [status, setStatus] = useState<WebsiteStatus>(initialStatus)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isUnpublishing, setIsUnpublishing] = useState(false)

    // Follow the server value after router.refresh().
    useEffect(() => setStatus(initialStatus), [initialStatus])

    const statusLabel = { live: ws.statusLive, maintenance: ws.statusMaintenance, draft: ws.statusDraft }[status]
    const description = { live: ws.unpublishDesc, maintenance: ws.maintenanceDesc, draft: ws.draftDesc }[status]

    const handleUnpublish = async () => {
        if (isUnpublishing) return
        setIsUnpublishing(true)
        try {
            // Same route the editor used: keeps the 503 maintenance page, rate limit and audit.
            const res = await fetch(`/api/sites/${siteId}/publish`, { method: 'DELETE', credentials: 'include' })
            if (res.ok) {
                setStatus('maintenance')
                setIsModalOpen(false)
                toast.success(ws.unpublishSuccess)
                router.refresh()
                return
            }
            if (res.status === 409) {
                // Someone else already unpublished: sync the card and close the modal.
                setIsModalOpen(false)
                toast.error(ws.alreadyUnpublished)
                router.refresh()
                return
            }
            toast.error(res.status === 403 ? ws.forbidden : res.status === 429 ? ws.rateLimited : ws.unpublishFailed)
        } catch (err) {
            console.error('[WebsiteStatusCard] unpublish failed', err)
            toast.error(ws.unpublishFailed)
        } finally {
            setIsUnpublishing(false)
        }
    }

    return (
        <section
            aria-labelledby="website-status-heading"
            className="flex flex-col gap-[16px] rounded-[16px] p-[16px] sm:p-[25px]"
            style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface-hover)' }}
        >
            <div className="flex flex-wrap items-center gap-3">
                <Globe className="h-5 w-5 text-[hsl(var(--primary))]" aria-hidden />
                <h2 id="website-status-heading" className="text-[18px] font-semibold text-[var(--dash-text)]">{ws.title}</h2>
                <span
                    data-testid="website-status-badge"
                    className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold uppercase tracking-wider ${BADGE_CLS[status]}`}
                >
                    {statusLabel}
                </span>
            </div>

            {siteUrl && (
                <p className="min-w-0 text-[14px] text-[var(--dash-text-muted)] [overflow-wrap:anywhere]">
                    {ws.urlLabel}: <span className="font-medium text-[var(--dash-text)]">{siteUrl.replace(/^https?:\/\//, '')}</span>
                </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] text-[var(--dash-text-muted)]">{description}</p>
                {status === 'live' ? (
                    canUnpublish && (
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="h-9 shrink-0 rounded-[10px] border border-[hsl(var(--destructive))] px-4 text-[13px] font-medium text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive)/0.1)]"
                        >
                            {ws.unpublish}
                        </button>
                    )
                ) : (
                    <Link
                        href={`/editor/${siteId}`}
                        className="inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--dash-border)] px-4 text-[13px] font-medium text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-surface)]"
                    >
                        {status === 'maintenance' ? ws.openEditorRepublish : ws.openEditor}
                    </Link>
                )}
            </div>

            {canUnpublish && (
                <UnpublishModal
                    isOpen={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    onUnpublish={() => void handleUnpublish()}
                    isPublishing={isUnpublishing}
                />
            )}
        </section>
    )
}
