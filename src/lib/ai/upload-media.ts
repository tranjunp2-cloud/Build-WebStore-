/**
 * Shared media upload helper for AI generation flows.
 * Downloads an image URL and creates a tenant-scoped Payload Media record.
 * Returns Media ID or undefined on failure (caller decides fatal/non-fatal).
 */

import type { BasePayload } from 'payload'
import { downloadPhotoBuffer } from './pixabay-client'

export async function uploadImageUrl(
    imageUrl: string,
    filename: string,
    alt: string,
    tenantId: number | string,
    payload: BasePayload,
): Promise<number | undefined> {
    const { buffer, mimetype } = await downloadPhotoBuffer(imageUrl)
    const createArgs = {
        collection: 'media' as const,
        data: { alt, tenant: tenantId, aiGenerated: true },
        file: { data: buffer, mimetype, name: filename, size: buffer.length },
    }
    let doc
    try {
        doc = await payload.create(createArgs)
    } catch (err) {
        // GH-1185 follow-up: transient create failures under parallel batch
        // uploads (transaction rollback) — retry once, see media-pipeline.ts.
        console.warn(
            `[upload-media] media create failed for ${filename}, retrying once: ${err instanceof Error ? err.message : String(err)}`,
        )
        await new Promise((r) => setTimeout(r, 300))
        doc = await payload.create(createArgs)
    }
    const numId = typeof doc.id === 'number' ? doc.id : parseInt(String(doc.id), 10)
    return Number.isFinite(numId) ? numId : undefined
}
