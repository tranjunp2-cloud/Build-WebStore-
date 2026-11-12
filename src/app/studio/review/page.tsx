/**
 * /studio/review — Slim review workflow: approve or reject templates in status=review.
 * ReviewQueue owns the full page layout (bundle design).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireStudioAccess } from '@/lib/admin/auth-guard'
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
    await requireStudioAccess()

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

    return <ReviewQueue initialTemplates={templates} />
}
