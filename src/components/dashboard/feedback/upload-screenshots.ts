import { compressScreenshot } from './compress-screenshot'

export const SCREENSHOT_ENDPOINT = '/api/feedback/screenshots'

// A retry after a failed submit must not push already-uploaded files to Lark again.
const uploaded = new WeakMap<File, string>()

export class ScreenshotUploadError extends Error {
    constructor(readonly status: number | null, message: string) {
        super(message)
        this.name = 'ScreenshotUploadError'
    }
}

async function uploadOne(file: File): Promise<string> {
    const cached = uploaded.get(file)
    if (cached) return cached

    const form = new FormData()
    form.append('file', await compressScreenshot(file)) // large images shrink to fit the serverless body limit
    const res = await fetch(SCREENSHOT_ENDPOINT, { method: 'POST', body: form })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new ScreenshotUploadError(res.status, json?.error?.message ?? `Screenshot upload failed (${res.status})`)
    if (typeof json?.fileToken !== 'string' || !json.fileToken) throw new ScreenshotUploadError(res.status, 'No file token returned')
    uploaded.set(file, json.fileToken)
    return json.fileToken
}

/** Uploads screenshots to Lark one by one (max 3) and returns their attachment tokens in order. */
export async function uploadScreenshots(files: File[]): Promise<string[]> {
    const tokens: string[] = []
    for (const file of files) tokens.push(await uploadOne(file))
    return tokens
}
