import { basename, resolve } from 'path'

import type { AccessArgs, CollectionBeforeChangeHook, CollectionConfig, PayloadHandler, Where } from 'payload'
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

/**
 * Who may edit or delete a media row (update / delete).
 * - Any signed-in user: files that are not stock-provider rows (unchanged).
 * - Stock-provider rows (Pixabay / Wikimedia): only when the row's tenant is one of the user's workspaces.
 *   Stock pictures the copilot saved for a shop carry that shop's tenant, so its merchant can remove them.
 *   Rows with no tenant are the shared stock library: nobody here can touch them.
 * The provenance fields (`sourceProvider`, license, attribution…) stay system-only whoever may update the row.
 */
function tenantWritableMedia({ req }: AccessArgs): false | Where {
    if (!req.user) return false
    const own = memberTenantIds(req.user).map((id) => (/^\d+$/.test(String(id)) ? Number(id) : id))
    return {
        or: [
            { sourceProvider: { exists: false } },
            { sourceProvider: { not_in: [...STOCK_SOURCE_PROVIDERS] } },
            ...(own.length > 0 ? [{ and: [{ sourceProvider: { in: [...STOCK_SOURCE_PROVIDERS] } }, { tenant: { in: own } }] }] : []),
        ],
    }
}

function unwrapId(value: unknown): string | number | null {
    if (value == null || value === '') return null
    if (typeof value === 'object') {
        const id = (value as { id?: unknown }).id
        return typeof id === 'string' || typeof id === 'number' ? id : null
    }
    return typeof value === 'string' || typeof value === 'number' ? value : null
}

/**
 * Tenant ids the signed-in user is an ACTIVE member of, first = their default workspace (same rule as
 * Blogs/Products). A pending or suspended membership gives no upload into, and no stock edit of, that shop's
 * library; a membership without a status is active (the field's default, as in Tenants.ts).
 */
function memberTenantIds(user: unknown): Array<string | number> {
    const entries = (user as { tenants?: Array<{ tenant?: unknown; status?: string | null }> } | null | undefined)?.tenants ?? []
    return entries.flatMap((entry) => {
        if ((entry?.status ?? 'active') !== 'active') return []
        const id = unwrapId(entry?.tenant)
        return id == null ? [] : [id]
    })
}

/**
 * A new file belongs to the workspace of whoever uploads it. The tenant is what lets the AI copilot list
 * "this shop's library" and refuse another shop's picture (`lib/ai-platform/media-access.ts`).
 * - Signed-in tenant user: one of their own workspaces (the one asked for if they belong to it, else their first).
 * - Signed-in platform admin: whatever was asked for, else their first workspace, else none.
 * - No user (Local API: copilot ingest, scripts, migrations): the caller's explicit tenant is kept as given.
 * Rows created before this field existed stay without a tenant (legacy; see media-access.ts).
 */
export function resolveMediaTenant(user: unknown, requested: unknown): string | number | null {
    const asked = unwrapId(requested)
    if (!user) return asked
    const members = memberTenantIds(user)
    const isSuperAdmin = Boolean((user as { roles?: string[] }).roles?.includes('super-admin'))
    if (isSuperAdmin && asked != null) return asked
    if (asked != null && members.some((id) => String(id) === String(asked))) return asked
    return members[0] ?? null
}

const assignTenant: CollectionBeforeChangeHook = ({ data, req, operation }) => {
    // the owner never changes after the upload
    if (operation !== 'create') return data
    const tenant = resolveMediaTenant(req.user, data?.tenant)
    if (tenant != null) data.tenant = tenant
    else delete data.tenant
    return data
}

export const Media: CollectionConfig = {
    slug: 'media',
    hooks: {
        beforeChange: [
            assignTenant,
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
            // Owner workspace. Nullable on purpose: rows uploaded before this field existed have none.
            // Reads of the file itself stay public (storefront); the field is only shown to signed-in users.
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            index: true,
            access: {
                read: ({ req }) => Boolean(req.user),
                create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
                update: () => false,
            },
            admin: { description: 'The workspace that uploaded this file (set automatically)', readOnly: true },
        },
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
