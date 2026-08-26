/**
 * GET /api/admin/packs/[id]/stats
 * Real-time content stats for a content pack:
 *   - strings: count of text/textarea fields across all linked templates' layouts
 *   - images: count of upload/image fields across layouts
 *   - products: count of products-grid / products-featured blocks
 * 60-second in-memory cache (per pack id). No denormalization needed.
 * Super-admin only, zod-validated id.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { getPayload } from 'payload'
import config from '@payload-config'

export type PackContentStats = {
    packId: string
    strings: number
    images: number
    products: number
    computedAt: string
}

// ── 60s in-memory cache keyed by pack id ────────────────────────────────────

const CACHE_TTL_MS = 60_000
const _cache = new Map<string, { stats: PackContentStats; expiresAt: number }>()

// ── Field detection heuristics on block JSON ─────────────────────────────────

const STRING_FIELD_KEYS = new Set([
    'headline', 'title', 'subtitle', 'description', 'body', 'text',
    'content', 'label', 'caption', 'cta', 'buttonText', 'name',
    'tagline', 'summary', 'bio', 'excerpt',
])

const IMAGE_FIELD_KEYS = new Set([
    'image', 'backgroundImage', 'logo', 'avatar', 'photo', 'thumbnail',
    'coverImage', 'banner', 'src', 'url',
])

// Block types that represent product listings
const PRODUCT_BLOCK_TYPES = new Set([
    'products-grid', 'products-featured', 'product-quick-view',
])

function countBlockFields(layout: unknown): { strings: number; images: number; products: number } {
    let strings = 0
    let images = 0
    let products = 0

    if (!Array.isArray(layout)) return { strings, images, products }

    for (const block of layout) {
        if (!block || typeof block !== 'object') continue
        const b = block as Record<string, unknown>

        // Count product blocks
        if (typeof b.blockType === 'string' && PRODUCT_BLOCK_TYPES.has(b.blockType)) {
            products++
        }

        // Walk block fields for strings and images
        for (const [key, val] of Object.entries(b)) {
            if (key === 'blockType' || key === 'id') continue
            if (typeof val === 'string' && val.trim().length > 0) {
                if (STRING_FIELD_KEYS.has(key)) strings++
                else if (IMAGE_FIELD_KEYS.has(key)) images++
            }
        }
    }

    return { strings, images, products }
}

// ── Zod schema ───────────────────────────────────────────────────────────────

const IdSchema = z.string().min(1).max(100)

type RouteContext = { params: Promise<{ id: string }> }

type TemplateDoc = {
    templatePages?: Array<{ layout?: unknown }> | null
    defaultBlocks?: unknown
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET = async (req: NextRequest, ctx: RouteContext) => {
    return withSuperAdmin(async () => {
        const rawId = (await ctx.params).id
        const idParsed = IdSchema.safeParse(rawId)
        if (!idParsed.success) {
            return NextResponse.json({ error: 'Invalid pack id' }, { status: 400 })
        }
        const packId = idParsed.data

        // Check cache
        const now = Date.now()
        const cached = _cache.get(packId)
        if (cached && now < cached.expiresAt) {
            return NextResponse.json({
                data: cached.stats,
                meta: { cached: true, ttlMs: cached.expiresAt - now },
                error: null,
            })
        }

        try {
            const payload = await getPayload({ config })

            // Fetch pack with included templates (depth:1 resolves relationships).
            // Cast via unknown — Payload's generic return type is JsonObject & TypeWithID which
            // conflicts with our local shape; the cast is safe because depth:1 resolves rels.
            let pack: { includedTemplates?: Array<{ id: string | number }> | null }
            try {
                pack = await payload.findByID({
                    collection: 'content-packs',
                    id: packId,
                    depth: 1,
                }) as unknown as { includedTemplates?: Array<{ id: string | number }> | null }
            } catch {
                return NextResponse.json({ error: 'Pack not found' }, { status: 404 })
            }

            const templateIds = (pack.includedTemplates ?? []).map((t) => t.id)

            let totalStrings = 0
            let totalImages = 0
            let totalProducts = 0

            if (templateIds.length > 0) {
                // Fetch all included templates' pages in one query (depth:0 for speed)
                const tmplResult = await (payload.find as (...a: unknown[]) => Promise<{ docs: unknown[] }>)({
                    collection: 'templates',
                    where: { id: { in: templateIds } },
                    limit: templateIds.length,
                    depth: 0,
                    select: { templatePages: true, defaultBlocks: true },
                })

                for (const doc of tmplResult.docs as TemplateDoc[]) {
                    // Prefer templatePages; fall back to defaultBlocks
                    const pages = Array.isArray(doc.templatePages) ? doc.templatePages : []
                    if (pages.length > 0) {
                        for (const page of pages) {
                            const counts = countBlockFields(page.layout)
                            totalStrings += counts.strings
                            totalImages += counts.images
                            totalProducts += counts.products
                        }
                    } else if (doc.defaultBlocks) {
                        const counts = countBlockFields(doc.defaultBlocks)
                        totalStrings += counts.strings
                        totalImages += counts.images
                        totalProducts += counts.products
                    }
                }
            }

            const stats: PackContentStats = {
                packId,
                strings: totalStrings,
                images: totalImages,
                products: totalProducts,
                computedAt: new Date().toISOString(),
            }

            // Store in cache
            _cache.set(packId, { stats, expiresAt: now + CACHE_TTL_MS })

            return NextResponse.json({
                data: stats,
                meta: { cached: false, templateCount: templateIds.length },
                error: null,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Internal error'
            return NextResponse.json({ error: msg }, { status: 500 })
        }
    })(req)
}
