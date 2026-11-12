import { PutObjectAclCommand, type S3Client } from '@aws-sdk/client-s3'
import type { CollectionAfterChangeHook, Config, Plugin } from 'payload'

import { buildS3Client } from './s3-client'

/**
 * Private media objects in storage (TC-PERF-146).
 * Every media object is written `public-read` (MEDIA_OBJECT_ACL, #2126): the bucket has no public policy, so the
 * storefront needs the ACL on each object. `@payloadcms/storage-s3` 3.91 takes one static `acl` for the whole
 * collection, so a private row (payment receipt) would be readable by anyone holding its S3 URL even though the
 * app never shows that URL (hidePrivateMediaUrl). This hook runs right after the storage plugin's upload hook and
 * sets the receipt's objects (original + generated sizes) to `private`; /api/media/private/{id} reads them with
 * the bucket credentials. It also covers a row a super-admin marks private later.
 */

type StoredMedia = {
    private?: boolean | null
    filename?: string | null
    prefix?: string | null
    _objectKey?: string | null
    sizes?: Record<string, { filename?: string | null } | null> | null
}

const clean = (part: string | null | undefined) => (part ?? '').trim().replace(/^\/+|\/+$/g, '')

/** Same layout as the storage plugin and the private media route: {prefix}/{_objectKey}/{filename}, empty parts left out. */
export function mediaObjectKeys(doc: StoredMedia): string[] {
    const folder = [clean(doc.prefix), clean(doc._objectKey)].filter(Boolean)
    const filenames = [doc.filename, ...Object.values(doc.sizes ?? {}).map((size) => size?.filename)]
    const keys = filenames
        .map((filename) => clean(filename))
        .filter((filename) => filename.length > 0)
        .map((filename) => [...folder, filename].join('/'))
    return [...new Set(keys)]
}

/** True when this write stored a private file, or turned a stored file private. */
export function needsPrivateAcl(doc: StoredMedia, previousDoc: StoredMedia | undefined, operation: string): boolean {
    if (doc?.private !== true || !doc.filename) return false
    if (operation === 'create' || !previousDoc) return true
    return previousDoc.private !== true || previousDoc.filename !== doc.filename
}

export async function setMediaObjectsPrivate(doc: StoredMedia, s3: { client: Pick<S3Client, 'send'>; bucket: string }): Promise<void> {
    await Promise.all(
        mediaObjectKeys(doc).map((Key) => s3.client.send(new PutObjectAclCommand({ Bucket: s3.bucket, Key, ACL: 'private' }))),
    )
}

export type PrivateAclRun = { rows: number; objects: number; done: number; failed: Array<{ id: unknown; key: string; error: string }> }

/**
 * One-off repair (TC-PERF-171): receipts stored before their row was private kept the `public-read` object ACL, so
 * their S3 URL (`<bucket>/<buyer's file name>`) still opened them. Lists every object key of `rows`, and with
 * `apply` switches each one to `private`. One failed object (missing, denied) is reported and the run goes on.
 * Idempotent: setting `private` again on a private object changes nothing.
 */
export async function privatizeStoredMedia(
    rows: ReadonlyArray<StoredMedia & { id: unknown }>,
    options: { apply: boolean; s3: { client: Pick<S3Client, 'send'>; bucket: string } | null; log?: (line: string) => void },
): Promise<PrivateAclRun> {
    const log = options.log ?? (() => {})
    const run: PrivateAclRun = { rows: rows.length, objects: 0, done: 0, failed: [] }
    if (options.apply && !options.s3) throw new Error('storage is not configured (S3_ENDPOINT / S3_BUCKET)')
    for (const row of rows) {
        if (row.private !== true) continue
        for (const Key of mediaObjectKeys(row)) {
            run.objects += 1
            if (!options.apply || !options.s3) {
                log(`  media ${String(row.id)}: would set ${Key} private`)
                continue
            }
            try {
                await options.s3.client.send(new PutObjectAclCommand({ Bucket: options.s3.bucket, Key, ACL: 'private' }))
                run.done += 1
                log(`  media ${String(row.id)}: ${Key} is private`)
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                run.failed.push({ id: row.id, key: Key, error: message })
                log(`  media ${String(row.id)}: ${Key} NOT changed — ${message}`)
            }
        }
    }
    return run
}

export function privateMediaAclHook(
    getS3: () => { client: Pick<S3Client, 'send'>; bucket: string } | null = buildS3Client,
): CollectionAfterChangeHook {
    return async ({ doc, previousDoc, operation, req }) => {
        if (!needsPrivateAcl(doc, previousDoc, operation)) return doc
        const s3 = getS3()
        if (!s3) return doc
        try {
            await setMediaObjectsPrivate(doc, s3)
        } catch (error) {
            // The buyer's upload is not failed for this (the object name is random and the app never shows its
            // URL); the error is loud so the object can be fixed by hand.
            req.payload?.logger?.error?.(
                `[media] could not make private media ${String((doc as { id?: unknown }).id)} private in storage: ${error instanceof Error ? error.message : String(error)}`,
            )
        }
        return doc
    }
}

/** Appends privateMediaAclHook to `collection` AFTER the storage plugin's hooks: put it after s3Storage in `plugins`. */
export function privateMediaAclPlugin(collection = 'media'): Plugin {
    return (config: Config): Config => ({
        ...config,
        collections: (config.collections ?? []).map((existing) =>
            existing.slug !== collection
                ? existing
                : {
                      ...existing,
                      hooks: {
                          ...existing.hooks,
                          afterChange: [...(existing.hooks?.afterChange ?? []), privateMediaAclHook()],
                      },
                  },
        ),
    })
}
