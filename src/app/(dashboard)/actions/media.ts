'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, extractTenantId } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export async function uploadMediaAction(formData: FormData) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')

    const file = formData.get('file') as File
    if (!file) throw new Error('No file provided')
    const altRaw = formData.get('alt')
    const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : file.name

    // Convert File to ArrayBuffer to Buffer for Payload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const payload = await getPayload({ config: configPromise })

    // Magic byte validation handled by Media.ts beforeChange hook
    try {
        const res = await payload.create({
            collection: 'media',
            data: {
                alt,
            },
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

    // Scope placeholder per tenant — each tenant gets their own copy
    const tenantId = extractTenantId(user)
    const altKey = tenantId ? `Crate Carton Placeholder - ${tenantId}` : 'Crate Carton Placeholder'

    const payload = await getPayload({ config: configPromise })

    // Check if crate carton placeholder already exists for this tenant
    const existing = await payload.find({
        collection: 'media',
        where: {
            alt: { equals: altKey }
        },
        limit: 1
    })

    if (existing.docs.length > 0) {
        const doc = existing.docs[0]
        const s3Endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT
        if (!s3Endpoint) {
            // Local dev without S3 — trust existing record
            return doc.id
        }
        const normalizedEnv = s3Endpoint.replace(/\/$/, '')
        const docUrl = doc.url ?? ''
        if (docUrl.startsWith(normalizedEnv)) {
            return doc.id
        }
        // Stale or missing S3 URL — delete and recreate
        try {
            await payload.delete({ collection: 'media', id: doc.id })
        } catch (err) {
            // FK constraint or network error — fail-soft, return stale id rather than crash
            console.error('[Crate Carton] Failed to delete stale record, returning existing id', err)
            return doc.id
        }
    }

    // Try to read the static crate carton file backwards compatible location
    try {
        const filePath = path.join(process.cwd(), 'public', 'images', 'crate-carton.png')
        if (!fs.existsSync(filePath)) {
            console.error('[Crate Carton Seed] Local placeholder not found:', filePath)
            return null
        }
        const fileData = fs.readFileSync(filePath)

        const res = await payload.create({
            collection: 'media',
            data: {
                alt: altKey,
            },
            file: {
                data: fileData,
                name: 'crate-carton-placeholder.png',
                mimetype: 'image/png',
                size: fileData.length,
            },
            user: user as Parameters<typeof payload.create>[0]['user'],
        })

        return res.id
    } catch (err) {
        console.error('Failed to create crate carton placeholder from local file', err)
        return null
    }
}
