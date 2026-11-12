/**
 * /studio/versions
 * Server component: timeline of latest 50 versions across all templates.
 * VersionsTimeline owns the split layout (bundle design Batch 2).
 */
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Versions' }

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireStudioAccess } from '@/lib/admin/auth-guard'
import { VersionsTimeline, type VersionEntry } from './_components/versions-timeline'

export default async function VersionsPage() {
    await requireStudioAccess()

    const payload = await getPayload({ config })

    const result = await payload.find({
        collection: 'template-versions',
        sort: '-createdAt',
        limit: 50,
        depth: 1,
    })

    const versions: VersionEntry[] = result.docs.map((doc) => {
        const d = doc as {
            id: number | string
            versionNumber: number
            changelog?: string | null
            createdAt: string
            template?: { id: number; name?: string } | number | null
        }
        const tmpl = d.template
        const templateName =
            tmpl && typeof tmpl === 'object' ? (tmpl.name ?? `#${tmpl.id}`) : `#${String(tmpl ?? '?')}`
        return {
            id: d.id,
            versionNumber: d.versionNumber,
            changelog: d.changelog,
            createdAt: d.createdAt,
            templateName,
        }
    })

    return (
        <div className="page">
            <div className="page-head" style={{ marginBottom: 20 }}>
                <div>
                    <h1 className="page-title">Versioning &amp; Rollback</h1>
                    <p className="page-sub">
                        View version history, compare diffs, rollback to a safe checkpoint.
                        Rollback available in F07.
                    </p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-sm">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s1-1 4-1 5 2 8 2 4-1 4-1V2s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="1" y1="7" x2="17" y2="7"/>
                        </svg>
                        Preview
                    </button>
                    <button className="btn btn-sm btn-primary">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1v3l3-3h3a2 2 0 0 0 2-2V8"/>
                            <path d="M15 2h-6a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2l2 2V7h2a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/>
                        </svg>
                        Open builder
                    </button>
                </div>
            </div>

            <VersionsTimeline versions={versions} showTemplateName />
        </div>
    )
}
