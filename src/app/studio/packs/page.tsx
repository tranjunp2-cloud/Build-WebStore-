/**
 * /studio/packs — Content Packs master-detail layout.
 * Bundle: page-packs.jsx — 2-column grid: pack list (left) + detail panel (right).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireStudioAccess } from '@/lib/admin/auth-guard'
import { PacksGrid } from './_components/packs-grid'

export const metadata: Metadata = { title: 'Content Packs' }

export type PackDoc = {
    id: string
    name: string
    description?: string | null
    category?: string | null
    personality?: string | null
    coverImage?: { url?: string | null } | null
    includedTemplates?: Array<{ id: string; name: string }> | null
    tags?: Array<{ tag: string }> | null
    createdAt: string
    updatedAt: string
}

export default async function PacksPage() {
    await requireStudioAccess()

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'content-packs',
        limit: 100,
        depth: 1,
        sort: '-createdAt',
    })

    const packs: PackDoc[] = result.docs.map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ''),
        description: (p.description as string) ?? null,
        category: (p.category as string) ?? null,
        personality: (p.personality as string) ?? null,
        coverImage: (p.coverImage as PackDoc['coverImage']) ?? null,
        includedTemplates: (p.includedTemplates as PackDoc['includedTemplates']) ?? null,
        tags: (p.tags as PackDoc['tags']) ?? null,
        createdAt: String(p.createdAt),
        updatedAt: String(p.updatedAt),
    }))

    return <PacksGrid initialPacks={packs} />
}
