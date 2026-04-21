'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { ImagePlus, Sparkles, Loader2, Film } from 'lucide-react'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'

const parentToast = {
    success: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'success', message: msg }, window.location.origin),
    error: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'error', message: msg }, window.location.origin),
    info: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'info', message: msg }, window.location.origin),
}
import { compressImage } from '@/lib/media/compress-image'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'

type HeroMediaOverlayProps = {
    children: ReactNode
    field: string
    altText?: string
    className?: string
    positionClass?: string
    showVideoButton?: boolean
    videoField?: string
    onVideoUploaded?: (url: string) => void
}

export function HeroMediaOverlay({
    children,
    field,
    altText = 'Hero image',
    className = '',
    positionClass,
    showVideoButton = false,
    videoField,
    onVideoUploaded,
}: HeroMediaOverlayProps) {
    const isOwner = useIsOwner()
    const callback = useBlockEditCallback()
    const containerRef = useRef<HTMLDivElement>(null)
    const imageFileRef = useRef<HTMLInputElement>(null)
    const videoFileRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [isTextEditing, setIsTextEditing] = useState(false)

    useEffect(() => {
        let textEditingTarget: EventTarget | null = null
        const onFocusin = (e: FocusEvent) => {
            if ((e.target as HTMLElement)?.isContentEditable) {
                textEditingTarget = e.target
                setIsTextEditing(true)
            }
        }
        const onFocusout = (e: FocusEvent) => {
            // cleanUpEditing() in PreviewScripts removes contenteditable before focusout fires,
            // so we cannot check isContentEditable here. Track the target by reference instead.
            if (e.target === textEditingTarget) {
                textEditingTarget = null
                setIsTextEditing(false)
            }
        }
        document.addEventListener('focusin', onFocusin)
        document.addEventListener('focusout', onFocusout)
        return () => {
            document.removeEventListener('focusin', onFocusin)
            document.removeEventListener('focusout', onFocusout)
        }
    }, [])

    if (!isOwner || !callback) return <>{children}</>

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            const uploaded = await Promise.race([
                uploadMediaAction(formData),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Upload timeout')), 30000)
                ),
            ])
            callback.onFieldChange(field, uploaded.url)
            parentToast.success('Image updated')
        } catch (err) {
            parentToast.error(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setUploading(false)
            if (imageFileRef.current) imageFileRef.current.value = ''
        }
    }

    const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!['video/mp4', 'video/webm'].includes(file.type)) {
            parentToast.error('Only MP4 and WebM videos are supported')
            return
        }
        if (!videoField) return
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('alt', 'Hero video')
            const uploaded = await uploadMediaAction(formData)
            const video = containerRef.current?.querySelector('video')
            if (video) {
                // Subsequent upload: update src in-place — no React re-render, no flicker
                video.src = uploaded.url
                video.load()
            } else {
                // First upload: no <video> in DOM yet — let VideoHero React state render it
                onVideoUploaded?.(uploaded.url)
            }
            callback.onFieldChange(videoField, uploaded.url)
            parentToast.success('Video updated')
        } catch (err) {
            parentToast.error(err instanceof Error ? err.message : 'Video upload failed')
        } finally {
            setUploading(false)
            if (videoFileRef.current) videoFileRef.current.value = ''
        }
    }

    return (
        <div ref={containerRef} className={[positionClass ?? 'relative', 'group/media-overlay', className].filter(Boolean).join(' ')}>
            {children}
            <div
                data-editor-control
                className={[
                    'absolute inset-0 z-10 bg-black/0 transition-colors duration-200 flex items-start justify-end p-2',
                    'opacity-0 pointer-events-none',
                    !isTextEditing && 'group-hover/media-overlay:bg-black/30 group-hover/media-overlay:opacity-100 group-hover/media-overlay:pointer-events-auto',
                ].filter(Boolean).join(' ')}
            >
                <div data-editor-control className="flex items-center gap-1 bg-[#1E293B] border border-white/10 shadow-2xl rounded-lg p-1.5">
                    {uploading ? (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                        </span>
                    ) : (
                        <>
                            {!showVideoButton && (
                                <button
                                    type="button"
                                    onClick={() => imageFileRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 rounded transition-colors"
                                >
                                    <ImagePlus className="w-4 h-4" />
                                    Change Image
                                </button>
                            )}
                            {!showVideoButton && (
                                <>
                                    <div className="w-px h-5 bg-white/10 mx-1" />
                                    <button
                                        type="button"
                                        onClick={() => parentToast.info('AI image generation coming soon')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-cyan-400 hover:bg-cyan-400/10 rounded transition-colors"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Generate AI Image
                                    </button>
                                </>
                            )}
                            {showVideoButton && videoField && (
                                <button
                                    type="button"
                                    onClick={() => videoFileRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 rounded transition-colors"
                                >
                                    <Film className="w-4 h-4" />
                                    Change Video
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
            <input
                ref={imageFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageSelect}
            />
            <input
                ref={videoFileRef}
                type="file"
                accept="video/mp4,video/webm"
                className="hidden"
                onChange={handleVideoSelect}
            />
        </div>
    )
}
