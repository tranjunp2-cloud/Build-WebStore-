import type { BasePayload } from 'payload'

type RegisteredMedia = { id: number | string; url: string; filename: string; mimeType: string; filesize: number }

type MediaPool = {
    query: (text: string, values: unknown[]) => Promise<{ rows: Array<{ id: number }> }>
}

function getMediaPool(payload: BasePayload): MediaPool {
    return (payload.db as unknown as { pool: MediaPool }).pool
}

async function readRegisteredMedia(payload: BasePayload, id: number): Promise<RegisteredMedia> {
    const doc = (await payload.findByID({ collection: 'media', id })) as Record<string, unknown>
    return {
        id: doc.id as number,
        url: doc.url as string,
        filename: doc.filename as string,
        mimeType: doc.mimeType as string,
        filesize: doc.filesize as number,
    }
}

/** Return the existing media record for a direct-upload key, if it was already registered. */
export async function findRegisteredMedia(
    payload: BasePayload,
    filename: string,
): Promise<RegisteredMedia | null> {
    const result = await getMediaPool(payload).query(
        'SELECT id FROM media WHERE filename = $1 LIMIT 1',
        [filename],
    )
    const id = result.rows[0]?.id
    return id === undefined ? null : readRegisteredMedia(payload, id)
}

// Register a Payload `media` row for a file ALREADY uploaded to S3 (GH-1284
// direct upload). Spike 260715 proved payload.create rejects a file-less doc
// ("No files were uploaded."), so we INSERT the row directly — the media
// upload collection has no `prefix`, no image sizes, and no tenant column, so a
// flat filename + core fields is a complete record. `url` is virtual (generated
// on read via generateFileURL), so we never store it. Direct image registration
// validates magic bytes from S3 before calling this helper.
export async function registerUploadedMedia(
    payload: BasePayload,
    { alt, filename, mimeType, filesize }: { alt: string; filename: string; mimeType: string; filesize: number },
): Promise<RegisteredMedia> {
    const pool = getMediaPool(payload)
    const inserted = await pool.query(
        `INSERT INTO media (alt, filename, mime_type, filesize, updated_at, created_at)
         VALUES ($1, $2, $3, $4, now(), now())
         RETURNING id`,
        [alt, filename, mimeType, filesize],
    )
    const id = inserted.rows[0].id as number
    // Read back through Payload so the virtual `url` is generated consistently.
    return readRegisteredMedia(payload, id)
}
