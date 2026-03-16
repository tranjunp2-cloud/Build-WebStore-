import { getPayload } from 'payload'
import config from '@payload-config'
import { SEED_TEMPLATES } from '@/lib/ai/seed-templates'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/templates/seed
 * Seeds the 10 industry-based templates into the database.
 * Pass ?force=true to delete existing templates and re-seed.
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config })
        const force = request.nextUrl.searchParams.get('force') === 'true'

        // Check if templates already exist
        const existing = await payload.find({ collection: 'templates', limit: 100 })

        if (existing.totalDocs > 0 && !force) {
            return NextResponse.json({
                success: false,
                error: { code: 'ALREADY_SEEDED', message: `${existing.totalDocs} templates already exist. Use ?force=true to delete and re-seed.` },
            }, { status: 409 })
        }

        // Force mode: delete all existing templates first
        if (existing.totalDocs > 0 && force) {
            for (const doc of existing.docs) {
                await payload.delete({ collection: 'templates', id: doc.id })
            }
            console.log(`[Seed] Deleted ${existing.totalDocs} existing templates`)
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
            data: { count: results.length, templates: results, reseeded: force },
        })
    } catch (error: any) {
        console.error('Seed error:', error)
        return NextResponse.json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message },
        }, { status: 500 })
    }
}
