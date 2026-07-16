'use client'

import { useState, useCallback } from 'react'

type MediaDoc = { id: string | number; url: string; [key: string]: unknown }

// GH-1284 — direct-to-S3 upload for large files (video) that exceed Vercel's
// 4.5MB function body limit. Three steps, all from the browser:
//   1. POST /api/media/presign  → presigned POST (url + fields) + minted key
//   2. POST the file STRAIGHT to S3 (XHR, real progress) — never touches Vercel
//   3. POST /api/media/register → create the Payload media row, returns { id, url }
// Requires S3 bucket CORS to allow POST from the app origin (see plan phase 04).
export function useDirectUpload() {
    const [progress, setProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)

    const reset = useCallback(() => {
        setProgress(0)
        setIsUploading(false)
    }, [])

    const upload = useCallback(async (file: File, opts: { alt: string }): Promise<MediaDoc> => {
        setIsUploading(true)
        setProgress(0)
        try {
            // 1. presign
            const presignRes = await fetch('/api/media/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
            })
            if (!presignRes.ok) {
                const body = await presignRes.json().catch(() => ({}))
                throw new Error(body.error ?? 'Could not prepare upload')
            }
            const { url, fields, key } = await presignRes.json()

            // 2. POST straight to S3. Fields FIRST, file LAST. Do NOT append
            // Content-Type — it is already in `fields` (duplicate fails the policy).
            const form = new FormData()
            for (const [k, v] of Object.entries(fields as Record<string, string>)) form.append(k, v)
            form.append('file', file)
            await putToS3(url, form, setProgress)

            // 3. register
            const registerRes = await fetch('/api/media/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, alt: opts.alt }),
            })
            if (!registerRes.ok) {
                const body = await registerRes.json().catch(() => ({}))
                throw new Error(body.error ?? 'Could not register upload')
            }
            const media = (await registerRes.json()) as MediaDoc
            setProgress(100)
            return media
        } finally {
            setIsUploading(false)
        }
    }, [])

    return { upload, progress, isUploading, reset }
}

/** XHR POST to S3 with upload progress (0–95). Resolves on 2xx, rejects with a
 *  useful message on failure (S3 returns XML; EntityTooLarge → size hint). */
function putToS3(url: string, form: FormData, onProgress: (n: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)))
        })
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve()
            if (/EntityTooLarge/i.test(xhr.responseText)) return reject(new Error('Video exceeds the size limit'))
            reject(new Error(`Upload failed (${xhr.status})`))
        })
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))
        xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')))
        xhr.timeout = 300_000 // 100MB on a slow line can exceed 2 min; S3 has no function maxDuration
        xhr.open('POST', url)
        xhr.send(form)
    })
}
