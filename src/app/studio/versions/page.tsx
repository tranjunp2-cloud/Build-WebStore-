/**
 * /studio/versions
 * Server component: timeline of latest 50 versions across all templates.
 * Replaces Phase 09 placeholder.
 */
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Versions' }

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { VersionsTimeline, type VersionEntry } from './_components/versions-timeline'

export default async function VersionsPage() {
    await requireSuperAdmin()

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
        <div className="p-6 max-w-2xl">
            <div className="mb-6">
                <h1 className="text-lg font-semibold">Version History</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Latest 50 saves across all templates. Rollback available in F07.
                </p>
            </div>

            <VersionsTimeline versions={versions} showTemplateName />
        </div>
    )
}
