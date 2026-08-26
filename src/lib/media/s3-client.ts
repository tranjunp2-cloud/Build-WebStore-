import { S3Client } from '@aws-sdk/client-s3'

export function isS3Configured(): boolean {
    return Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET)
}

// Shared S3 client builder — same config the s3Storage plugin and
// carton-placeholder use (forcePathStyle for MinIO/dev; works on AWS too).
// Returns null when S3 is not configured (local without storage env).
export function buildS3Client(): { client: S3Client; bucket: string } | null {
    const endpoint = process.env.S3_ENDPOINT
    const bucket = process.env.S3_BUCKET
    if (!endpoint || !bucket) return null
    const client = new S3Client({
        endpoint,
        region: process.env.S3_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
        },
        forcePathStyle: true, // required for MinIO; harmless on AWS
    })
    return { client, bucket }
}
