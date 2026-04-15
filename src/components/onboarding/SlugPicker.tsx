'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'

interface SlugCheckResult {
    available: boolean
    suggestion?: string
    reason?: string
    message?: string
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'error'

interface SlugPickerProps {
    /** Business name to auto-generate slug from */
    businessName?: string
    /** Called when slug changes (for parent form to track) */
    onSlugChange?: (slug: string, available: boolean) => void
    /** Platform domain suffix for preview */
    platformDomain?: string
}

/** Client-side slugify for instant preview (mirrors server-side logic) */
function clientSlugify(name: string): string {
    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 63)
    return slug.length >= 3 ? slug : ''
}

export default function SlugPicker({ businessName = '', onSlugChange, platformDomain }: SlugPickerProps) {
    const { t } = useI18n()
    const f = t.onboarding.form
    const [slug, setSlug] = useState('')
    const [status, setStatus] = useState<SlugStatus>('idle')
    const [message, setMessage] = useState('')
    const [suggestion, setSuggestion] = useState('')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    const domain = platformDomain || process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'

    // Auto-generate slug from business name
    useEffect(() => {
        if (businessName) {
            const generated = clientSlugify(businessName)
            if (generated) {
                setSlug(generated)
            }
        }
    }, [businessName])

    const checkAvailability = useCallback(async (slugToCheck: string) => {
        if (slugToCheck.length < 3) {
            setStatus('invalid')
            setMessage(f.slugMinLength)
            onSlugChange?.(slugToCheck, false)
            return
        }

        // Cancel previous request
        abortRef.current?.abort()
        abortRef.current = new AbortController()

        setStatus('checking')
        setMessage('')
        setSuggestion('')

        try {
            const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(slugToCheck)}`, {
                signal: abortRef.current.signal,
            })
            const data: SlugCheckResult = await res.json()

            if (res.ok && data.available) {
                setStatus('available')
                setMessage('')
                onSlugChange?.(slugToCheck, true)
            } else if (res.status === 422) {
                setStatus('invalid')
                setMessage(data.message || f.slugInvalidFormat)
                onSlugChange?.(slugToCheck, false)
            } else if (res.status === 409) {
                setStatus('unavailable')
                setMessage(f.slugReserved)
                onSlugChange?.(slugToCheck, false)
            } else {
                setStatus('unavailable')
                setMessage(f.slugTaken)
                if (data.suggestion) setSuggestion(data.suggestion)
                onSlugChange?.(slugToCheck, false)
            }
        } catch (err) {
            if ((err as Error).name === 'AbortError') return
            setStatus('error')
            setMessage(f.slugCheckError)
            onSlugChange?.(slugToCheck, false)
        }
    }, [onSlugChange, f.slugMinLength, f.slugInvalidFormat, f.slugReserved, f.slugTaken, f.slugCheckError])

    // Debounced check when slug changes
    useEffect(() => {
        if (!slug) {
            setStatus('idle')
            return
        }

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            checkAvailability(slug)
        }, 400)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [slug, checkAvailability])

    const handleInputChange = (value: string) => {
        // Force lowercase, only allowed chars
        const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63)
        setSlug(cleaned)
    }

    const applySuggestion = () => {
        if (suggestion) {
            setSlug(suggestion)
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <label className="text-[12px] font-medium text-[rgba(248,250,252,0.6)] uppercase tracking-wider">
                {f.slugLabel}
            </label>

            <div className="flex items-center gap-0">
                {/* Slug input */}
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={slug}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder={f.slugPlaceholder}
                        className="h-[44px] w-full px-4 rounded-l-[12px] border border-r-0 border-white/[0.08] bg-[#1E293B]/40 text-[14px] text-[#F8FAFC] font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    {/* Status icon */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {status === 'checking' && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
                        {status === 'available' && <Check className="h-4 w-4 text-[#05DF72]" />}
                        {(status === 'unavailable' || status === 'invalid') && <X className="h-4 w-4 text-[#FF6467]" />}
                    </div>
                </div>

                {/* Domain suffix */}
                <div className="h-[44px] flex items-center px-3 rounded-r-[12px] border border-l-0 border-white/[0.08] bg-[#0B1120]/60 text-[13px] text-slate-500 whitespace-nowrap">
                    .{domain}
                </div>
            </div>

            {/* Status badge + message */}
            {status !== 'idle' && (
                <div className="flex items-center gap-2">
                    {status === 'available' && (
                        <div className="flex items-center gap-1.5 h-[26px] px-3 rounded-full border border-[#00C950]/30 bg-[#00C950]/10">
                            <Check className="h-3 w-3 text-[#05DF72]" strokeWidth={2.5} />
                            <span className="text-[12px] font-medium text-[#B9F8CF]">{f.slugAvailable}</span>
                        </div>
                    )}
                    {status === 'unavailable' && (
                        <div className="flex items-center gap-1.5 h-[26px] px-3 rounded-full border border-[rgba(251,44,54,0.3)] bg-[rgba(251,44,54,0.1)]">
                            <X className="h-3 w-3 text-[#FF6467]" strokeWidth={2.5} />
                            <span className="text-[12px] font-medium text-[#FFC9C9]">{message || f.slugTaken}</span>
                        </div>
                    )}
                    {status === 'invalid' && (
                        <span className="text-[12px] text-[#FF6467]">{message}</span>
                    )}
                    {status === 'checking' && (
                        <span className="text-[12px] text-slate-500">{f.slugChecking}</span>
                    )}
                    {status === 'error' && (
                        <span className="text-[12px] text-orange-400">{message}</span>
                    )}
                </div>
            )}

            {/* Suggestion */}
            {suggestion && status === 'unavailable' && (
                <button
                    type="button"
                    onClick={applySuggestion}
                    className="text-left text-[12px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                    <span className="font-mono font-medium">{suggestion}</span>
                </button>
            )}

            {/* Helper text */}
            <p className="text-[11px] text-slate-600">
                {f.slugHelperText}
            </p>
        </div>
    )
}
