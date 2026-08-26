import { getPayload } from 'payload'
import config from '@payload-config'
import { SEED_TEMPLATES } from '@/lib/ai/seed-templates'
import { composeTemplate, composeFromBlueprint } from '@/lib/ai/template-composer'
import { TEMPLATE_DEFINITIONS, TEMPLATE_PRESETS } from '@/lib/ai/template-definitions'
import { computeBlockSchemaVersion } from '@/lib/ai/block-schema-version'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { timingSafeEqual } from 'node:crypto'

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
 *
 * Auth (checked in order, first match wins):
 *   - Internal: x-db-setup-key header matching PAYLOAD_SECRET (for db-setup.js auto-seed)
 *   - CI:       Authorization: Bearer $SEED_TOKEN (post-deploy seed, plan 260419-2022)
 *   - Normal:   withAuth (JWT) — super-admin required in production
 */

/**
 * Constant-time comparison for token strings. Falls back to `false` when
 * either side is empty or the lengths differ (timingSafeEqual requires equal
 * length Buffers, and length leakage is acceptable for this use case since
 * tokens have a fixed length).
 */
function safeTokenEquals(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false
    const bufA = Buffer.from(a, 'utf8')
    const bufB = Buffer.from(b, 'utf8')
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
}

// ── Internal seed logic (shared by both auth paths) ──────────────────────

async function handleSeed(request: Request): Promise<NextResponse> {
    try {
        const url = new URL(request.url)
        const force = url.searchParams.get('force') === 'true'
        const v2 = url.searchParams.get('v2') === 'true'
        const v3 = url.searchParams.get('v3') === 'true'
        const dry = url.searchParams.get('dry') === 'true'

        // Compute once per seed run — stamped on every inserted row so Phase
        // 02 drift validator can flag stale templates (plan 260419-2022 Phase 05).
        const blockSchemaVersion = computeBlockSchemaVersion()

        // ── v3: Blueprint-driven premium templates ─────────────────────
        if (v3) {
            if (TEMPLATE_PRESETS.length === 0) {
                return NextResponse.json({
                    success: false,
                    error: { code: 'NO_PRESETS', message: 'TEMPLATE_PRESETS is empty. Phase 3 blueprints not yet populated.' },
                }, { status: 400 })
            }

            const batchSize = 5
            // Plan 260415 fix-500 — composeFromBlueprint now returns null on
            // unrecoverable composer failure (unknown category / missing
            // content pack) instead of throwing. Keep the preset→seed pair so
            // index mapping stays correct, then filter null pairs out.
            const seedPairs = TEMPLATE_PRESETS.map((preset) => ({
                preset,
                seed: composeFromBlueprint(preset),
            }))
            const validPairs = seedPairs.filter(
                (p): p is { preset: typeof p.preset; seed: NonNullable<typeof p.seed> } => p.seed !== null,
            )
            const composerSkipped = seedPairs.length - validPairs.length
            const seeds = validPairs.map((p) => p.seed)

            if (dry) {
                return NextResponse.json({
                    success: true,
                    data: {
                        total: seeds.length,
                        created: 0, skipped: 0, failed: 0, dry: true,
                        composerSkipped,
                        templates: validPairs.map(({ preset, seed: s }) => ({
                            name: s.name,
                            category: s.category,
                            personality: preset.personality,
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

            // Check existing templates to skip duplicates
            const existingTemplates = await payload.find({ collection: 'templates', limit: 200, overrideAccess: true })
            const existingNames = new Set(existingTemplates.docs.map((d: any) => d.name))

            const results: { status: 'fulfilled' | 'rejected'; value?: { name: string; category: string; personality: string; status: string }; reason?: string }[] = []
            let skipped = 0

            for (let i = 0; i < validPairs.length; i += batchSize) {
                const batch = validPairs.slice(i, i + batchSize)
                const batchResults = await Promise.allSettled(
                    batch.map(async ({ preset, seed }) => {
                        if (existingNames.has(seed.name)) {
                            skipped++
                            return { name: seed.name, category: seed.category, personality: preset.personality, status: 'skipped' as const }
                        }
                        await payload.create({
                            collection: 'templates',
                            overrideAccess: true,
                            data: {
                                name: seed.name,
                                description: seed.description,
                                category: [seed.category],
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
                                blockSchemaVersion,
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

            const created = results.filter((r) => r.status === 'fulfilled' && r.value?.status === 'created').length
            const failed = results.filter((r) => r.status === 'rejected').length
            const failReasons = results.filter((r) => r.status === 'rejected').map((r) => r.reason).slice(0, 5)

            return NextResponse.json({
                success: true,
                data: {
                    total: TEMPLATE_PRESETS.length,
                    created, skipped, failed, failReasons,
                    templates: results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value),
                },
            })
        }

        // ── v2: Composed templates (legacy) ────────────────────────────
        if (v2) {
            const batchSize = 10
            // Plan 260415 fix-500 — composeTemplate returns null on failure.
            const seeds = TEMPLATE_DEFINITIONS
                .map((def) => composeTemplate(def))
                .filter((s): s is NonNullable<typeof s> => s !== null)

            if (dry) {
                return NextResponse.json({
                    success: true,
                    data: {
                        total: seeds.length,
                        created: 0, skipped: 0, failed: 0, dry: true,
                        templates: seeds.map((s) => ({
                            name: s.name, category: s.category, tier: s.tier,
                            isPremium: s.isPremium, pageCount: s.pages.length,
                            blockCount: s.pages.reduce((acc, p) => acc + p.layout.length, 0),
                        })),
                    },
                })
            }

            const payload = await getPayload({ config })

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
                                name: seed.name, description: seed.description,
                                category: seed.category,
                                defaultTheme: seed.theme as Record<string, unknown>,
                                defaultBlocks: seed.pages[0]?.layout ?? [],
                                templatePages: seed.pages.map((page, idx) => ({
                                    title: page.title || (idx === 0 ? 'Home' : `Page ${idx + 1}`),
                                    slug: page.slug || (idx === 0 ? 'home' : `page-${idx + 1}`),
                                    isHomepage: idx === 0, layout: page.layout,
                                })),
                                tags: [seed.category, seed.tier],
                                sortOrder: 0, isPremium: seed.isPremium, isFeatured: false,
                                blockSchemaVersion,
                            },
                        })
                        return { name: seed.name, category: seed.category, tier: seed.tier, status: 'created' as const }
                    })
                )
                for (const r of batchResults) {
                    if (r.status === 'fulfilled') results.push({ status: 'fulfilled', value: r.value })
                    else results.push({ status: 'rejected', reason: String(r.reason) })
                }
            }

            return NextResponse.json({
                success: true,
                data: {
                    total: TEMPLATE_DEFINITIONS.length,
                    created: results.filter((r) => r.status === 'fulfilled').length,
                    skipped: 0,
                    failed: results.filter((r) => r.status === 'rejected').length,
                    templates: results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value),
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
                    name: tpl.name, description: tpl.description, category: tpl.category,
                    defaultTheme: tpl.defaultTheme, defaultBlocks: tpl.defaultBlocks,
                    tags: tpl.tags, sortOrder: tpl.sortOrder,
                    isPremium: tpl.isPremium, isFeatured: tpl.isFeatured,
                    blockSchemaVersion,
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
}

// ── Route handler with tri-auth ──────────────────────────────────────────
// 1. Internal: x-db-setup-key header matching PAYLOAD_SECRET (db-setup.js auto-seed)
// 2. CI:       Authorization: Bearer $SEED_TOKEN (CI post-deploy seed — plan 260419-2022)
// 3. External: withAuth JWT — super-admin required in production

export async function POST(request: Request) {
    // (1) Internal auth — same-container db-setup.js auto-seed
    const internalKey = request.headers.get('x-db-setup-key')
    const payloadSecret = process.env.PAYLOAD_SECRET
    if (internalKey && payloadSecret && internalKey === payloadSecret) {
        console.log('[Seed] Internal auth via x-db-setup-key — bypassing JWT')
        return handleSeed(request)
    }

    // (2) CI auth — Bearer SEED_TOKEN (constant-time compare)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const seedToken = process.env.SEED_TOKEN
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const presented = authHeader.slice('Bearer '.length).trim()
        if (seedToken && safeTokenEquals(presented, seedToken)) {
            console.log('[Seed] CI auth via Bearer SEED_TOKEN — bypassing JWT')
            return handleSeed(request)
        }
        // Bearer present but does not match → reject without falling through to JWT.
        return NextResponse.json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid seed token' },
        }, { status: 401 })
    }

    // (3) Fall back to normal JWT auth
    return withAuthSeed(request, {} as never)
}

const withAuthSeed = withAuth(async (_user, req) => {
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    const roles = (_user as { roles?: string[] })?.roles || []
    if (!isDev && !roles.includes('super-admin')) {
        return NextResponse.json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only super-admin can seed templates' },
        }, { status: 403 })
    }
    return handleSeed(req)
})
