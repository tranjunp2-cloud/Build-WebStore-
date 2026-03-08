import { getPayload } from 'payload'
import config from '@payload-config'
import { SEED_TEMPLATES } from '@/lib/ai/seed-templates'
import { NextResponse } from 'next/server'

/**
 * POST /api/templates/seed
 * Seeds the 10 industry-based templates into the database.
 */
export async function POST() {
    try {
        const payload = await getPayload({ config })

        // Check if templates already exist
        const existing = await payload.find({ collection: 'templates', limit: 1 })
        if (existing.totalDocs > 0) {
            return NextResponse.json({
                success: false,
                error: { code: 'ALREADY_SEEDED', message: `${existing.totalDocs} templates already exist. Delete them first to re-seed.` },
            }, { status: 409 })
        }

        const results = []
        for (const tpl of SEED_TEMPLATES) {
            const doc = await payload.create({
                collection: 'templates',
                data: {
                    name: tpl.name,
                    description: tpl.description,
                    category: tpl.category,
                    defaultTheme: tpl.defaultTheme,
                    defaultBlocks: tpl.defaultBlocks,
                    tags: tpl.tags,
                    sortOrder: tpl.sortOrder,
                    isPremium: tpl.isPremium,
                    isFeatured: tpl.isFeatured,
                },
            })
            results.push({ id: doc.id, name: doc.name })
        }

        return NextResponse.json({
            success: true,
            data: { count: results.length, templates: results },
        })
    } catch (error: any) {
        console.error('Seed error:', error)
        return NextResponse.json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message },
        }, { status: 500 })
    }
}
