'use client'

import { useState, useCallback } from 'react'

type MediaDoc = {
    id: string | number
    url: string
    [key: string]: unknown
}

/** XHR-based media upload with real progress tracking (0–100).
 * Progress caps at 95 during transfer; jumps to 100 when server responds. */
export function useUploadProgress() {
    const [progress, setProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)

    const reset = useCallback(() => {
        setProgress(0)
        setIsUploading(false)
    }, [])

    const upload = useCallback((formData: FormData): Promise<MediaDoc> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            setIsUploading(true)
            setProgress(0)

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    // Cap at 95 — leaves room for server-side S3 write
                    setProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)))
                }
            })

            xhr.addEventListener('load', () => {
                setProgress(100)
                setIsUploading(false)
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText))
                    } catch {
                        reject(new Error('Invalid server response'))
                    }
                } else {
                    try {
                        const body = JSON.parse(xhr.responseText)
                        reject(new Error(body.error ?? 'Upload failed'))
                    } catch {
                        reject(new Error(`Upload failed (${xhr.status})`))
                    }
                }
            })

            xhr.addEventListener('error', () => {
                setIsUploading(false)
                reject(new Error('Network error during upload'))
            })

            xhr.addEventListener('abort', () => {
                setIsUploading(false)
                reject(new Error('Upload cancelled'))
            })

            xhr.addEventListener('timeout', () => {
                setIsUploading(false)
                reject(new Error('Upload timed out'))
            })

            xhr.timeout = 120_000 // match Vercel maxDuration
            xhr.open('POST', '/api/media/upload')
            xhr.send(formData)
        })
    }, [])

    return { upload, progress, isUploading, reset }
}
