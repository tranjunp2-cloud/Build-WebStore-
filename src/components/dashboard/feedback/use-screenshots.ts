'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    ACCEPTED_SCREENSHOT_TYPES,
    MAX_SCREENSHOTS,
    MAX_SCREENSHOT_BYTES,
} from './types'

export type ScreenshotError = 'tooLarge' | 'wrongType'
export type ScreenshotItem = { id: string; file: File; previewUrl: string; error?: ScreenshotError }

const validate = (file: File): ScreenshotError | undefined => {
    if (!(ACCEPTED_SCREENSHOT_TYPES as readonly string[]).includes(file.type)) return 'wrongType'
    if (file.size > MAX_SCREENSHOT_BYTES) return 'tooLarge'
    return undefined
}

/**
 * Screenshot list with per-file validation. Files stay in the browser until the feedback is
 * submitted. Invalid files stay in the list (flagged) so the user sees which one is wrong and
 * removes it; the form refuses to submit while any is flagged.
 */
export function useScreenshots() {
    const [items, setItems] = useState<ScreenshotItem[]>([])
    const [overflow, setOverflow] = useState(false)
    const count = useRef(0)
    const urls = useRef(new Set<string>())
    count.current = items.length

    const add = useCallback((files: File[]) => {
        // Only the first files that fit are kept; the rest are dropped with a notice.
        setOverflow(files.length > MAX_SCREENSHOTS - count.current)
        setItems((prev) => {
            const room = MAX_SCREENSHOTS - prev.length
            const next = files.slice(0, Math.max(0, room)).map((file) => {
                const previewUrl = URL.createObjectURL(file)
                urls.current.add(previewUrl)
                return { id: crypto.randomUUID(), file, previewUrl, error: validate(file) }
            })
            return [...prev, ...next]
        })
    }, [])

    const remove = useCallback((id: string) => {
        setOverflow(false)
        setItems((prev) => {
            const gone = prev.find((i) => i.id === id)
            if (gone) {
                URL.revokeObjectURL(gone.previewUrl)
                urls.current.delete(gone.previewUrl)
            }
            return prev.filter((i) => i.id !== id)
        })
    }, [])

    useEffect(() => {
        const set = urls.current
        return () => { set.forEach((u) => URL.revokeObjectURL(u)); set.clear() }
    }, [])

    return { items, add, remove, overflow, hasError: items.some((i) => i.error) }
}
