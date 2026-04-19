/**
 * /studio/templates — All Templates server page.
 * Fetches initial data server-side, passes to client list component.
 * URL state: ?status=&category=&personality=&search=&sort=&page=&limit=&view=
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { TemplatesListClient } from './_components/templates-list-client'
import type { TemplatesFilter } from '@/lib/admin/templates-query'

export const metadata: Metadata = { title: 'All Templates' }

type PageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(v: string | string[] | undefined): string {
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

export default async function TemplatesPage({ searchParams }: PageProps) {
    await requireSuperAdmin()

    const sp = await searchParams
    const status = first(sp.status)
    const category = first(sp.category)
    const personality = first(sp.personality)
    const search = first(sp.search)
    const sort = first(sp.sort) || '-updatedAt'
    const page = Math.max(1, Number(first(sp.page) || 1))
    const limit = Math.min(100, Math.max(10, Number(first(sp.limit) || 50)))
    const view = (first(sp.view) || 'table') as 'table' | 'grid' | 'split'

    // Server-side initial fetch
    const where: Where = {}
    if (status && status !== 'all') where.status = { equals: status }
    if (category && category !== 'all') where.category = { contains: category }
    if (personality && personality !== 'all') where.personality = { equals: personality }
    if (search) {
        where.or = [{ name: { like: search } }, { description: { like: search } }]
    }

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'templates',
        where,
        sort,
        page,
        limit,
        depth: 1,
    })

    const filter: TemplatesFilter = { status, category, personality, search, sort, page, limit }

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
            initialFilter={filter}
            initialView={view}
            pageTitle="All Templates"
        />
    )
}
