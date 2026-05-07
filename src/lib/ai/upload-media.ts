/**
 * Shared media upload helper for AI generation flows.
 * Downloads an image URL and creates a tenant-scoped Payload Media record.
 * Returns Media ID or undefined on failure (caller decides fatal/non-fatal).
 */

import type { BasePayload } from 'payload'
import { downloadPhotoBuffer } from './unsplash-client'

export async function uploadImageUrl(
    imageUrl: string,
    filename: string,
    alt: string,
    tenantId: number | string,
    payload: BasePayload,
): Promise<number | undefined> {
    const { buffer, mimetype } = await downloadPhotoBuffer(imageUrl)
    const doc = await payload.create({
        collection: 'media',
        data: { alt, tenant: tenantId, aiGenerated: true },
        file: { data: buffer, mimetype, name: filename, size: buffer.length },
    })
    const numId = typeof doc.id === 'number' ? doc.id : parseInt(String(doc.id), 10)
    return Number.isFinite(numId) ? numId : undefined
}
