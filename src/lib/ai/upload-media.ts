/**
 * Shared media upload helper for AI generation flows.
 * Downloads an image URL and creates a tenant-scoped Payload Media record.
 * Returns Media ID or undefined on failure (caller decides fatal/non-fatal).
 */

import type { BasePayload } from 'payload'
import { downloadPhotoBuffer } from './pixabay-client'
import { withMediaCreateLock } from './media-create-lock'

export async function uploadImageUrl(
    imageUrl: string,
    filename: string,
    alt: string,
    tenantId: number | string,
    payload: BasePayload,
    assertCanWrite?: () => void,
): Promise<number | undefined> {
    const { buffer, mimetype } = await downloadPhotoBuffer(imageUrl)
    const createArgs = {
        collection: 'media' as const,
        data: { alt, tenant: tenantId, aiGenerated: true },
        file: { data: buffer, mimetype, name: filename, size: buffer.length },
    }
    // GH-1185: DB create serialized — concurrent media creates silently lose
    // rows (drizzle transaction race, see media-create-lock.ts).
    let doc
    try {
        doc = await withMediaCreateLock(() => {
            assertCanWrite?.()
            return payload.create(createArgs)
        })
    } catch (err) {
        assertCanWrite?.()
        // Belt & braces for genuinely transient failures (network, S3 hiccup).
        console.warn(
            `[upload-media] media create failed for ${filename}, retrying once: ${err instanceof Error ? err.message : String(err)}`,
        )
        await new Promise((r) => setTimeout(r, 300))
        doc = await withMediaCreateLock(() => {
            assertCanWrite?.()
            return payload.create(createArgs)
        })
    }
    const numId = typeof doc.id === 'number' ? doc.id : parseInt(String(doc.id), 10)
    return Number.isFinite(numId) ? numId : undefined
}
