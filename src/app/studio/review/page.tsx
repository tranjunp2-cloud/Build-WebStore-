/**
 * /studio/review — Slim review workflow: approve or reject templates in status=review.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { ReviewQueue } from './_components/review-queue'
import type { ReviewTemplate } from './_components/review-queue'

export const metadata: Metadata = { title: 'Review Workflow' }

type PageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(v: string | string[] | undefined): string {
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

export default async function ReviewPage({ searchParams }: PageProps) {
    await requireSuperAdmin()

    const sp = await searchParams
    const page = Math.max(1, Number(first(sp.page) || 1))
    const limit = Math.min(100, Math.max(10, Number(first(sp.limit) || 50)))

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'templates',
        where: { status: { equals: 'review' } },
        sort: '-updatedAt',
        page,
        limit,
        depth: 1,
    })

    const templates: ReviewTemplate[] = result.docs.map((t) => ({
        id: String(t.id),
        name: String(t.name ?? ''),
        description: (t.description as string) ?? null,
        category: Array.isArray(t.category) ? (t.category as string[]) : [],
        personality: (t.personality as string) ?? null,
        thumbnail: (t.thumbnail as ReviewTemplate['thumbnail']) ?? null,
        dnaComplianceCache: ((t as Record<string, unknown>).dnaComplianceCache as ReviewTemplate['dnaComplianceCache']) ?? null,
        updatedAt: String(t.updatedAt),
    }))

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b flex-shrink-0">
                <h1 className="text-lg font-semibold">Review Workflow</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {result.totalDocs} template{result.totalDocs !== 1 ? 's' : ''} pending review
                </p>
            </div>
            <div className="flex-1 overflow-auto">
                <ReviewQueue initialTemplates={templates} />
            </div>
        </div>
    )
}
