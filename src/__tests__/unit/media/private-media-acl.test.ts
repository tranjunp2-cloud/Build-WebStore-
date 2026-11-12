/**
 * TC-PERF-146 — a private media row (payment receipt) is private in storage too: every object is uploaded
 * public-read (MEDIA_OBJECT_ACL, #2126), so right after the storage plugin's upload the receipt's objects
 * (original + sizes) are set to the `private` ACL; also when a stored file is made private later (super-admin).
 * Public media keep public-read; a failed ACL call does not fail the buyer's upload but is logged.
 * TC-PERF-171 — one-off repair for receipts stored before that: lists every object of the private rows (dry run by
 * default) and with `apply` sets each one private, reporting the objects storage refused.
 * Real: lib/media/private-media-acl.ts, @aws-sdk/client-s3 PutObjectAclCommand. Faked: the S3 client's send.
 */
import { PutObjectAclCommand } from '@aws-sdk/client-s3'
import type { Config } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mediaObjectKeys, privateMediaAclHook, privateMediaAclPlugin, privatizeStoredMedia } from '@/lib/media/private-media-acl'

const send = vi.fn()
const logError = vi.fn()
const s3 = () => ({ client: { send }, bucket: 'media-bucket' })
const hook = privateMediaAclHook(s3)
const run = (doc: object, operation: 'create' | 'update', previousDoc?: object) =>
    hook({ doc, previousDoc, operation, req: { payload: { logger: { error: logError } } } } as never)

const receipt = {
    id: 31,
    private: true,
    filename: 'payment-proof-abc.jpg',
    prefix: null,
    _objectKey: 'k1',
    sizes: { thumbnail: { filename: 'payment-proof-abc-400x300.jpg' }, card: { filename: null } },
}

const aclCalls = () =>
    send.mock.calls.map(([command]) => {
        expect(command).toBeInstanceOf(PutObjectAclCommand)
        return (command as PutObjectAclCommand).input
    })

beforeEach(() => {
    send.mockReset().mockResolvedValue({})
    logError.mockReset()
})

describe('private receipts are private in storage [TC-PERF-146]', () => {
    it('sets the original and every generated size of a new receipt to private', async () => {
        // Act
        await run(receipt, 'create')

        // Assert
        expect(aclCalls()).toEqual([
            { Bucket: 'media-bucket', Key: 'k1/payment-proof-abc.jpg', ACL: 'private' },
            { Bucket: 'media-bucket', Key: 'k1/payment-proof-abc-400x300.jpg', ACL: 'private' },
        ])
    })

    it('also when a stored file is made private later (a super-admin marks it private)', async () => {
        await run(receipt, 'update', { ...receipt, private: false })

        expect(aclCalls()).toHaveLength(2)
    })

    it('leaves public media public-read, and does not repeat for an unchanged private row', async () => {
        await run({ ...receipt, private: false }, 'create')
        await run(receipt, 'update', receipt)

        expect(send).not.toHaveBeenCalled()
    })

    it('logs, without failing the upload, when storage refuses the ACL', async () => {
        send.mockRejectedValue(new Error('AccessDenied'))

        await expect(run(receipt, 'create')).resolves.toMatchObject({ id: 31 })
        expect(logError).toHaveBeenCalledWith(expect.stringContaining('AccessDenied'))
    })

    it('builds keys the way the storage plugin stores them ({prefix}/{_objectKey}/{filename})', () => {
        expect(mediaObjectKeys({ filename: 'a.jpg', prefix: 'shop/', _objectKey: 'k' })).toEqual(['shop/k/a.jpg'])
        expect(mediaObjectKeys({ filename: 'a.jpg' })).toEqual(['a.jpg'])
    })

    it('runs after the storage plugin\'s upload hook (appended last on media only)', () => {
        const uploadHook = vi.fn()
        const config = { collections: [{ slug: 'media', fields: [], hooks: { afterChange: [uploadHook] } }, { slug: 'pages', fields: [] }] } as unknown as Config

        const out = privateMediaAclPlugin()(config) as Config

        const media = out.collections!.find((c) => c.slug === 'media')!
        expect(media.hooks!.afterChange).toHaveLength(2)
        expect(media.hooks!.afterChange![0]).toBe(uploadHook)
        expect(out.collections!.find((c) => c.slug === 'pages')!.hooks).toBeUndefined()
    })
})

describe('repair of receipts stored before #1996 [TC-PERF-171]', () => {
    // an old receipt: marked private by db-setup, still under the buyer's file name, no object key folder
    const oldReceipt = { id: 7, private: true, filename: 'Aina Maybank receipt.jpg', prefix: null, _objectKey: null }
    const lines: string[] = []
    const log = (line: string) => lines.push(line)

    beforeEach(() => {
        lines.length = 0
    })

    it('dry run (default): lists the objects and changes nothing', async () => {
        // Act
        const out = await privatizeStoredMedia([oldReceipt, receipt], { apply: false, s3: s3(), log })

        // Assert
        expect(send).not.toHaveBeenCalled()
        expect(out).toMatchObject({ rows: 2, objects: 3, done: 0, failed: [] })
        expect(lines.join('\n')).toContain('would set Aina Maybank receipt.jpg private')
    })

    it('apply: sets every object of every private row to the private ACL', async () => {
        // Act
        const out = await privatizeStoredMedia([oldReceipt, receipt], { apply: true, s3: s3(), log })

        // Assert
        expect(aclCalls()).toEqual([
            { Bucket: 'media-bucket', Key: 'Aina Maybank receipt.jpg', ACL: 'private' },
            { Bucket: 'media-bucket', Key: 'k1/payment-proof-abc.jpg', ACL: 'private' },
            { Bucket: 'media-bucket', Key: 'k1/payment-proof-abc-400x300.jpg', ACL: 'private' },
        ])
        expect(out).toMatchObject({ objects: 3, done: 3, failed: [] })
    })

    it('never touches a public row, even if one is passed', async () => {
        await privatizeStoredMedia([{ ...oldReceipt, private: false }], { apply: true, s3: s3(), log })

        expect(send).not.toHaveBeenCalled()
    })

    it('reports an object storage refused and goes on with the rest', async () => {
        // Arrange
        send.mockRejectedValueOnce(new Error('NoSuchKey'))

        // Act
        const out = await privatizeStoredMedia([oldReceipt, receipt], { apply: true, s3: s3(), log })

        // Assert
        expect(out.done).toBe(2)
        expect(out.failed).toEqual([{ id: 7, key: 'Aina Maybank receipt.jpg', error: 'NoSuchKey' }])
    })

    it('refuses to apply without storage configured', async () => {
        await expect(privatizeStoredMedia([oldReceipt], { apply: true, s3: null })).rejects.toThrow(/not configured/)
    })
})
