/**
 * Shared "find or create crate-carton placeholder" logic.
 * Auth-free — works in both 'use server' actions (dashboard) and API route contexts (gen flow).
 *
 * Callers that need stale-record FK repair (dashboard action) must handle
 * replacedStaleId themselves after this function returns.
 */

import fs from 'fs'
import path from 'path'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import type { BasePayload } from 'payload'

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
        const httpStatus = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
        if (httpStatus === 404) return false
        console.error('[checkS3ObjectsExist] Unexpected S3 error, treating objects as existing', err)
        return true
    }
}

function s3KeyFromUrl(url: string, urlPrefix: string): string | null {
    return url.startsWith(urlPrefix) ? url.slice(urlPrefix.length) : null
}

export interface CartonResult {
    id: number
    replacedStaleId?: number
}

/**
 * Find or create the crate-carton placeholder Media record for a tenant.
 * Includes S3 staleness check — returns replacedStaleId when an old record was
 * renamed so the caller can repair FK refs before deleting it.
 * Pass `user` when running in an authenticated context (dashboard action).
 */
export async function findOrCreateCartonMedia(
    payload: BasePayload,
    tenantId: number | string | null,
    user?: object,
): Promise<CartonResult | null> {
    const altKey = tenantId ? `Crate Carton Placeholder - ${tenantId}` : 'Crate Carton Placeholder'

    const existing = await payload.find({
        collection: 'media',
        where: { alt: { equals: altKey } },
        limit: 1,
    })

    let replacedStaleId: number | undefined

    if (existing.docs.length > 0) {
        const doc = existing.docs[0]!
        const publicEndpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT
        const bucket = process.env.S3_BUCKET
        if (!publicEndpoint) {
            return { id: doc.id as number }
        }
        const normalizedEnv = publicEndpoint.replace(/\/$/, '')
        const docUrl = doc.url ?? ''

        if (docUrl.startsWith(normalizedEnv) && bucket) {
            const urlPrefix = `${normalizedEnv}/${bucket}/`
            const keys: string[] = []

            const originalKey = s3KeyFromUrl(docUrl, urlPrefix)
            if (originalKey) keys.push(originalKey)

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
                if (allExist) return { id: doc.id as number }
            } else {
                return { id: doc.id as number }
            }
        } else if (docUrl.startsWith(normalizedEnv)) {
            return { id: doc.id as number }
        }

        // Stale — rename so a new record can be created without alt key collision
        replacedStaleId = doc.id as number
        try {
            await payload.update({
                collection: 'media',
                id: replacedStaleId,
                data: { alt: `${altKey}__stale` },
            })
        } catch (err) {
            console.warn('[Crate Carton] Failed to rename stale record, aborting recreate', err)
            return { id: replacedStaleId }
        }
    }

    // Read from local filesystem; fallback to HTTP for Vercel serverless environments
    const filePath = path.join(process.cwd(), 'public', 'images', 'crate-carton.png')
    let fileData: Buffer | null = null
    if (fs.existsSync(filePath)) {
        fileData = fs.readFileSync(filePath)
    } else {
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, '')
        if (baseUrl) {
            try {
                const res = await fetch(`${baseUrl}/images/crate-carton.png`)
                if (res.ok) {
                    fileData = Buffer.from(await res.arrayBuffer())
                } else {
                    console.error('[Crate Carton Seed] CDN fetch failed:', res.status)
                }
            } catch (fetchErr) {
                console.error('[Crate Carton Seed] CDN fetch error:', fetchErr)
            }
        }
        if (!fileData) {
            console.error('[Crate Carton Seed] Local placeholder not found and CDN unavailable:', filePath)
            return null
        }
    }

    try {
        const res = await payload.create({
            collection: 'media',
            data: {
                alt: altKey,
                ...(tenantId != null ? { tenant: /^\d+$/.test(String(tenantId)) ? Number(tenantId) : tenantId } : {}),
            },
            file: {
                data: fileData,
                name: 'crate-carton-placeholder.png',
                mimetype: 'image/png',
                size: fileData.length,
            },
            ...(user ? { user: user as Parameters<typeof payload.create>[0]['user'] } : {}),
        })
        return { id: res.id as number, replacedStaleId }
    } catch (err) {
        console.error('Failed to create crate carton placeholder from local file', err)
        return null
    }
}
