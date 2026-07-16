/**
 * Unit Tests: registerUploadedMedia — creates a Payload media row for a file
 * already in S3 via raw INSERT (payload.create rejects a file-less doc; proven
 * in spike 260715), then reads back through Payload for the virtual url.
 * TC-IDs: TC-F30-HMO-015
 * QA doc: docs/qa/F30-hero-media-overlay.md
 */
import { describe, it, expect, vi } from 'vitest'
import { registerUploadedMedia } from '@/lib/media/register-media'

function makePayload(insertedId: number) {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: insertedId }] })
    const findByID = vi.fn().mockResolvedValue({
        id: insertedId,
        url: `https://s3/bucket/file-${insertedId}.mp4`,
        filename: `file-${insertedId}.mp4`,
        mimeType: 'video/mp4',
        filesize: 16_600_000,
    })
    // Minimal Payload surface used by registerUploadedMedia.
    const payload = { db: { pool: { query } }, findByID } as unknown as Parameters<typeof registerUploadedMedia>[0]
    return { payload, query, findByID }
}

describe('TC-F30-HMO-015: registerUploadedMedia inserts the row and returns the virtual url', () => {
    it('INSERTs the core columns with the passed values', async () => {
        const { payload, query } = makePayload(8168)
        await registerUploadedMedia(payload, { alt: 'Hero video', filename: 'file.mp4', mimeType: 'video/mp4', filesize: 16_600_000 })
        const [sql, values] = query.mock.calls[0] as [string, unknown[]]
        expect(sql).toMatch(/INSERT INTO media/i)
        expect(sql).toMatch(/alt, filename, mime_type, filesize/i)
        expect(values).toEqual(['Hero video', 'file.mp4', 'video/mp4', 16_600_000])
    })

    it('reads the inserted row back through Payload and returns { id, url, ... }', async () => {
        const { payload, findByID } = makePayload(8168)
        const result = await registerUploadedMedia(payload, { alt: 'a', filename: 'file.mp4', mimeType: 'video/mp4', filesize: 100 })
        expect(findByID).toHaveBeenCalledWith({ collection: 'media', id: 8168 })
        expect(result).toEqual({
            id: 8168,
            url: 'https://s3/bucket/file-8168.mp4',
            filename: 'file-8168.mp4',
            mimeType: 'video/mp4',
            filesize: 16_600_000,
        })
    })
})
