'use server'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser, extractTenantId } from '@/lib/auth'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { repairStaleProductImageRefs } from './media-repair'
import fs from 'fs'
import path from 'path'

// Single S3Client shared across all parallel HEAD checks in one call
async function checkS3ObjectsExist(keys: string[]): Promise<boolean> {
    const endpoint = process.env.S3_ENDPOINT
    const bucket = process.env.S3_BUCKET
    if (!endpoint || !bucket || keys.length === 0) return true
    const client = new S3Client({
        endpoint,
        region: process.env.S3_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        forcePathStyle: true,
    })
    try {
        await Promise.all(
            keys.map((key) => client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))),
        )
        return true
    } catch (err: unknown) {
        // Only treat confirmed 404 as "missing" — transient errors (network, auth, throttle)
        // should fail-open to avoid deleting valid records on S3 connectivity blips.
        const httpStatus = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
        if (httpStatus === 404) return false
        console.error('[checkS3ObjectsExist] Unexpected S3 error, treating objects as existing', err)
        return true
    }
}

function s3KeyFromUrl(url: string, urlPrefix: string): string | null {
    return url.startsWith(urlPrefix) ? url.slice(urlPrefix.length) : null
}

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

    // Scope placeholder per tenant — each tenant gets their own copy
    const tenantId = extractTenantId(user)
    const altKey = tenantId ? `Crate Carton Placeholder - ${tenantId}` : 'Crate Carton Placeholder'

    const payload = await getPayload({ config: configPromise })

    const existing = await payload.find({
        collection: 'media',
        where: { alt: { equals: altKey } },
        limit: 1,
    })

    let oldId: number | undefined

    if (existing.docs.length > 0) {
        const doc = existing.docs[0]
        const publicEndpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT
        const bucket = process.env.S3_BUCKET
        if (!publicEndpoint) {
            // Local dev without S3 — trust existing record
            return doc.id
        }
        const normalizedEnv = publicEndpoint.replace(/\/$/, '')
        const docUrl = doc.url ?? ''

        if (docUrl.startsWith(normalizedEnv) && bucket) {
            const urlPrefix = `${normalizedEnv}/${bucket}/`
            const keys: string[] = []

            const originalKey = s3KeyFromUrl(docUrl, urlPrefix)
            if (originalKey) keys.push(originalKey)

            // Payload generates size variants (thumbnail|card|hero|square) per Media.ts imageSizes
            const sizes = (doc as { sizes?: unknown }).sizes
            if (sizes !== null && typeof sizes === 'object') {
                for (const variant of Object.values(sizes as Record<string, unknown>)) {
                    if (variant !== null && typeof variant === 'object' && 'url' in variant) {
                        const variantUrl = (variant as { url?: unknown }).url
                        if (typeof variantUrl === 'string') {
                            const k = s3KeyFromUrl(variantUrl, urlPrefix)
                            if (k) keys.push(k)
                        }
                    }
                }
            }

            if (keys.length > 0) {
                const allExist = await checkS3ObjectsExist(keys)
                if (allExist) return doc.id
                // Any object missing — fall through to delete+recreate
            } else {
                // URL matches endpoint but no extractable keys — trust existing
                return doc.id
            }
        } else if (docUrl.startsWith(normalizedEnv)) {
            // URL matches endpoint but bucket not set — trust existing
            return doc.id
        }
        // Stale host or missing S3 object — rename old record first so find() won't
        // return it during recreate, then repair FK refs before deleting.
        // Direct delete fails when products reference this media via FK constraint.
        oldId = doc.id as number
        try {
            await payload.update({
                collection: 'media',
                id: oldId,
                data: { alt: `${altKey}__stale` },
            })
        } catch (err) {
            console.warn('[Crate Carton] Failed to rename stale record, aborting recreate', err)
            return oldId
        }
    }

    // Upload from static file bundled with the app
    try {
        const filePath = path.join(process.cwd(), 'public', 'images', 'crate-carton.png')
        if (!fs.existsSync(filePath)) {
            console.error('[Crate Carton Seed] Local placeholder not found:', filePath)
            return null
        }
        const fileData = fs.readFileSync(filePath)
        const res = await payload.create({
            collection: 'media',
            data: { alt: altKey },
            file: {
                data: fileData,
                name: 'crate-carton-placeholder.png',
                mimetype: 'image/png',
                size: fileData.length,
            },
            user: user as Parameters<typeof payload.create>[0]['user'],
        })
        if (typeof oldId === 'number') {
            // Await repair so FK refs move before delete — catch swallows repair errors
            await repairStaleProductImageRefs(payload, oldId, res.id as number).catch(() => {})
            // Delete stale record fire-and-forget — refs already moved, FK cleared
            payload.delete({ collection: 'media', id: oldId }).catch(err =>
                console.warn('[Crate Carton] Stale record cleanup failed (non-fatal):', err)
            )
        }
        return res.id
    } catch (err) {
        console.error('Failed to create crate carton placeholder from local file', err)
        return null
    }
}
