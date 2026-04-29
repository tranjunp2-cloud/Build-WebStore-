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
import { searchPhotos, downloadPhotoBuffer, trackDownload, buildImgixUrl } from '@/lib/ai/unsplash-client'
import { uploadBufferToMedia } from '@/lib/ai/media-pipeline'
import { buildSiteAltKey, siteAltKeyPrefix } from './image-library-keys'

// ── Search query per category+slot type ─────────────────────────────────────

const GALLERY_QUERIES: Record<string, string> = {
    fnb:        'cafe coffee latte barista',
    restaurant: 'restaurant dining gourmet food',
    ecommerce:  'fashion retail boutique products',
    beauty:     'beauty salon skincare spa',
    fitness:    'gym fitness workout exercise',
    health:     'healthcare clinic medical wellness',
    education:  'classroom education learning school',
    realestate: 'luxury home real estate interior',
    events:     'wedding flowers event venue',
    travel:     'travel destination hotel resort',
    creative:   'creative studio art portfolio',
    tech:       'technology startup modern office',
    business:   'business corporate professional office',
    blog:       'creative workspace writing desk',
}

const HERO_QUERIES: Record<string, string> = {
    fnb:        'cafe interior coffee shop ambiance',
    restaurant: 'restaurant elegant interior dining',
    ecommerce:  'fashion store boutique window display',
    beauty:     'beauty spa interior luxurious',
    fitness:    'gym interior fitness equipment',
    health:     'clinic hospital bright modern',
    education:  'school campus learning environment',
    realestate: 'luxury home architecture modern',
    events:     'wedding venue ballroom elegant',
    travel:     'resort hotel luxury destination',
    creative:   'creative studio artist workspace',
    tech:       'modern tech office open space',
    business:   'corporate office building professional',
    blog:       'home office desk creative setup',
}

// ── Slot definitions ─────────────────────────────────────────────────────────

interface SlotDef {
    slot: string
    query: string
    imgixW: number
    imgixH: number
    orientation: 'landscape' | 'portrait' | 'squarish'
}

function buildSlots(category: string): SlotDef[] {
    const galleryQ = GALLERY_QUERIES[category] ?? GALLERY_QUERIES['business']!
    const heroQ = HERO_QUERIES[category] ?? HERO_QUERIES['business']!
    return [
        ...Array.from({ length: 6 }, (_, i) => ({
            slot: `gallery[${i}]`, query: galleryQ, imgixW: 800, imgixH: 800, orientation: 'squarish' as const,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
            slot: `hero[${i}]`, query: heroQ, imgixW: 1400, imgixH: 800, orientation: 'landscape' as const,
        })),
        { slot: 'about', query: galleryQ, imgixW: 1200, imgixH: 800, orientation: 'landscape' as const },
        ...Array.from({ length: 4 }, (_, i) => ({
            slot: `team[${i}]`, query: 'professional portrait person', imgixW: 400, imgixH: 400, orientation: 'squarish' as const,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
            slot: `features[${i}]`, query: galleryQ, imgixW: 600, imgixH: 400, orientation: 'landscape' as const,
        })),
    ]
}

// ── Semaphore ────────────────────────────────────────────────────────────────

class Semaphore {
    private queue: Array<() => void> = []
    private active = 0
    constructor(private readonly max: number) {}

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
): Promise<SeededImageMapping> {
    const start = Date.now()
    const mapping: SeededImageMapping = { hero: [], gallery: [], about: null, team: [], features: [] }

    try {
        // Idempotency: skip if this site already has any seeded images
        const prefix = siteAltKeyPrefix(siteId)
        const existing = await payload.find({
            collection: 'media',
            where: { alt: { like: prefix } },
            limit: 1,
            depth: 0,
        })
        if (existing.docs.length > 0) {
            console.info(`[seeder] site=${siteId} already seeded (${existing.totalDocs} slots) — skipping`)
            // Build mapping from existing docs for caller convenience
            return mapping
        }

        const slots = buildSlots(category)
        const sem = new Semaphore(CONCURRENCY)
        let uploaded = 0
        let failed = 0

        // Group slots by query+orientation — search separately per orientation so
        // landscape hero/about slots get properly oriented source images.
        const queryGroups = new Map<string, SlotDef[]>()
        for (const slot of slots) {
            const key = `${slot.query}:${slot.orientation}`
            const group = queryGroups.get(key) ?? []
            group.push(slot)
            queryGroups.set(key, group)
        }

        // Search Unsplash once per unique query+orientation, then distribute photos to slots
        const photosByKey = new Map<string, Awaited<ReturnType<typeof searchPhotos>>>()
        for (const [key, groupSlots] of queryGroups) {
            const { query, orientation } = groupSlots[0]!
            try {
                const photos = await searchPhotos(query, 10, { orientation })
                photosByKey.set(key, photos)
            } catch (err) {
                console.warn('[seeder] search failed for query', query, err instanceof Error ? err.message : err)
                photosByKey.set(key, [])
            }
        }

        // Assign a unique photo to each slot (rotate through results)
        const queryIndexes = new Map<string, number>()
        const slotPhotoAssignments: Array<{ slotDef: SlotDef; photoUrl: string | null; downloadLocation: string | null }> = []

        for (const slotDef of slots) {
            const key = `${slotDef.query}:${slotDef.orientation}`
            const photos = photosByKey.get(key) ?? []
            if (photos.length === 0) {
                slotPhotoAssignments.push({ slotDef, photoUrl: null, downloadLocation: null })
                continue
            }
            const idx = queryIndexes.get(key) ?? 0
            const photo = photos[idx % photos.length]!
            queryIndexes.set(key, idx + 1)
            const url = buildImgixUrl(photo.urls.raw, { w: slotDef.imgixW, h: slotDef.imgixH, fit: 'crop' })
            slotPhotoAssignments.push({ slotDef, photoUrl: url, downloadLocation: photo.links.download_location })
        }

        // Upload all slots in parallel (bounded by semaphore)
        const results = await Promise.all(
            slotPhotoAssignments.map(({ slotDef, photoUrl, downloadLocation }) =>
                sem.run(async () => {
                    if (!photoUrl) { failed++; return { slot: slotDef.slot, id: null } }
                    try {
                        const { buffer, mimetype } = await downloadPhotoBuffer(photoUrl)
                        // Track only after buffer is confirmed downloaded (Unsplash API terms)
                        if (downloadLocation) trackDownload(downloadLocation)
                        const ext = mimetype.includes('png') ? 'png' : 'jpg'
                        const filename = `imglib-s${siteId}-${slotDef.slot.replace(/[[\].]/g, '-')}-${Date.now()}.${ext}`
                        const altKey = buildSiteAltKey(siteId, slotDef.slot)
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
