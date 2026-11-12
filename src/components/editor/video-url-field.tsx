'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { parseVideoUrl } from '@/lib/video/parse-video-url'

type VideoUrlFieldProps = {
    value?: string
    label: string
    placeholder: string
    invalidMessage: string
    onChange: (value: string) => void
    className?: string
    labelClassName?: string
}

// GH-2062: Video URL input for the Block Settings panel. Validates on blur with the same
// parser the renderer uses; an invalid link shows an inline error and is never saved.
export function VideoUrlField({ value, label, placeholder, invalidMessage, onChange, className, labelClassName }: VideoUrlFieldProps) {
    const [error, setError] = useState(false)
    const [draft, setDraft] = useState(value ?? '')
    // Re-sync when the value changes elsewhere (Change Video upload, undo/redo) so a later
    // blur never writes back a stale link. Adjust-state-during-render, no effect.
    const [prevValue, setPrevValue] = useState(value)
    if (prevValue !== value) {
        setPrevValue(value)
        setDraft(value ?? '')
        setError(false)
    }
    const inputId = 'video-url-input'

    const handleBlur = (raw: string) => {
        const trimmed = raw.trim()
        // videoUrl is `required` in Pages.ts, so empty is invalid (clearing would fail save/publish).
        // Untouched field: never call onChange (would revert external updates).
        if (trimmed === (value ?? '').trim()) {
            setError(false)
            return
        }
        if (!parseVideoUrl(trimmed)) {
            setError(true)
            return
        }
        setError(false)
        onChange(trimmed)
    }

    return (
        <div>
            <label htmlFor={inputId} className={labelClassName}>{label}</label>
            <Input
                id={inputId}
                value={draft}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
                placeholder={placeholder}
                aria-invalid={error}
                aria-describedby={error ? `${inputId}-error` : undefined}
                onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleBlur(e.target.value)}
                variant="editor"
                className={className}
            />
            {error && <p id={`${inputId}-error`} role="alert" className="text-red-400 text-[11px] mt-1">{invalidMessage}</p>}
        </div>
    )
}
