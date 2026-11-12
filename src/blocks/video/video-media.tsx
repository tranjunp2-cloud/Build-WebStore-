'use client'

import { useState } from 'react'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'
import { buildBackgroundEmbedUrl, parseVideoUrl } from '@/lib/video/parse-video-url'

type VideoMediaProps = {
    videoUrl?: string
    variant: 'embed' | 'background'
    title: string
}

// GH-2062: renders the block's video through the shared upload overlay so the owner gets
// "Change Video" (mp4/webm upload). Only allowlisted YouTube/Vimeo/file URLs reach the DOM.
export function VideoMedia({ videoUrl, variant, title }: VideoMediaProps) {
    const [url, setUrl] = useState(videoUrl)
    // Re-sync when the editor changes the field (URL input / undo) — adjust-state-during-render.
    const [prevProp, setPrevProp] = useState(videoUrl)
    if (prevProp !== videoUrl) {
        setPrevProp(videoUrl)
        setUrl(videoUrl)
    }

    const parsed = parseVideoUrl(url)
    const isBackground = variant === 'background'

    let media: React.ReactNode
    if (!parsed) {
        media = (
            <div role="img" aria-label="Video unavailable" className="w-full h-full min-h-[200px] flex items-center justify-center bg-black/80 text-white/70 text-sm">
                Video unavailable
            </div>
        )
    } else if (parsed.kind === 'file') {
        media = isBackground
            ? <video src={parsed.embedUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
            : <video src={parsed.embedUrl} controls playsInline className="w-full h-full" />
    } else if (isBackground) {
        media = (
            <iframe
                src={buildBackgroundEmbedUrl(parsed)}
                className="w-full h-full scale-150 pointer-events-none"
                allow="autoplay; encrypted-media"
                title={title}
                style={{ border: 'none' }}
            />
        )
    } else {
        media = <iframe src={parsed.embedUrl} className="w-full h-full" allowFullScreen title={title} />
    }

    return (
        <MediaUploadOverlay
            field="videoUrl"
            positionClass={isBackground ? 'absolute inset-0 z-0' : 'relative w-full h-full'}
            showImageButton={false}
            showVideoButton
            videoField="videoUrl"
            onVideoUploaded={setUrl}
        >
            {media}
        </MediaUploadOverlay>
    )
}
