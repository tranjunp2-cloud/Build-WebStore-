import { getPayload } from 'payload'
import config from '@payload-config'
import { SEED_TEMPLATES } from '@/lib/ai/seed-templates'
import { composeTemplate, composeFromBlueprint } from '@/lib/ai/template-composer'
import { TEMPLATE_DEFINITIONS, TEMPLATE_PRESETS } from '@/lib/ai/template-definitions'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'

/**
 * POST /api/templates/seed
 * Seeds templates into the database.
 *
 * Modes:
 *   - Default (no query): seeds the original 10 industry templates (legacy)
 *   - ?v2=true: seeds ~48 composed templates from template-definitions (legacy v2)
 *   - ?v3=true: seeds 56 premium blueprint templates (NEW — Category DNA)
 *   - ?force=true: delete existing templates before seeding
 *   - ?dry=true: return composed seeds without writing to DB
 */
export const POST = withAuth(async (_user, request) => {
    try {
        const url = new URL(request.url)
        const force = url.searchParams.get('force') === 'true'
        const v2 = url.searchParams.get('v2') === 'true'
        const v3 = url.searchParams.get('v3') === 'true'
        const dry = url.searchParams.get('dry') === 'true'

        // ── v3: Blueprint-driven premium templates ─────────────────────
        if (v3) {
            if (TEMPLATE_PRESETS.length === 0) {
                return NextResponse.json({
                    success: false,
                    error: { code: 'NO_PRESETS', message: 'TEMPLATE_PRESETS is empty. Phase 3 blueprints not yet populated.' },
                }, { status: 400 })
            }

            const batchSize = 5
            const seeds = TEMPLATE_PRESETS.map((preset) => composeFromBlueprint(preset))

            if (dry) {
                return NextResponse.json({
                    success: true,
                    data: {
                        total: seeds.length,
                        created: 0, skipped: 0, failed: 0, dry: true,
                        templates: seeds.map((s) => ({
                            name: s.name,
                            category: s.category,
                            personality: TEMPLATE_PRESETS.find(p => p.name === s.name)?.personality ?? 'unknown',
                            isPremium: s.isPremium,
                            pageCount: s.pages.length,
                            blockCount: s.pages.reduce((acc, p) => acc + p.layout.length, 0),
                        })),
                    },
                })
            }

            const payload = await getPayload({ config })

            if (force) {
                const existing = await payload.find({ collection: 'templates', limit: 200, overrideAccess: true })
                for (const doc of existing.docs) {
                    await payload.delete({ collection: 'templates', id: doc.id, overrideAccess: true })
                }
                console.log(`[Seed v3] Deleted ${existing.totalDocs} existing templates`)
            }

            const results: { status: 'fulfilled' | 'rejected'; value?: { name: string; category: string; personality: string; status: string }; reason?: string }[] = []

            for (let i = 0; i < seeds.length; i += batchSize) {
                const batch = seeds.slice(i, i + batchSize)
                const batchResults = await Promise.allSettled(
                    batch.map(async (seed, idx) => {
                        const preset = TEMPLATE_PRESETS[i + idx]!
                        await payload.create({
                            collection: 'templates',
                            overrideAccess: true,
                            data: {
                                name: seed.name,
                                description: seed.description,
                                category: seed.category,
                                defaultTheme: seed.theme as Record<string, unknown>,
                                defaultBlocks: seed.pages[0]?.layout ?? [],
                                templatePages: seed.pages.map((page, pidx) => ({
                                    title: page.title || (pidx === 0 ? 'Home' : `Page ${pidx + 1}`),
                                    slug: page.slug || (pidx === 0 ? 'home' : `page-${pidx + 1}`),
                                    isHomepage: pidx === 0,
                                    layout: page.layout,
                                })),
                                tags: [seed.category, preset.personality, ...preset.tags].map(t => ({ tag: t })),
                                sortOrder: 0,
                                isPremium: true,
                                isFeatured: false,
                            },
                        })
                        return { name: seed.name, category: seed.category, personality: preset.personality, status: 'created' as const }
                    })
                )
                for (const r of batchResults) {
                    if (r.status === 'fulfilled') {
                        results.push({ status: 'fulfilled', value: r.value })
                    } else {
                        results.push({ status: 'rejected', reason: String(r.reason) })
                    }
                }
            }

            const created = results.filter((r) => r.status === 'fulfilled').length
            const failed = results.filter((r) => r.status === 'rejected').length

            return NextResponse.json({
                success: true,
                data: {
                    total: TEMPLATE_PRESETS.length,
                    created, skipped: 0, failed,
                    templates: results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value),
                },
            })
        }

        // ── v2: Composed templates (legacy) ────────────────────────────
        if (v2) {
            const batchSize = 10
            const seeds = TEMPLATE_DEFINITIONS.map((def) => composeTemplate(def))

            if (dry) {
                return NextResponse.json({
                    success: true,
                    data: {
                        total: seeds.length,
                        created: 0,
                        skipped: 0,
                        failed: 0,
                        dry: true,
                        templates: seeds.map((s) => ({
                            name: s.name,
                            category: s.category,
                            tier: s.tier,
                            isPremium: s.isPremium,
                            pageCount: s.pages.length,
                            blockCount: s.pages.reduce((acc, p) => acc + p.layout.length, 0),
                        })),
                    },
                })
            }

            const payload = await getPayload({ config })

            // Force mode: delete existing templates first
            if (force) {
                const existing = await payload.find({ collection: 'templates', limit: 200 })
                for (const doc of existing.docs) {
                    await payload.delete({ collection: 'templates', id: doc.id })
                }
                console.log(`[Seed v2] Deleted ${existing.totalDocs} existing templates`)
            }

            const results: { status: 'fulfilled' | 'rejected'; value?: { name: string; category: string; tier: string; status: string }; reason?: string }[] = []

            for (let i = 0; i < seeds.length; i += batchSize) {
                const batch = seeds.slice(i, i + batchSize)
                const batchResults = await Promise.allSettled(
                    batch.map(async (seed) => {
                        await payload.create({
                            collection: 'templates',
                            data: {
                                name: seed.name,
                                description: seed.description,
                                category: seed.category,
                                defaultTheme: seed.theme as Record<string, unknown>,
                                defaultBlocks: seed.pages[0]?.layout ?? [],
                                templatePages: seed.pages.map((page, idx) => ({
                                    title: page.title || (idx === 0 ? 'Home' : `Page ${idx + 1}`),
                                    slug: page.slug || (idx === 0 ? 'home' : `page-${idx + 1}`),
                                    isHomepage: idx === 0,
                                    layout: page.layout,
                                })),
                                tags: [seed.category, seed.tier],
                                sortOrder: 0,
                                isPremium: seed.isPremium,
                                isFeatured: false,
                            },
                        })
                        return { name: seed.name, category: seed.category, tier: seed.tier, status: 'created' as const }
                    })
                )
                for (const r of batchResults) {
                    if (r.status === 'fulfilled') {
                        results.push({ status: 'fulfilled', value: r.value })
                    } else {
                        results.push({ status: 'rejected', reason: String(r.reason) })
                    }
                }
            }

            const created = results.filter((r) => r.status === 'fulfilled').length
            const failed = results.filter((r) => r.status === 'rejected').length

            return NextResponse.json({
                success: true,
                data: {
                    total: TEMPLATE_DEFINITIONS.length,
                    created,
                    skipped: 0,
                    failed,
                    templates: results
                        .filter((r) => r.status === 'fulfilled' && r.value)
                        .map((r) => r.value),
                },
            })
        }

        // ── Legacy: Original 10 industry templates ──────────────────────
        const payload = await getPayload({ config })
        const existing = await payload.find({ collection: 'templates', limit: 100 })

        if (existing.totalDocs > 0 && !force) {
            return NextResponse.json({
                success: false,
                error: { code: 'ALREADY_SEEDED', message: `${existing.totalDocs} templates already exist. Use ?force=true to delete and re-seed.` },
            }, { status: 409 })
        }

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
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Template seeding failed'
        console.error('Seed error:', error)
        return NextResponse.json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message },
        }, { status: 500 })
    }
})
