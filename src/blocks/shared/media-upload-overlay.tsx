'use client'

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { ImagePlus, Loader2, Film } from 'lucide-react'
import { useUploadProgress } from '@/hooks/use-upload-progress'
import { compressImage } from '@/lib/media/compress-image'
import { checkUploadSize, uploadLimitLabel } from '@/lib/media/upload-limits'
import { useIsOwner } from '@/components/site-renderer/OwnerContext'
import { useIsBuilderPreview } from '@/components/site-renderer/BuilderPreviewContext'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'

// Toast bridge — overlay runs inside the preview iframe; routes to the parent editor.
const parentToast = {
    success: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'success', message: msg }, window.location.origin),
    error: (msg: string) => window.parent.postMessage({ type: 'SHOW_TOAST', variant: 'error', message: msg }, window.location.origin),
}

/**
 * GH-1381: wait for the parent editor's BLOCK_FIELD_CHANGE_RESULT ACK so the success
 * toast fires only after the change is actually applied and the save settled. The old
 * fire-and-forget toast reported success even when the parent handler crashed
 * (silent data loss). Falls back to ok after `timeoutMs` if no ACK arrives (e.g. a
 * host that doesn't implement the reply), preserving legacy behavior.
 */
function waitForFieldChangeResult(blockIndex: number, field: string, timeoutMs = 10000): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
        const cleanup = () => {
            window.clearTimeout(timer)
            window.removeEventListener('message', onMessage)
        }
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return
            const d = e.data as { type?: string; blockIndex?: number; field?: string; ok?: boolean; error?: string } | null
            if (d?.type !== 'BLOCK_FIELD_CHANGE_RESULT' || d.blockIndex !== blockIndex || d.field !== field) return
            cleanup()
            resolve({ ok: d.ok === true, error: typeof d.error === 'string' ? d.error : undefined })
        }
        const timer = window.setTimeout(() => { cleanup(); resolve({ ok: true }) }, timeoutMs)
        window.addEventListener('message', onMessage)
    })
}

export type MediaUploadOverlayProps = {
    children: ReactNode
    /** Payload field path: "image", "backgroundImage", nested array "images.2.image", or "videoUrl". */
    field: string
    altText?: string
    className?: string
    positionClass?: string
    /** Where the control sits within the wrapped media. */
    buttonPosition?: 'top-right' | 'top-center'
    showImageButton?: boolean
    showVideoButton?: boolean
    videoField?: string
    /**
     * 'media'     → onFieldChange sends { id, url, alt } (upload→media relation; save extracts .id).
     * 'url-group' → onFieldChange sends { url, alt } only (Payload group like before-after; NO id —
     *               adding id/normalizing would null the field).
     */
    valueShape?: 'media' | 'url-group'
    /** Fires after image upload — for blocks that render no <img> until state updates. */
    onImageUploaded?: (url: string) => void
    /** Fires after first video upload — VideoHero/SplitVideoHero render the <video> from state. */
    onVideoUploaded?: (url: string) => void
}

const POSITION_CLASS: Record<NonNullable<MediaUploadOverlayProps['buttonPosition']>, string> = {
    'top-right': 'items-start justify-end',
    'top-center': 'items-start justify-center',
}

export function MediaUploadOverlay({
    children,
    field,
    altText = 'image',
    className = '',
    positionClass,
    buttonPosition = 'top-right',
    showImageButton = true,
    showVideoButton = false,
    videoField,
    valueShape = 'media',
    onImageUploaded,
    onVideoUploaded,
}: MediaUploadOverlayProps) {
    const isOwner = useIsOwner()
    const isBuilderPreview = useIsBuilderPreview()
    const callback = useBlockEditCallback()
    const containerRef = useRef<HTMLDivElement>(null)
    const imageFileRef = useRef<HTMLInputElement>(null)
    const videoFileRef = useRef<HTMLInputElement>(null)
    const { upload, progress, isUploading: uploading } = useUploadProgress()
    const [isTextEditing, setIsTextEditing] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    // Hide the overlay while inline text editing is active in the block.
    useEffect(() => {
        let textEditingTarget: EventTarget | null = null
        const onFocusin = (e: FocusEvent) => {
            if ((e.target as HTMLElement)?.isContentEditable) {
                textEditingTarget = e.target
                setIsTextEditing(true)
            }
        }
        const onFocusout = (e: FocusEvent) => {
            // cleanUpEditing() removes contenteditable before focusout fires — track by reference.
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

    // Track hover on the parent element so the control shows even when sibling content sits on top.
    useEffect(() => {
        // GH-1461 adversarial-review fix: match the JSX render guard below so this effect
        // never attaches listeners in builder-preview even if the isBuilderPreview->null
        // callback invariant (enforced in SiteRenderer.tsx) is ever bypassed by a future caller.
        if (!isOwner || !callback || isBuilderPreview) return
        const parent = containerRef.current?.parentElement
        if (!parent) return
        const onEnter = () => setIsHovered(true)
        const onLeave = () => setIsHovered(false)
        // Native file picker steals window focus without firing mouseleave → reset on blur.
        const onWindowBlur = () => setIsHovered(false)
        parent.addEventListener('mouseenter', onEnter)
        parent.addEventListener('mouseleave', onLeave)
        window.addEventListener('blur', onWindowBlur)
        return () => {
            parent.removeEventListener('mouseenter', onEnter)
            parent.removeEventListener('mouseleave', onLeave)
            window.removeEventListener('blur', onWindowBlur)
        }
    }, [isOwner, callback, isBuilderPreview])

    // GH-1461: AI Builder read-only preview panel — hide edit overlay even though
    // isOwner is true there (isOwner stays true for analytics-exclusion purposes).
    if (!isOwner || !callback || isBuilderPreview) return <>{children}</>

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
            let changedField: string
            let changedValue: unknown
            if (valueShape === 'url-group') {
                // Payload group field {url,alt,label}: set ONLY the .url subfield (as a string) so
                // sibling fields (alt/label) are preserved. Sending the whole object would drop them,
                // and an {id,...} object would be nulled by normalizeUploadField on save.
                changedField = field.endsWith('.url') ? field : `${field}.url`
                changedValue = uploaded.url
            } else {
                // Media relation: strip a trailing ".url" to target the field root (e.g. "image.url" →
                // "image") and send {id,url,alt} so the block renders now and save extracts the id.
                changedField = field.endsWith('.url') ? field.slice(0, -4) : field
                changedValue = { id: uploaded.id, url: uploaded.url, alt: altText }
            }
            // Attach the ACK listener BEFORE dispatching so the reply can't be missed.
            const ack = waitForFieldChangeResult(callback.blockIndex, changedField)
            callback.onFieldChange(changedField, changedValue)
            onImageUploaded?.(uploaded.url)
            const result = await ack
            if (result.ok) parentToast.success('Image updated')
            else parentToast.error(result.error ?? 'Failed to save image — please try again')
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
            const formData = new FormData()
            formData.append('file', file)
            formData.append('alt', 'video')
            const uploaded = await upload(formData)
            const video = containerRef.current?.querySelector('video')
            if (video) {
                // Subsequent upload: swap src in-place — no React re-render, no flicker.
                video.src = uploaded.url
                video.load()
            } else {
                // First upload: no <video> yet — let the block render it from state.
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
        <div
            ref={containerRef}
            data-media-overlay
            className={[positionClass ?? 'relative', 'group/media-overlay', className].filter(Boolean).join(' ')}
            // GH-1191: touch devices fire no mouseenter — tap toggles the control instead.
            // Taps on the control itself (Change Image/Video buttons) must not toggle it away.
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-editor-control]')) return
                setIsHovered(v => !v)
            }}
        >
            {children}
            <div
                data-editor-control
                className={[
                    'absolute inset-0 z-10 transition-colors duration-200 flex p-2',
                    POSITION_CLASS[buttonPosition],
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
            {/* stopPropagation: the programmatic .click() on these hidden inputs bubbles to the
                container's GH-1191 tap-toggle and would hide the control mid-interaction. */}
            <input
                ref={imageFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onClick={(e) => e.stopPropagation()}
                onChange={handleImageSelect}
            />
            <input
                ref={videoFileRef}
                type="file"
                accept="video/mp4,video/webm"
                className="hidden"
                onClick={(e) => e.stopPropagation()}
                onChange={handleVideoSelect}
            />
        </div>
    )
}
