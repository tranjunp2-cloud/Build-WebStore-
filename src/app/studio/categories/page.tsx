/**
 * /studio/categories — Category DNA editor (split-pane).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { CategorySplitPane } from './_components/category-split-pane'
import type { CategoryDNA } from '@/lib/admin/dna-compliance'

export const metadata: Metadata = { title: 'Category DNA' }

export default async function CategoriesPage() {
    await requireSuperAdmin()

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'categories',
        limit: 100,
        depth: 0,
        sort: 'name',
    })

    // Normalize to plain objects safe for client components
    const categories = result.docs.map((c) => ({
        id: String(c.id),
        name: String(c.name ?? ''),
        slug: String(c.slug ?? ''),
        dna: ((c as Record<string, unknown>).dna as CategoryDNA) ?? null,
    }))

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b flex-shrink-0">
                <h1 className="text-lg font-semibold">Category DNA</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Define signature blocks, personality, and AI hints per category.
                </p>
            </div>
            <div className="flex-1 min-h-0">
                <CategorySplitPane categories={categories} />
            </div>
        </div>
    )
}
