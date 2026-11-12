'use client';

import React, { useEffect, useRef } from 'react';
import { PlayCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { formatVideoDuration, type QnAVideoMedia } from './qna-video-media';

// Only one Q&A video plays at a time: starting one pauses the previous
let playing: HTMLVideoElement | null = null;

interface QnAVideoProps {
    video: QnAVideoMedia;
    /** The question, used for the accessible name */
    question: string;
    /** Called when the file can't be loaded at all; the parent then drops the video (and its ▶ marker) */
    onUnavailable: () => void;
}

/**
 * Tutorial video under a Q&A answer (#2464). Mounted only while the accordion is open, `preload="none"` so nothing
 * but the poster loads until the user presses play; native controls give play/pause, seek and fullscreen.
 */
export const QnAVideo: React.FC<QnAVideoProps> = ({ video, question, onUnavailable }) => {
    const { t, ti } = useI18n();
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // React clears ref.current before this cleanup runs, so keep the element for the comparison
        const el = ref.current;
        return () => {
            if (playing === el) playing = null;
        };
    }, []);

    const handlePlay = () => {
        if (playing && playing !== ref.current) playing.pause();
        playing = ref.current;
    };

    // Only a file that never loaded is "unavailable" (blocked / 404 / unsupported). A drop after playback started
    // keeps the player so the viewer stays on their position and the native controls can retry.
    const handleError = () => {
        const el = ref.current;
        if (!el || el.readyState === HTMLMediaElement.HAVE_NOTHING) onUnavailable();
    };

    return (
        <figure className="m-0 mt-3 w-full max-w-[720px]" data-testid="qna-video">
            <figcaption className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[hsl(var(--primary))]">
                <PlayCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                {t.help.qna.videoGuide}
                <span className="font-normal text-[hsl(var(--muted-foreground))]">· {formatVideoDuration(video.duration)}</span>
            </figcaption>
            {/* `border-solid` required (preflight OFF) so the 1px frame paints. */}
            <div className="relative w-full aspect-video overflow-hidden rounded-[10px] border border-solid border-[hsl(var(--border))] bg-black">
                <video
                    ref={ref}
                    className="absolute inset-0 h-full w-full object-contain"
                    src={video.src}
                    poster={video.poster}
                    preload="none"
                    controls
                    playsInline
                    aria-label={ti(t.help.qna.videoTitle, { question })}
                    onPlay={handlePlay}
                    onError={handleError}
                >
                    {t.help.qna.videoUnsupported}
                </video>
            </div>
        </figure>
    );
};
