/**
 * /studio/categories — Category DNA editor (split-pane).
 * Bundle: CategoriesPage pattern from pages.jsx.
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="cat-page-head">
                <div>
                    <h1 className="cat-page-title">Categories &amp; Category DNA</h1>
                    <p className="cat-page-sub">
                        Mỗi ngành có &quot;DNA&quot; riêng: signature blocks, mandatory order, personalities — AI dùng DNA này để gen template đúng chuẩn ngành.
                    </p>
                </div>
            </div>
            <CategorySplitPane categories={categories} />
        </div>
    )
}
