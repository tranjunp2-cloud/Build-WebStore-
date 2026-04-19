/**
 * /studio/archived — Templates filtered to status=archived.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { TemplatesListClient } from '../templates/_components/templates-list-client'

export const metadata: Metadata = { title: 'Archived' }

type PageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(v: string | string[] | undefined): string {
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

export default async function ArchivedPage({ searchParams }: PageProps) {
    await requireSuperAdmin()

    const sp = await searchParams
    const sort = first(sp.sort) || '-updatedAt'
    const page = Math.max(1, Number(first(sp.page) || 1))
    const limit = Math.min(100, Math.max(10, Number(first(sp.limit) || 50)))
    const view = (first(sp.view) || 'table') as 'table' | 'grid' | 'split'

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'templates',
        where: { status: { equals: 'archived' } },
        sort,
        page,
        limit,
        depth: 1,
    })

    return (
        <TemplatesListClient
            initialData={{
                data: result.docs as never,
                meta: {
                    totalDocs: result.totalDocs,
                    totalPages: result.totalPages,
                    page: result.page ?? 1,
                    limit: result.limit,
                    hasNextPage: result.hasNextPage,
                    hasPrevPage: result.hasPrevPage,
                },
            }}
            initialFilter={{ sort, page, limit }}
            initialView={view}
            pageTitle="Archived"
            presetStatus="archived"
        />
    )
}
