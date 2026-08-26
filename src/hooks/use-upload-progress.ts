'use client'

import { useState, useCallback } from 'react'
import { DirectUploadUnavailableError, useDirectUpload } from './use-direct-upload'

type MediaDoc = {
    id: string | number
    url: string
    [key: string]: unknown
}

/** Direct media upload with real progress tracking (0–100), plus a buffered
 * route fallback for local development without object storage. */
export function useUploadProgress() {
    const {
        upload: directUpload,
        progress: directProgress,
        isUploading: directUploading,
        reset: resetDirect,
    } = useDirectUpload()
    const [legacyProgress, setLegacyProgress] = useState(0)
    const [legacyUploading, setLegacyUploading] = useState(false)

    const reset = useCallback(() => {
        resetDirect()
        setLegacyProgress(0)
        setLegacyUploading(false)
    }, [resetDirect])

    const legacyUpload = useCallback((formData: FormData): Promise<MediaDoc> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            setLegacyUploading(true)
            setLegacyProgress(0)

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    // Cap at 95 — leaves room for server-side S3 write
                    setLegacyProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)))
                }
            })

            xhr.addEventListener('load', () => {
                setLegacyProgress(100)
                setLegacyUploading(false)
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
                setLegacyUploading(false)
                reject(new Error('Network error during upload'))
            })

            xhr.addEventListener('abort', () => {
                setLegacyUploading(false)
                reject(new Error('Upload cancelled'))
            })

            xhr.addEventListener('timeout', () => {
                setLegacyUploading(false)
                reject(new Error('Upload timed out'))
            })

            xhr.timeout = 120_000 // match Vercel maxDuration
            xhr.open('POST', '/api/media/upload')
            xhr.send(formData)
        })
    }, [])

    const upload = useCallback(async (formData: FormData): Promise<MediaDoc> => {
        const file = formData.get('file')
        if (!(file instanceof File)) throw new Error('No file provided')
        const altRaw = formData.get('alt')
        const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : file.name

        try {
            return await directUpload(file, { alt })
        } catch (err) {
            // Local development can run without object storage. Only fall back
            // when presigning was unavailable, before any object was uploaded.
            if (err instanceof DirectUploadUnavailableError) {
                return legacyUpload(formData)
            }
            throw err
        }
    }, [directUpload, legacyUpload])

    const progress = legacyUploading ? legacyProgress : directProgress
    const isUploading = legacyUploading || directUploading

    return { upload, progress, isUploading, reset }
}
