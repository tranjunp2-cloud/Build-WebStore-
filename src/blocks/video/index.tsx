import type { BlockProps } from '../types'
import type { VideoConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'

export function VideoBlock({ block, theme }: BlockProps<VideoConfig>) {
    const { headline, subheadline, videoUrl, variant = 'embed' } = block
    const isYoutube = videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be')
    const embedUrl = isYoutube ? videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/') : videoUrl

    // ── Background variant ───────────────────────────────────────────────
    if (variant === 'background') {
        const bgEmbedUrl = isYoutube
            ? `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&modestbranding=1&playlist=${embedUrl.split('/').pop()}`
            : embedUrl
        return (
            <section className="relative min-h-[60vh] md:min-h-[80vh] flex items-center justify-center overflow-hidden">
                {/* Video background */}
                <div className="absolute inset-0 z-0">
                    <iframe
                        src={bgEmbedUrl}
                        className="w-full h-full scale-150 pointer-events-none"
                        allow="autoplay; encrypted-media"
                        title={headline || 'Background video'}
                        style={{ border: 'none' }}
                    />
                </div>
                {/* Overlay */}
                <div className="absolute inset-0 z-10 bg-black/60" />
                {/* Content */}
                <div className="relative z-20 text-center px-6 max-w-3xl mx-auto">
                    {headline && <h2 className="text-4xl md:text-6xl font-bold font-heading text-white mb-5">{headline}</h2>}
                    {subheadline && <p className="text-lg md:text-xl text-white/80 leading-relaxed">{subheadline}</p>}
                </div>
            </section>
        )
    }

    // ── Default: embed variant ───────────────────────────────────────────
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
