/**
 * /studio/packs — Content Packs grid view.
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
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
    await requireSuperAdmin()

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

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b flex-shrink-0">
                <h1 className="text-lg font-semibold">Content Packs</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Curated template bundles — campaigns, industry kits, seasonal collections.
                </p>
            </div>
            <div className="flex-1 overflow-auto">
                <PacksGrid initialPacks={packs} />
            </div>
        </div>
    )
}
