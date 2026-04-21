'use client'

import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
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
    currentVideoUrl?: string
}

export function HeroMediaOverlay({
    children,
    field,
    altText = 'Hero image',
    className = '',
    positionClass,
    showVideoButton = false,
    videoField,
    currentVideoUrl,
}: HeroMediaOverlayProps) {
    const isOwner = useIsOwner()
    const callback = useBlockEditCallback()
    const fileRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [showVideoPopover, setShowVideoPopover] = useState(false)

    if (!isOwner || !callback) return <>{children}</>

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Only JPG, PNG, and WebP images are supported')
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
            toast.success('Image updated')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    return (
        <div className={[positionClass ?? 'relative', 'group/media-overlay', className].filter(Boolean).join(' ')}>
            {children}
            <div className="absolute inset-0 bg-black/0 group-hover/media-overlay:bg-black/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover/media-overlay:opacity-100 pointer-events-none group-hover/media-overlay:pointer-events-auto">
                {uploading ? (
                    <span className="text-white text-xs font-medium">Uploading...</span>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white/90 text-black text-xs font-semibold hover:bg-white transition-colors"
                        >
                            Change Image
                        </button>
                        {showVideoButton && videoField && (
                            <button
                                type="button"
                                onClick={() => setShowVideoPopover(true)}
                                className="px-3 py-1.5 rounded-lg bg-white/90 text-black text-xs font-semibold hover:bg-white transition-colors"
                            >
                                Change Video
                            </button>
                        )}
                    </>
                )}
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
            />
            {showVideoButton && videoField && showVideoPopover && (
                <VideoInputPopover
                    currentUrl={currentVideoUrl}
                    onSubmit={(url) => {
                        callback.onFieldChange(videoField, url)
                        setShowVideoPopover(false)
                    }}
                    onClose={() => setShowVideoPopover(false)}
                />
            )}
        </div>
    )
}

type VideoInputPopoverProps = {
    currentUrl?: string
    onSubmit: (url: string) => void
    onClose: () => void
}

function VideoInputPopover({ currentUrl, onSubmit, onClose }: VideoInputPopoverProps) {
    const [tab, setTab] = useState<'url' | 'upload'>('url')
    const [urlValue, setUrlValue] = useState(currentUrl ?? '')
    const [uploading, setUploading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleUrlSubmit = () => {
        if (urlValue.trim()) onSubmit(urlValue.trim())
    }

    const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('alt', 'Hero video')
            const uploaded = await uploadMediaAction(formData)
            onSubmit(uploaded.url)
        } catch {
            toast.error('Video upload failed')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-30 rounded-xl bg-gray-900 border border-white/15 p-4 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-white">Change Video</span>
                <button type="button" onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">u00d7</button>
            </div>
            <div className="flex gap-1 mb-3">
                {(['url', 'upload'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            tab === t ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'
                        }`}>
                        {t === 'url' ? 'URL' : 'Upload'}
                    </button>
                ))}
            </div>
            {tab === 'url' ? (
                <div className="flex gap-2">
                    <input
                        type="url"
                        value={urlValue}
                        onChange={(e) => setUrlValue(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-white/30"
                    />
                    <button
                        type="button"
                        onClick={handleUrlSubmit}
                        className="px-3 py-1.5 rounded-lg bg-white/90 text-black text-xs font-semibold hover:bg-white"
                    >
                        Apply
                    </button>
                </div>
            ) : (
                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="px-4 py-2 rounded-lg bg-white/90 text-black text-xs font-semibold hover:bg-white disabled:opacity-50"
                    >
                        {uploading ? 'Uploading...' : 'Choose video file'}
                    </button>
                    <input ref={fileRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleVideoFile} />
                </div>
            )}
        </div>
    )
}
