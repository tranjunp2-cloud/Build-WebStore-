import { basename, resolve } from 'path'

import type { AccessArgs, CollectionConfig, PayloadHandler } from 'payload'
import { APIError } from 'payload'
import { hasValidEvidenceVideoSignature, hasValidImageSignature } from '@/lib/media/image-signature'

// Plan 260415 fix-500 — custom handler for /api/media/file/[filename] that
// survives missing-on-disk errors. Payload's default getFileHandler calls
// fs.stat(staticDir/filename) and returns 500 on ENOENT. We intercept FIRST
// and always return a concrete Response (so there's no fall-through typing
// ambiguity):
//   1. Local file exists → stream it with correct Content-Type
//   2. Missing + S3 env configured → 302 redirect to public S3 URL
//   3. Missing + no S3 → clean 404
// Logs showed ~90 x 500/24h from this path alone before the fix.

const MIME_BY_EXT: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
}

function mimeFromFilename(filename: string): string {
    const dotIndex = filename.lastIndexOf('.')
    if (dotIndex < 0) return 'application/octet-stream'
    const ext = filename.slice(dotIndex).toLowerCase()
    return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

const mediaFileFallbackHandler: PayloadHandler = async (req): Promise<Response> => {
    const routeParams = (req as unknown as { routeParams?: { filename?: string } }).routeParams
    const filename = routeParams?.filename
    if (typeof filename !== 'string' || filename.length === 0) {
        return new Response('Missing filename', { status: 400 })
    }

    // 1. Try local disk first (dev + legacy files). Match the staticDir env
    // logic above so we check the same path Payload's upload handler writes to.
    const localDir = process.env.VERCEL === '1' ? '/tmp/media' : 'public/media'
    // safeFilename declared here so it is accessible in the S3 redirect below (fix TS2552).
    const safeFilename = basename(filename)
    try {
        const fs = await import('fs/promises')
        const localPath = resolve(localDir, safeFilename)
        const data = await fs.readFile(localPath)
        return new Response(data, {
            status: 200,
            headers: {
                'Content-Type': mimeFromFilename(safeFilename),
                'Content-Length': String(data.byteLength),
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        })
    } catch {
        /* fall through — not a local file */
    }

    // 2. Redirect to S3 if configured.
    const bucket = process.env.S3_BUCKET
    const endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_ENDPOINT
    if (bucket && endpoint) {
        return Response.redirect(`${endpoint}/${bucket}/${safeFilename}`, 302)
    }

    // 3. Nothing found — return clean 404 (not 500).
    return new Response('File not found', { status: 404 })
}

const STOCK_SOURCE_PROVIDERS = ['wikimedia', 'pixabay'] as const
const SYSTEM_PROVENANCE_FIELD_ACCESS = {
    create: () => false,
    update: () => false,
}

function tenantWritableMedia({ req }: AccessArgs) {
    if (!req.user) return false
    return {
        or: [
            { sourceProvider: { exists: false } },
            { sourceProvider: { not_in: [...STOCK_SOURCE_PROVIDERS] } },
        ],
    }
}

export const Media: CollectionConfig = {
    slug: 'media',
    hooks: {
        beforeChange: [
            async ({ req }) => {
                if (!req.file) return
                // Images are always validated. Ticket evidence additionally
                // permits MP4/WebM, so validate those container headers too
                // rather than trusting a browser-supplied MIME type.
                const mime = req.file.mimetype || ''
                const validatesImage = mime.startsWith('image/')
                const validatesEvidenceVideo = mime === 'video/mp4' || mime === 'video/webm'
                if (!validatesImage && !validatesEvidenceVideo) return
                try {
                    // Twelve bytes cover WebP at offset 8–11 and MP4's ftyp box.
                    const raw = req.file.data instanceof Buffer
                        ? req.file.data.subarray(0, 12)
                        : new Uint8Array(req.file.data as unknown as ArrayBufferLike).slice(0, 12)
                    const head = new Uint8Array(raw)
                    const valid = validatesImage ? hasValidImageSignature(head) : hasValidEvidenceVideoSignature(head, mime)
                    if (!valid) {
                        throw new APIError(validatesImage
                            ? 'Invalid image file — only JPEG, PNG, WebP, and ICO are accepted'
                            : 'Invalid video file — only valid MP4 and WebM are accepted', 400)
                    }
                } catch (e) {
                    if (e instanceof APIError) throw e
                    req.payload?.logger?.error?.(`Magic byte validation error: ${e}`)
                    throw new APIError('Invalid image file', 400)
                }
            },
        ],
    },
    upload: {
        // Plan 260415 fix-500 — On Vercel, `/var/task` (cwd) is a readonly
        // build artifact. Payload + Sharp try `fs.mkdir('public', { recursive:
        // true })` to write image size thumbnails before the s3Storage plugin
        // uploads them → ENOENT / EROFS → the entire request 500s. Seen on
        // /products/new (20 hits/24h), /products/[id] (30), /blog/new (50).
        // Switch the staticDir to /tmp/media in any Vercel environment — /tmp
        // is writable + ephemeral which is exactly what we want for thumbnail
        // staging before the S3 upload picks them up.
        staticDir: process.env.VERCEL === '1' ? '/tmp/media' : 'public/media',
        // Plan 260415 fix-500 — Vercel ephemeral FS + S3 migration means old
        // media rows may reference files that don't exist on disk. Payload's
        // default getFileHandler returns 500 on ENOENT (see node_modules/
        // payload/dist/uploads/endpoints/getFile.js). Intercept requests here:
        //   1. If local file exists → stream it with correct Content-Type
        //   2. If missing but S3 configured → 302 redirect to public S3 URL
        //   3. If missing with no S3 → clean 404 (not 500)
        // Logs showed ~90 x 500/24h from this path alone.
        handlers: [mediaFileFallbackHandler],
        mimeTypes: ['image/*', 'video/*', 'application/pdf'],
    },
    admin: {
        description: 'Media files uploaded by tenant users.',
    },
    access: {
        read: () => true,
        create: ({ req }) => Boolean(req.user),
        update: tenantWritableMedia,
        delete: tenantWritableMedia,
    },
    fields: [
        {
            name: 'alt',
            type: 'text',
            required: true,
            admin: {
                description: 'Alt text for accessibility and SEO',
            },
        },
        {
            name: 'caption',
            type: 'text',
        },
        {
            name: 'aiGenerated',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'Was this image generated by AI?' },
        },
        {
            name: 'aiPrompt',
            type: 'text',
            admin: {
                condition: (_, siblingData) => Boolean(siblingData?.aiGenerated),
                description: 'The prompt used to generate this image',
            },
        },
        {
            name: 'sourceProvider',
            type: 'select',
            access: SYSTEM_PROVENANCE_FIELD_ACCESS,
            options: [
                { label: 'Wikimedia Commons', value: 'wikimedia' },
                { label: 'Pixabay', value: 'pixabay' },
                { label: 'AI', value: 'ai' },
            ],
            admin: {
                description: 'System provenance for generated or shared stock media',
                readOnly: true,
            },
        },
        {
            name: 'sourceUrl',
            type: 'text',
            access: SYSTEM_PROVENANCE_FIELD_ACCESS,
            admin: { readOnly: true },
        },
        {
            name: 'licenseName',
            type: 'text',
            access: SYSTEM_PROVENANCE_FIELD_ACCESS,
            admin: { readOnly: true },
        },
        {
            name: 'licenseUrl',
            type: 'text',
            access: SYSTEM_PROVENANCE_FIELD_ACCESS,
            admin: { readOnly: true },
        },
        {
            name: 'attribution',
            type: 'text',
            access: SYSTEM_PROVENANCE_FIELD_ACCESS,
            admin: { readOnly: true },
        },
    ],
    timestamps: true,
}
