import type { BlockProps } from '../types'
import type { VideoConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'

export function VideoBlock({ block, theme }: BlockProps<VideoConfig>) {
    const { headline, subheadline, videoUrl } = block
    const isYoutube = videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be')
    const embedUrl = isYoutube ? videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/') : videoUrl
    return (
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6 max-w-4xl">
                {headline && <h2 className="text-4xl font-bold font-heading text-center mb-4">{headline}</h2>}
                {subheadline && <p className="text-center opacity-70 mb-10">{subheadline}</p>}
                <div className="rounded-2xl overflow-hidden aspect-video" style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}>
                    <iframe src={embedUrl} className="w-full h-full" allowFullScreen title={headline || 'Video'} />
                </div>
            </div>
        </AnimatedSection>
    )
}
