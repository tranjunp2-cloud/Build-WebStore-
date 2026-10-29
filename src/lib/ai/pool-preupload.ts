/**
 * Pool photo pre-upload — Wave 2b (gen-perf plan 260703 phase-06).
 *
 * Today `buildImagePool` resolves ~3-5s into GPT generation, but the actual
 * download+upload of pool photos only happens post-GPT inside
 * `fulfillImageNeeds` (via `batchFetchFromPool`). That wastes the otherwise
 * idle ~25-60s GPT window. `preUploadPool` downloads + uploads every distinct
 * pool photo (landscape ∪ square ∪ portrait, deduped by id) DURING that
 * window so post-GPT `batchFetchFromPool` only does assignment.
 *
 * Downloads run with bounded concurrency (network-bound, safe to parallelize).
 * Media `create` calls are serialized via a strict promise chain — this
 * branch predates `media-create-lock.ts` (ships in PR #1481 / GH-1185, not on
 * this branch). Concurrent `payload.create` calls on the `media` collection
 * lose rows silently (drizzle transaction race, proven 2026-07-03) so we must
 * not let two creates run at once. After GH-1185 merges, `uploadBufferToMedia`
 * will serialize globally via `media-create-lock`; this local serialization
 * then becomes redundant but harmless.
 *
 * Flag-gated by `GEN_POOL_PREUPLOAD` in the caller (route.ts). This module
 * itself has no flag branching — it is simply not invoked when the flag is
 * off.
 *
 * Never throws — failed photos are absent from the returned map so callers
 * (`batchFetchFromPool`) transparently fall back to the inline download+upload
 * path for those photos.
 *
 * Server-only.
 */

import { downloadPhotoBuffer, registerPixabayMediaSource } from './pixabay-client'
import { uploadBufferToMedia, Semaphore } from './media-pipeline'
import type { ImagePool, PoolPhoto } from './image-pool'
import { buildStockAlt } from './stock-alt'

// Downloads are network-bound (Pixabay CDN, no rate limit) — 4 concurrent is
// conservative during the GPT window where we don't want to starve any other
// fetches (sample-product images) sharing the same egress.
const DOWNLOAD_CONCURRENCY = 4

/** Dedupe pool photos by id — square bucket may reuse landscape photos verbatim
 * when Pixabay squarish search underfills (see image-pool.ts fallback). One
 * upload, one Media ID, reused across every block role that picks it. */
function dedupePoolPhotos(pool: ImagePool): PoolPhoto[] {
    const seen = new Map<string, PoolPhoto>()
    for (const photo of [...pool.landscape, ...pool.square, ...pool.portrait]) {
        if (!seen.has(photo.id)) seen.set(photo.id, photo)
    }
    return Array.from(seen.values())
}

/**
 * Pre-upload every distinct photo in `pool` to Payload `media`, keyed by pool
 * photo id. Filename prefix `pool-` (vs `hero-`/`gallery-`/etc from the
 * per-block legacy path) so pre-uploaded rows are identifiable in storage.
 *
 * @returns Map<poolPhotoId, mediaId> — only successful uploads are present.
 */
export async function preUploadPool(
    pool: ImagePool,
    tenantId: string,
    businessName: string,
    payload: Parameters<typeof uploadBufferToMedia>[0],
): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    const photos = dedupePoolPhotos(pool)
    if (photos.length === 0) return result

    const sem = new Semaphore(DOWNLOAD_CONCURRENCY)
    // Strict FIFO chain for `payload.create` — see file header. Reassigning
    // `createChain` synchronously (no `await` between read and reassign)
    // guarantees creates queue in the order their downloads complete, with
    // no two creates ever in flight at once.
    let createChain: Promise<void> = Promise.resolve()

    await Promise.all(
        photos.map((photo) =>
            sem.run(async () => {
                let buffer: Buffer
                let mimetype: string
                try {
                    const downloaded = await downloadPhotoBuffer(photo.url)
                    buffer = downloaded.buffer
                    mimetype = downloaded.mimetype
                } catch (err) {
                    console.warn(
                        `[pool-preupload] download failed for ${photo.id}: ${err instanceof Error ? err.message : String(err)}`,
                    )
                    return
                }

                const extension = mimetype.includes('png') ? 'png' : 'jpg'
                const filename = `pool-${photo.id}-${Date.now()}.${extension}`
                const alt = buildStockAlt(photo.alt, businessName) || `${businessName} photo`

                const thisCreate = createChain.then(async () => {
                    try {
                        const id = await uploadBufferToMedia(payload, {
                            buffer,
                            filename,
                            mimetype,
                            alt,
                            tenantId,
                        })
                        result.set(photo.id, id)
                        registerPixabayMediaSource(id, photo.url)
                    } catch (err) {
                        console.warn(
                            `[pool-preupload] upload failed for ${photo.id}: ${err instanceof Error ? err.message : String(err)}`,
                        )
                    }
                })
                createChain = thisCreate
                await thisCreate
            }),
        ),
    )

    return result
}
