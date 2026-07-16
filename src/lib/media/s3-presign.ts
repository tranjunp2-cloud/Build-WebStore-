import { createPresignedPost, type PresignedPost } from '@aws-sdk/s3-presigned-post'
import { buildS3Client } from './s3-client'

// Presigned POST (not PUT) so the S3 policy can enforce a hard size ceiling via
// `content-length-range` — the client cannot exceed maxBytes even if it lies.
const EXPIRES_SECONDS = 300 // 5 min — enough to upload 100MB on a slow line

/**
 * Create a presigned POST that lets the browser upload one video directly to S3,
 * bypassing the Vercel function 4.5MB request-body limit (GH-1284).
 * The policy pins the object key, Content-Type, and a 0..maxBytes size range.
 */
export async function createVideoPresignedPost({
    key,
    contentType,
    maxBytes,
}: {
    key: string
    contentType: string
    maxBytes: number
}): Promise<PresignedPost> {
    const s3 = buildS3Client()
    if (!s3) throw new Error('S3 not configured')
    return createPresignedPost(s3.client, {
        Bucket: s3.bucket,
        Key: key,
        Conditions: [
            ['content-length-range', 0, maxBytes],
            ['eq', '$Content-Type', contentType],
        ],
        Fields: { 'Content-Type': contentType },
        Expires: EXPIRES_SECONDS,
    })
}
