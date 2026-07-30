/**
 * Seed IMAGE_LIBRARY photos for a site by searching Unsplash per category.
 * Called fire-and-forget from generate-site route. Never throws.
 *
 * GH-727 Phase 04: dynamic per-site search replaces fixed photo IDs so each
 * generated site gets a unique set of images instead of shared stock photos.
 *
 * Server-only. Do NOT import from client components.
 */

import type { Payload } from 'payload'
import { searchPhotos, downloadPhotoBuffer, PIXABAY_CATEGORY_BY_COMPOSER } from '@/lib/ai/pixabay-client'
import { normalizeComposerCategory } from '@/lib/ai/composer-category-resolver'
import { uploadBufferToMedia } from '@/lib/ai/media-pipeline'
import { createF38StockInfrastructure } from '@/lib/media/stock-adapter'
import type { ReservoirKind, ResolvedImage } from '@/lib/ai/image-sourcing/contracts'
import { buildSiteAltKey, siteAltKeyPrefix } from './image-library-keys'

// ── Search query per category+slot type ─────────────────────────────────────

const GALLERY_QUERIES: Record<string, string> = {
    fnb: 'cafe coffee latte barista',
    restaurant: 'restaurant dining gourmet food',
    ecommerce: 'fashion retail boutique products',
    beauty: 'beauty salon skincare spa',
    fitness: 'gym fitness workout exercise',
    health: 'healthcare clinic medical wellness',
    education: 'classroom education learning school',
    realestate: 'luxury home real estate interior',
    events: 'wedding flowers event venue',
    travel: 'travel destination hotel resort',
    creative: 'creative studio art portfolio',
    tech: 'technology startup modern office',
    business: 'business corporate professional office',
    blog: 'creative workspace writing desk',
}

const HERO_QUERIES: Record<string, string> = {
    fnb: 'cafe interior coffee shop ambiance',
    restaurant: 'restaurant elegant interior dining',
    ecommerce: 'fashion store boutique window display',
    beauty: 'beauty spa interior luxurious',
    fitness: 'gym interior fitness equipment',
    health: 'clinic hospital bright modern',
    education: 'school campus learning environment',
    realestate: 'luxury home architecture modern',
    events: 'wedding venue ballroom elegant',
    travel: 'resort hotel luxury destination',
    creative: 'creative studio artist workspace',
    tech: 'modern tech office open space',
    business: 'corporate office building professional',
    blog: 'home office desk creative setup',
}

// ── Slot definitions ─────────────────────────────────────────────────────────

interface SlotDef {
    slot: string
    queryCandidates: string[]
    imgixW: number
    imgixH: number
    orientation: 'landscape' | 'portrait' | 'squarish'
}

function buildProductQueryCandidates(productTerms?: string | null): string[] {
    if (!productTerms) return []

    const tokens = productTerms
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .slice(0, 3)

    const candidates = [
        tokens.join(' '),
        tokens.slice(0, 2).join(' '),
        tokens.slice(0, 1).join(' '),
    ].filter(Boolean)

    return Array.from(new Set(candidates))
}

function buildSearchCandidates(baseQuery: string, productTerms?: string | null): string[] {
    const productCandidates = buildProductQueryCandidates(productTerms)
    return productCandidates.length > 0 ? productCandidates : [baseQuery]
}

function queryGroupKey(slot: SlotDef): string {
    return `${slot.queryCandidates.join('||')}:${slot.orientation}`
}

function buildSlots(category: string, productTerms?: string | null): SlotDef[] {
    const baseGalleryQ = GALLERY_QUERIES[category] ?? GALLERY_QUERIES['business']!
    const baseHeroQ = HERO_QUERIES[category] ?? HERO_QUERIES['business']!

    const galleryQueries = buildSearchCandidates(baseGalleryQ, productTerms)
    const heroQueries = buildSearchCandidates(baseHeroQ, productTerms)
    return [
        ...Array.from({ length: 6 }, (_, i) => ({
            slot: `gallery[${i}]`, queryCandidates: galleryQueries, imgixW: 800, imgixH: 800, orientation: 'squarish' as const,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
            slot: `hero[${i}]`, queryCandidates: heroQueries, imgixW: 1400, imgixH: 800, orientation: 'landscape' as const,
        })),
        { slot: 'about', queryCandidates: galleryQueries, imgixW: 1200, imgixH: 800, orientation: 'landscape' as const },
        ...Array.from({ length: 4 }, (_, i) => ({
            slot: `team[${i}]`, queryCandidates: ['professional portrait person'], imgixW: 400, imgixH: 400, orientation: 'squarish' as const,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
            slot: `features[${i}]`, queryCandidates: galleryQueries, imgixW: 600, imgixH: 400, orientation: 'landscape' as const,
        })),
    ]
}

// ── Semaphore ────────────────────────────────────────────────────────────────

class Semaphore {
    private queue: Array<() => void> = []
    private active = 0
    constructor(private readonly max: number) { }

    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.max) {
            await new Promise<void>((resolve) => this.queue.push(resolve))
        }
        this.active++
        try {
            return await fn()
        } finally {
            this.active--
            const next = this.queue.shift()
            if (next) next()
        }
    }
}

const CONCURRENCY = 3

// ── Main export ──────────────────────────────────────────────────────────────

export interface SeededImageMapping {
    hero: number[]
    gallery: number[]
    about: number | null
    team: number[]
    features: number[]
}

function assignmentEntries(mapping: SeededImageMapping): Array<{ slot: string; mediaId: number }> {
    return [
        ...mapping.hero.map((mediaId, index) => ({ slot: `hero[${index}]`, mediaId })),
        ...mapping.gallery.map((mediaId, index) => ({ slot: `gallery[${index}]`, mediaId })),
        ...(mapping.about == null ? [] : [{ slot: 'about', mediaId: mapping.about }]),
        ...mapping.team.map((mediaId, index) => ({ slot: `team[${index}]`, mediaId })),
        ...mapping.features.map((mediaId, index) => ({ slot: `features[${index}]`, mediaId })),
    ]
}

/**
 * Persist per-site slot ownership without copying global catalog Media rows.
 * The assignment table is internal and additive; repeated generation upserts
 * the same site/slot pair deterministically.
 */
export async function persistF38ImageLibraryAssignments(
    payload: Payload,
    siteId: number | string,
    mapping: SeededImageMapping,
): Promise<number> {
    const numericSiteId = Number(siteId)
    if (!Number.isSafeInteger(numericSiteId) || numericSiteId <= 0) return 0
    const entries = assignmentEntries(mapping)
        .filter(({ mediaId }) => Number.isSafeInteger(mediaId) && mediaId > 0)

    const infrastructure = createF38StockInfrastructure(payload)
    const persisted = await infrastructure.replaceSiteStockAssignments(numericSiteId, entries)
    return persisted.length
}

function appendMappedSlot(mapping: SeededImageMapping, slot: string, mediaId: number): void {
    if (slot.startsWith('gallery')) mapping.gallery.push(mediaId)
    else if (slot.startsWith('hero')) mapping.hero.push(mediaId)
    else if (slot === 'about') mapping.about = mediaId
    else if (slot.startsWith('team')) mapping.team.push(mediaId)
    else if (slot.startsWith('features')) mapping.features.push(mediaId)
}

function reservoirForLibrarySlot(slot: string): ReservoirKind {
    if (slot.startsWith('gallery')) return 'square'
    if (slot.startsWith('team')) return 'people'
    return 'landscape'
}

async function seedF38ImageLibraryForSite(
    payload: Payload,
    tenantId: number | string,
    siteId: number | string,
    category: string,
    slotFilter?: (slot: string) => boolean,
    productTerms?: string | null,
): Promise<SeededImageMapping> {
    const mapping: SeededImageMapping = {
        hero: [],
        gallery: [],
        about: null,
        team: [],
        features: [],
    }
    const numericSiteId = Number(siteId)
    if (!Number.isSafeInteger(numericSiteId) || numericSiteId <= 0) return mapping

    try {
        const infrastructure = createF38StockInfrastructure(payload)
        const existing = await infrastructure.readSiteStockAssignments(numericSiteId)
        if (existing.length > 0) {
            for (const assignment of existing) {
                if (!slotFilter || slotFilter(assignment.slot)) {
                    appendMappedSlot(mapping, assignment.slot, assignment.mediaId)
                }
            }
            return mapping
        }

        const slots = buildSlots(category, productTerms)
            .filter((slot) => !slotFilter || slotFilter(slot.slot))
        const counts: Record<ReservoirKind, number> = {
            landscape: 0,
            square: 0,
            people: 0,
            products: 0,
            blogs: 0,
        }
        for (const slot of slots) counts[reservoirForLibrarySlot(slot.slot)]++

        const normalizedCategory = normalizeComposerCategory(category)
        const subject =
            buildProductQueryCandidates(productTerms)[0] ||
            GALLERY_QUERIES[normalizedCategory] ||
            GALLERY_QUERIES.business!
        const demands = (['landscape', 'square', 'people'] as const)
            .filter((kind) => counts[kind] > 0)
            .map((kind) => ({
                kind,
                count: counts[kind],
                subject: kind === 'people' ? 'professional portrait' : subject,
                category: kind === 'people' ? 'people' : normalizedCategory,
                aiEligible: false,
            }))
        if (demands.length === 0) return mapping

        const { createF38RuntimeResolver } = await import('@/lib/ai/image-sourcing')
        const resolver = createF38RuntimeResolver(payload, {
            tenantId: String(tenantId),
            businessName: `Site ${siteId}`,
            category: normalizedCategory,
            products: productTerms ? [productTerms] : undefined,
        })
        const resolution = await resolver.resolveF38ImageDemand({ demands })
        const reservoirIds = (kind: ReservoirKind): number[] =>
            resolution.reservoirs[kind]
                .map((image: ResolvedImage) => image.mediaId)
                .map((id) => typeof id === 'number' ? id : Number(id))
                .filter((id) => Number.isSafeInteger(id) && id > 0)
        const offsets: Record<ReservoirKind, number> = {
            landscape: 0,
            square: 0,
            people: 0,
            products: 0,
            blogs: 0,
        }
        for (const slot of slots) {
            const kind = reservoirForLibrarySlot(slot.slot)
            const mediaId = reservoirIds(kind)[offsets[kind]++]
            if (mediaId != null) appendMappedSlot(mapping, slot.slot, mediaId)
        }
        await persistF38ImageLibraryAssignments(payload, numericSiteId, mapping)
    } catch (err) {
        console.warn('[seeder] F38 seed failed', err instanceof Error ? err.message : err)
    }
    return mapping
}

/**
 * Seed IMAGE_LIBRARY for a site by searching Unsplash with category keywords.
 * Each site gets a unique set of photos. Idempotent per site (skips if already seeded).
 *
 * Never throws. All slot errors logged as warnings.
 */
export async function seedImageLibraryForSite(
    payload: Payload,
    tenantId: number | string,
    siteId: number | string,
    category: string,
    slotFilter?: (slot: string) => boolean,
    productTerms?: string | null,
): Promise<SeededImageMapping> {
    if (process.env.F38_IMAGE_PIPELINE === 'true') {
        return seedF38ImageLibraryForSite(
            payload,
            tenantId,
            siteId,
            category,
            slotFilter,
            productTerms,
        )
    }
    const start = Date.now()
    const mapping: SeededImageMapping = { hero: [], gallery: [], about: null, team: [], features: [] }

    try {
        const prefix = siteAltKeyPrefix(siteId)

        if (slotFilter) {
            // Partial seed: check if the first gallery slot already exists to prevent duplicates
            const firstKey = buildSiteAltKey(siteId, 'gallery[0]')
            const galCheck = await payload.find({
                collection: 'media',
                where: { alt: { equals: firstKey } },
                limit: 1,
                depth: 0,
            })
            if (galCheck.docs.length > 0) {
                console.info(`[seeder] site=${siteId} gallery already seeded — skipping`)
                // Returns empty SeededImageMapping — callers must re-query resolveImageLibraryS3Map for the live slot→url map.
                return mapping
            }
        } else {
            // Full seed: skip if any slot for this site already exists.
            // NOTE: Payload `like` performs substring match (ILIKE '%value%'), not prefix match.
            // Safe here because alt keys start with 'imglib:s{N}:' — the prefix cannot appear mid-value.
            // The resolver adds a secondary startsWith guard for extra safety.
            const existing = await payload.find({
                collection: 'media',
                where: { alt: { like: prefix } },
                limit: 1,
                depth: 0,
            })
            if (existing.docs.length > 0) {
                console.info(`[seeder] site=${siteId} already seeded (${existing.totalDocs} slots) — skipping`)
                // Returns empty SeededImageMapping — callers must re-query resolveImageLibraryS3Map for the live slot→url map.
                return mapping
            }
        }

        const allSlots = buildSlots(category, productTerms)
        const slots = slotFilter ? allSlots.filter(s => slotFilter(s.slot)) : allSlots
        const sem = new Semaphore(CONCURRENCY)
        let uploaded = 0
        let failed = 0

        // Group slots by query candidates + orientation — search separately per orientation so
        // landscape hero/about slots get properly oriented source images.
        const queryGroups = new Map<string, SlotDef[]>()
        for (const slot of slots) {
            const key = queryGroupKey(slot)
            const group = queryGroups.get(key) ?? []
            group.push(slot)
            queryGroups.set(key, group)
        }

        // Search Pixabay once per unique query+orientation, retrying with progressively
        // shorter product-focused queries when the more specific query returns zero hits.
        const photosByKey = new Map<string, Awaited<ReturnType<typeof searchPhotos>>>()
        for (const [key, groupSlots] of queryGroups) {
            const { queryCandidates, orientation } = groupSlots[0]!
            // Pixabay ships fixed sizes — request the largest size any slot in this
            // group needs; Payload regenerates per-variant sizes on upload anyway.
            const groupWidth = Math.max(...groupSlots.map((s) => s.imgixW))
            const pixCategory = PIXABAY_CATEGORY_BY_COMPOSER[normalizeComposerCategory(category)]
            let photos: Awaited<ReturnType<typeof searchPhotos>> = []

            for (const query of queryCandidates) {
                try {
                    photos = await searchPhotos(query, 10, { orientation, width: groupWidth, category: pixCategory })
                    if (photos.length > 0) break
                } catch (err) {
                    console.warn('[seeder] search failed for query', query, err instanceof Error ? err.message : err)
                }
            }

            photosByKey.set(key, photos)
        }

        // Assign a unique photo to each slot (rotate through results)
        const queryIndexes = new Map<string, number>()
        const slotPhotoAssignments: Array<{ slotDef: SlotDef; photoUrl: string | null }> = []

        for (const slotDef of slots) {
            const key = queryGroupKey(slotDef)
            const photos = photosByKey.get(key) ?? []
            if (photos.length === 0) {
                slotPhotoAssignments.push({ slotDef, photoUrl: null })
                continue
            }
            const idx = queryIndexes.get(key) ?? 0
            const photo = photos[idx % photos.length]!
            queryIndexes.set(key, idx + 1)
            // photo.url is already sized by the client (Pixabay fixed sizes).
            slotPhotoAssignments.push({ slotDef, photoUrl: photo.url })
        }

        // Upload all slots in parallel (bounded by semaphore)
        const results = await Promise.all(
            slotPhotoAssignments.map(({ slotDef, photoUrl }) =>
                sem.run(async () => {
                    const altKey = buildSiteAltKey(siteId, slotDef.slot)
                    // Per-slot findOrCreate: if this slot was already uploaded by a concurrent
                    // seeder call that raced past the top-level prefix check, reuse the existing doc.
                    const existing = await payload.find({
                        collection: 'media',
                        where: { alt: { equals: altKey } },
                        limit: 1,
                        depth: 0,
                    })
                    if (existing.docs.length > 0) {
                        return { slot: slotDef.slot, id: existing.docs[0]!.id as number }
                    }
                    if (!photoUrl) { failed++; return { slot: slotDef.slot, id: null } }
                    try {
                        const { buffer, mimetype } = await downloadPhotoBuffer(photoUrl)
                        const ext = mimetype.includes('png') ? 'png' : 'jpg'
                        const filename = `imglib-s${siteId}-${slotDef.slot.replace(/[[\].]/g, '-')}-${Date.now()}.${ext}`
                        const id = await uploadBufferToMedia(
                            payload as unknown as Parameters<typeof uploadBufferToMedia>[0],
                            { buffer, filename, mimetype, alt: altKey, tenantId: String(tenantId) },
                        )
                        uploaded++
                        return { slot: slotDef.slot, id }
                    } catch (err) {
                        failed++
                        console.warn('[seeder] slot failed', slotDef.slot, err instanceof Error ? err.message : err)
                        return { slot: slotDef.slot, id: null }
                    }
                }),
            ),
        )

        for (const { slot, id } of results) {
            if (id === null) continue
            if (slot.startsWith('gallery')) mapping.gallery.push(id)
            else if (slot.startsWith('hero')) mapping.hero.push(id)
            else if (slot === 'about') mapping.about = id
            else if (slot.startsWith('team')) mapping.team.push(id)
            else if (slot.startsWith('features')) mapping.features.push(id)
        }

        const timeMs = Date.now() - start
        console.info(
            `[seeder] cat=${category} site=${siteId} uploaded=${uploaded} failed=${failed} time=${timeMs}ms`,
        )
    } catch (err) {
        console.error('[seeder] unexpected error', err instanceof Error ? err.message : err)
    }

    return mapping
}
