// Single source of truth for the public URL of an S3-stored media object.
// Used by the s3Storage generateFileURL (payload.config.ts) AND the presign
// endpoint so the two never drift. Path-style URL (forcePathStyle: true) —
// `{publicEndpoint}/{bucket}/{prefix?}/{filename}`.
// Every media object is written public-read so s3PublicUrl() can serve it. The
// production bucket (shared with PW1) has no bucket-wide public policy because it
// also stores private imports/exports, so the ACL must travel with each object.
export const MEDIA_OBJECT_ACL = 'public-read' as const

export function s3PublicUrl(filename: string, prefix?: string): string {
    const s3Endpoint = process.env.S3_ENDPOINT || ''
    const publicEndpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT || s3Endpoint
    const bucket = process.env.S3_BUCKET || ''
    return `${publicEndpoint}/${bucket}/${prefix ? `${prefix}/` : ''}${filename}`
}
