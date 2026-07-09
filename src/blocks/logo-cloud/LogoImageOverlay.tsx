'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { compressImage } from '@/lib/media/compress-image'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useIsBuilderPreview } from '@/components/site-renderer/BuilderPreviewContext'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'

const parentToast = {
    success: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'success', message: msg }, window.location.origin),
    error: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'error', message: msg }, window.location.origin),
}

type Props = {
    children: ReactNode
    logoIndex: number
    altText?: string
}

export function LogoImageOverlay({ children, logoIndex, altText = 'Logo' }: Props) {
    const isOwner = useIsOwner()
    const isBuilderPreview = useIsBuilderPreview()
    const callback = useBlockEditCallback()
    const fileRef = useRef<HTMLInputElement>(null)
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const [uploading, setUploading] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    useEffect(() => {
        // GH-1461 adversarial-review fix: match the JSX render guard below so this effect
        // never attaches listeners in builder-preview even if the isBuilderPreview->null
        // callback invariant (enforced in SiteRenderer.tsx) is ever bypassed by a future caller.
        if (!isOwner || !callback || isBuilderPreview) return
        const onBlur = () => {
            clearTimeout(hideTimer.current)
            setIsHovered(false)
        }
        window.addEventListener('blur', onBlur)
        return () => {
            window.removeEventListener('blur', onBlur)
            clearTimeout(hideTimer.current)
        }
    }, [isOwner, callback, isBuilderPreview])

    // GH-1461: AI Builder read-only preview panel — hide edit overlay even though
    // isOwner is true there (isOwner stays true for analytics-exclusion purposes).
    if (!isOwner || !callback || isBuilderPreview) return <>{children}</>

    const handleMouseEnter = () => {
        clearTimeout(hideTimer.current)
        setIsHovered(true)
    }
    // Delayed hide so the cursor can travel from logo to the floating button above
    const handleMouseLeave = () => {
        hideTimer.current = setTimeout(() => setIsHovered(false), 120)
    }

    const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            parentToast.error('Only JPG, PNG, and WebP images are supported')
            return
        }
        setUploading(true)
        try {
            const compressed = await compressImage(file)
            const formData = new FormData()
            formData.append('file', compressed)
            formData.append('alt', altText)
            const { uploadMediaAction } = await import('@/app/(dashboard)/actions/media')
            const uploaded = await uploadMediaAction(formData)
            callback.onFieldChange(`logos.${logoIndex}.logo`, { id: uploaded.id, url: uploaded.url, alt: altText })
            parentToast.success('Logo updated')
        } catch (err) {
            parentToast.error(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-editor-control]')) return
                setIsHovered(v => !v)
            }}
        >
            {children}
            {/* Button floats above the logo — onMouseEnter/Leave on the button itself cancel the hide timer */}
            <div
                data-editor-control
                className={[
                    'absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 transition-all duration-200',
                    isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                ].join(' ')}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div data-editor-control className="flex items-center gap-1 bg-[#1E293B] border border-white/10 shadow-2xl rounded-lg p-1.5">
                    {uploading ? (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white whitespace-nowrap">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 rounded transition-colors whitespace-nowrap"
                        >
                            <ImagePlus className="w-4 h-4" />
                            Change Image
                        </button>
                    )}
                </div>
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleSelect}
            />
        </div>
    )
}
