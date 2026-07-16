'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { ImagePlus, Loader2, Film } from 'lucide-react'
import { useUploadProgress } from '@/hooks/use-upload-progress'
import { useDirectUpload } from '@/hooks/use-direct-upload'

const parentToast = {
    success: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'success', message: msg }, window.location.origin),
    error: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'error', message: msg }, window.location.origin),
    info: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'info', message: msg }, window.location.origin),
}
import { compressImage } from '@/lib/media/compress-image'
import { checkUploadSize, uploadLimitLabel } from '@/lib/media/upload-limits'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'

type HeroMediaOverlayProps = {
    children: ReactNode
    field: string
    altText?: string
    className?: string
    positionClass?: string
    showImageButton?: boolean
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
    showImageButton = true,
    showVideoButton = false,
    videoField,
    onVideoUploaded,
}: HeroMediaOverlayProps) {
    const isOwner = useIsOwner()
    const callback = useBlockEditCallback()
    const containerRef = useRef<HTMLDivElement>(null)
    const imageFileRef = useRef<HTMLInputElement>(null)
    const videoFileRef = useRef<HTMLInputElement>(null)
    const { upload, progress: imgProgress, isUploading: imgUploading } = useUploadProgress()
    // Video uses direct-to-S3 (bypasses the 4.5MB Vercel body limit — GH-1284).
    const { upload: uploadVideo, progress: vidProgress, isUploading: vidUploading } = useDirectUpload()
    // The two flows never run at once (one file at a time), so share one bar.
    const uploading = imgUploading || vidUploading
    const progress = vidUploading ? vidProgress : imgProgress
    const [isTextEditing, setIsTextEditing] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

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

    // Track hover on the parent element (section) so the toolbar shows even when sibling
    // content divs (e.g. glass card in cards-overlay) sit on top and intercept mouse events.
    useEffect(() => {
        if (!isOwner || !callback) return
        const parent = containerRef.current?.parentElement
        if (!parent) return
        const onEnter = () => setIsHovered(true)
        const onLeave = () => setIsHovered(false)
        // When the native file picker opens the browser window loses focus but mouseleave
        // never fires on the parent, so the overlay gets stuck visible. Reset on blur.
        const onWindowBlur = () => setIsHovered(false)
        parent.addEventListener('mouseenter', onEnter)
        parent.addEventListener('mouseleave', onLeave)
        window.addEventListener('blur', onWindowBlur)
        return () => {
            parent.removeEventListener('mouseenter', onEnter)
            parent.removeEventListener('mouseleave', onLeave)
            window.removeEventListener('blur', onWindowBlur)
        }
    }, [isOwner, callback])

    if (!isOwner || !callback) return <>{children}</>

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            parentToast.error('Only JPG, PNG, and WebP images are supported')
            return
        }
        try {
            const compressed = await compressImage(file)
            const formData = new FormData()
            formData.append('file', compressed)
            formData.append('alt', altText)
            const uploaded = await upload(formData)
            // Strip ".url" suffix to get the Payload upload field root (e.g. "image.url" → "image").
            // Send a hydrated object {id, url} so the block renders immediately AND the save route
            // can extract the integer Media ID via normalizeUploadField.
            const imageField = field.endsWith('.url') ? field.slice(0, -4) : field
            callback.onFieldChange(imageField, { id: uploaded.id, url: uploaded.url, alt: altText })
            parentToast.success('Image updated')
        } catch (err) {
            parentToast.error(err instanceof Error ? err.message : 'Upload failed')
        } finally {
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
        // GH-1284 — reject oversized videos up front so the user gets an instant,
        // clear error instead of a spinner that runs into the 120s upload timeout.
        const sizeError = checkUploadSize(file.type, file.size)
        if (sizeError) {
            parentToast.error(sizeError)
            return
        }
        if (!videoField) return
        try {
            // Direct-to-S3 (GH-1284): video bypasses the 4.5MB Vercel body limit.
            const uploaded = await uploadVideo(file, { alt: 'Hero video' })
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
            if (videoFileRef.current) videoFileRef.current.value = ''
        }
    }

    return (
        <div ref={containerRef} className={[positionClass ?? 'relative', 'group/media-overlay', className].filter(Boolean).join(' ')}>
            {children}
            <div
                data-editor-control
                className={[
                    'absolute inset-0 z-10 transition-colors duration-200 flex items-start justify-end p-2',
                    (isHovered && !isTextEditing) || uploading ? 'bg-black/30 opacity-100 pointer-events-auto' : 'bg-black/0 opacity-0 pointer-events-none',
                ].filter(Boolean).join(' ')}
            >
                <div data-editor-control className="flex items-center gap-1 bg-[#1E293B] border border-white/10 shadow-2xl rounded-lg p-1.5">
                    {uploading ? (
                        <div className="flex flex-col gap-1.5 px-3 py-1.5 min-w-[160px]">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {progress < 100 ? `Uploading... ${progress}%` : 'Processing...'}
                            </span>
                            <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-teal-400 transition-all duration-150"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            {showImageButton && (
                            <button
                                type="button"
                                onClick={() => imageFileRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 rounded transition-colors"
                            >
                                <ImagePlus className="w-4 h-4" />
                                Change Image
                            </button>
                            )}
                            {showVideoButton && videoField && (
                                <button
                                    type="button"
                                    onClick={() => videoFileRef.current?.click()}
                                    title={`MP4 or WebM, max ${uploadLimitLabel('video')}`}
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
