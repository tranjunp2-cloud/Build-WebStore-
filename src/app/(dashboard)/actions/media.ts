'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, extractTenantId } from '@/lib/auth'
import { repairStaleProductImageRefs } from './media-repair'
import { findOrCreateCartonMedia } from '@/lib/media/carton-placeholder'

export async function uploadMediaAction(formData: FormData) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const file = formData.get('file') as File
    if (!file) throw new Error('No file provided')
    const altRaw = formData.get('alt')
    const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : file.name

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const payload = await getPayload({ config: configPromise })

    // Magic byte validation handled by Media.ts beforeChange hook
    try {
        const res = await payload.create({
            collection: 'media',
            data: { alt },
            file: {
                data: buffer,
                name: file.name,
                mimetype: file.type,
                size: file.size,
            },
            user: user as any,
        })
        return JSON.parse(JSON.stringify(res))
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Sharp throws "Input file is missing" or "Invalid image file" for unsupported formats.
        if (/invalid image|input file|unsupported/i.test(msg)) {
            throw new Error('Invalid image file. Please upload JPG, PNG, WebP, GIF, or AVIF.')
        }
        console.error('[uploadMediaAction] Failed to create media:', msg)
        throw err
    }
}

export async function getOrCreateCrateCartonIdAction() {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const tenantId = extractTenantId(user)
    const payload = await getPayload({ config: configPromise })

    const result = await findOrCreateCartonMedia(payload, tenantId, user)
    if (!result) return null

    if (typeof result.replacedStaleId === 'number') {
        // Await repair so FK refs move before delete — catch swallows repair errors
        await repairStaleProductImageRefs(payload, result.replacedStaleId, result.id).catch(() => {})
        // Delete stale record fire-and-forget — refs already moved, FK cleared
        payload.delete({ collection: 'media', id: result.replacedStaleId }).catch(err =>
            console.warn('[Crate Carton] Stale record cleanup failed (non-fatal):', err)
        )
    }
    return result.id
}
