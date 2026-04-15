import type { CollectionConfig, PayloadHandler } from 'payload'
import { APIError } from 'payload'

// Plan 260415 fix-500 — custom handler for /api/media/file/[filename] that
// survives missing-on-disk errors. Payload's default getFileHandler calls
// fs.stat(staticDir/filename) and returns 500 on ENOENT; we intercept first,
// redirect to S3 when configured, otherwise return 404 cleanly.
const mediaFileFallbackHandler: PayloadHandler = async (_req) => {
    const filename = (_req as unknown as { routeParams?: { filename?: string } }).routeParams?.filename
    if (typeof filename !== 'string' || filename.length === 0) {
        return new Response('Missing filename', { status: 400 })
    }
    try {
        const fs = await import('fs/promises')
        const path = await import('path')
        const stat = await fs.stat(path.resolve('public/media', filename))
        // Local file exists — signal "fall through" by returning undefined
        // via a hacky workaround: Payload only falls through when the handler
        // returns non-Response. Return a Response only when we want to short
        // circuit. Here we prefer to let the default handler stream the file.
        if (stat.isFile()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return undefined as any
        }
    } catch {
        /* fall through to S3 redirect */
    }
    const bucket = process.env.S3_BUCKET
    const endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_ENDPOINT
    if (bucket && endpoint) {
        return Response.redirect(`${endpoint}/${bucket}/${filename}`, 302)
    }
    return new Response('File not found', { status: 404 })
}

/** JPEG/PNG magic byte signatures for server-side validation (TC-F17-02-13) */
const IMAGE_SIGNATURES = [
    { bytes: [0xFF, 0xD8, 0xFF], type: 'image/jpeg' },
    { bytes: [0x89, 0x50, 0x4E, 0x47], type: 'image/png' },
]

export const Media: CollectionConfig = {
    slug: 'media',
    hooks: {
        beforeChange: [
            async ({ req }) => {
                if (!req.file) return
                // Only validate image uploads — skip PDF/video
                const mime = req.file.mimetype || ''
                if (!mime.startsWith('image/')) return
                try {
                    const raw = req.file.data instanceof Buffer
                        ? req.file.data.subarray(0, 8)
                        : new Uint8Array(req.file.data as unknown as ArrayBufferLike).slice(0, 8)
                    const head = new Uint8Array(raw)
                    const valid = IMAGE_SIGNATURES.some(sig =>
                        sig.bytes.every((b, i) => head[i] === b),
                    )
                    if (!valid) {
                        throw new APIError('Invalid image file — only JPEG and PNG are accepted', 400)
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
        staticDir: 'public/media',
        // Plan 260415 fix-500 — Vercel ephemeral FS + S3 migration means old
        // media rows may reference files that don't exist on disk. Payload's
        // default getFileHandler returns 500 on ENOENT (see node_modules/
        // payload/dist/uploads/endpoints/getFile.js). Intercept requests here:
        //   1. If local file exists → fall through to default (stream from disk)
        //   2. If missing but S3 configured → 302 redirect to public S3 URL
        //   3. If missing with no S3 → clean 404 (not 500)
        // Logs showed ~90 x 500/24h from this path alone.
        handlers: [mediaFileFallbackHandler],
        imageSizes: [
            { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
            { name: 'card', width: 768, height: 512, position: 'centre' },
            { name: 'hero', width: 1920, height: 1080, position: 'centre' },
            { name: 'square', width: 600, height: 600, position: 'centre' },
        ],
        adminThumbnail: 'thumbnail',
        mimeTypes: ['image/*', 'video/*', 'application/pdf'],
    },
    admin: {
        description: 'Media files uploaded by tenant users.',
    },
    access: {
        read: () => true,
        create: ({ req }) => Boolean(req.user),
        update: ({ req }) => Boolean(req.user),
        delete: ({ req }) => Boolean(req.user),
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
    ],
    timestamps: true,
}
