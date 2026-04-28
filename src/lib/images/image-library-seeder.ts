/**
 * Seed IMAGE_LIBRARY photos for a site's category into Payload media (S3).
 * Called fire-and-forget from generate-site route. Never throws.
 *
 * GH-727: replaces broken Unsplash fallback gallery images with pre-verified
 * S3-backed media so every site has working image fallbacks from day 1.
 *
 * Server-only. Do NOT import from client components.
 */

import type { Payload } from 'payload'
import { IMAGE_LIBRARY } from '@/app/api/preview/renderers/images'
import { downloadPhotoBuffer } from '@/lib/ai/unsplash-client'
import { uploadBufferToMedia } from '@/lib/ai/media-pipeline'
import { extractPhotoId, buildAltKey } from './image-library-keys'

export interface SeededImageMapping {
    hero: number[]
    gallery: number[]
    about: number | null
    team: number[]
    features: number[]
}

/** Minimal semaphore for bounded parallelism — no extra deps. */
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

/**
 * Upload or reuse a single IMAGE_LIBRARY slot.
 * Idempotent: if a media doc with matching alt key already exists, returns its id.
 */
async function seedSlot(
    payload: Payload,
    tenantId: number | string,
    category: string,
    slot: string,
    url: string,
): Promise<number | null> {
    const photoId = extractPhotoId(url)
    const altKey = buildAltKey(category, slot, photoId)

    const { buffer, mimetype } = await downloadPhotoBuffer(url)
    const extension = mimetype.includes('png') ? 'png' : 'jpg'
    const filename = `imglib-${category}-${slot.replace(/[[\].]/g, '-')}-${Date.now()}.${extension}`

    const id = await uploadBufferToMedia(
        payload as unknown as Parameters<typeof uploadBufferToMedia>[0],
        {
            buffer,
            filename,
            mimetype,
            alt: altKey,
            tenantId: String(tenantId),
        },
    )
    return id
}

/**
 * Seed IMAGE_LIBRARY for a site's category into Payload media (S3).
 *
 * @param payload  Payload instance
 * @param tenantId tenant ID — used as owner + idempotency key
 * @param siteId   site ID — included in summary log
 * @param category composer category (e.g. 'restaurant', 'business')
 * @returns mapping of slot → media IDs (null/empty if upload failed)
 *
 * Never throws. All slot errors are logged as warnings.
 */
export async function seedImageLibraryForSite(
    payload: Payload,
    tenantId: number | string,
    siteId: number | string,
    category: string,
): Promise<SeededImageMapping> {
    const start = Date.now()
    const mapping: SeededImageMapping = {
        hero: [],
        gallery: [],
        about: null,
        team: [],
        features: [],
    }

    try {
        const images = IMAGE_LIBRARY[category] ?? IMAGE_LIBRARY['business']!
        const sem = new Semaphore(CONCURRENCY)

        let uploaded = 0
        let existing = 0
        let failed = 0

        // Helper to run a slot upload with error isolation
        const runSlot = async (slot: string, url: string): Promise<number | null> => {
            try {
                // Check idempotency to count as existing vs new
                const photoId = extractPhotoId(url)
                const altKey = buildAltKey(category, slot, photoId)
                const check = await payload.find({
                    collection: 'media',
                    // media has no tenant field — alt key is globally unique per (category,slot,photoId)
                    where: { alt: { equals: altKey } },
                    limit: 1,
                    depth: 0,
                })
                if (check.docs.length > 0) {
                    existing++
                    return check.docs[0]!.id as number
                }

                const id = await seedSlot(payload, tenantId, category, slot, url)
                if (id !== null) uploaded++
                return id
            } catch (err) {
                failed++
                console.warn('[seeder] slot failed', slot, err instanceof Error ? err.message : err)
                return null
            }
        }

        // Build task list with slot labels
        type SlotTask = { slot: string; url: string; type: keyof SeededImageMapping; index?: number }
        const tasks: SlotTask[] = [
            ...images.hero.map((url, i) => ({ slot: `hero[${i}]`, url, type: 'hero' as const, index: i })),
            ...images.gallery.map((url, i) => ({ slot: `gallery[${i}]`, url, type: 'gallery' as const, index: i })),
            ...(images.about ? [{ slot: 'about', url: images.about, type: 'about' as const }] : []),
            ...images.team.map((url, i) => ({ slot: `team[${i}]`, url, type: 'team' as const, index: i })),
            ...images.features.map((url, i) => ({ slot: `features[${i}]`, url, type: 'features' as const, index: i })),
        ]

        // Upload results preserving order
        const results = await Promise.all(
            tasks.map((task) =>
                sem.run(async () => {
                    const id = await runSlot(task.slot, task.url)
                    return { task, id }
                }),
            ),
        )

        for (const { task, id } of results) {
            if (id === null) continue
            if (task.type === 'about') {
                mapping.about = id
            } else {
                mapping[task.type].push(id)
            }
        }

        const timeMs = Date.now() - start
        console.info(
            `[seeder] cat=${category} tenant=${tenantId} site=${siteId} uploaded=${uploaded} existing=${existing} failed=${failed} time=${timeMs}ms`,
        )
    } catch (err) {
        console.error('[seeder] unexpected error', err instanceof Error ? err.message : err)
    }

    return mapping
}
