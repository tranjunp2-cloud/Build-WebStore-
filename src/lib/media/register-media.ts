import type { BasePayload } from 'payload'

// Register a Payload `media` row for a file ALREADY uploaded to S3 (GH-1284
// direct upload). Spike 260715 proved payload.create rejects a file-less doc
// ("No files were uploaded."), so we INSERT the row directly — the media
// upload collection has no `prefix`, no image sizes, and no tenant column, so a
// flat filename + core fields is a complete record. `url` is virtual (generated
// on read via generateFileURL), so we never store it. Bypassing Payload hooks
// is safe here: the only upload hook (magic-byte check) runs for images only.
export async function registerUploadedMedia(
    payload: BasePayload,
    { alt, filename, mimeType, filesize }: { alt: string; filename: string; mimeType: string; filesize: number },
): Promise<{ id: number | string; url: string; filename: string; mimeType: string; filesize: number }> {
    const pool = (payload.db as unknown as { pool: { query: (text: string, values: unknown[]) => Promise<{ rows: Array<{ id: number }> }> } }).pool
    const inserted = await pool.query(
        `INSERT INTO media (alt, filename, mime_type, filesize, updated_at, created_at)
         VALUES ($1, $2, $3, $4, now(), now())
         RETURNING id`,
        [alt, filename, mimeType, filesize],
    )
    const id = inserted.rows[0].id as number
    // Read back through Payload so the virtual `url` is generated consistently.
    const doc = (await payload.findByID({ collection: 'media', id })) as Record<string, unknown>
    return {
        id: doc.id as number,
        url: doc.url as string,
        filename: doc.filename as string,
        mimeType: doc.mimeType as string,
        filesize: doc.filesize as number,
    }
}
