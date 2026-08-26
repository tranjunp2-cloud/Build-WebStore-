import type { BlockProps } from '../types'
import type { VideoConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'

void _CSS_VARS

export function VideoBlock({ block, theme: _theme }: BlockProps<VideoConfig>) {
    void _theme
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
                    {headline && (
                        <Heading level={1} className="text-white mb-5">
                            <RichText text={headline} as="span" />
                        </Heading>
                    )}
                    {subheadline && (
                        <Body size="lg" className="text-white/80 leading-relaxed">
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                </div>
            </section>
        )
    }

    // ── Default: embed variant ───────────────────────────────────────────
    return (
        <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent" innerClassName="max-w-4xl">
            {headline && (
                <Heading level={2} className="text-center mb-4">
                    <RichText text={headline} as="span" />
                </Heading>
            )}
            {subheadline && (
                <Body size="lg" className="text-center opacity-70 mb-10">
                    <RichText text={subheadline} as="span" />
                </Body>
            )}
            <div className="rounded-2xl overflow-hidden aspect-video" style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}>
                <iframe src={embedUrl} className="w-full h-full" allowFullScreen title={headline || 'Video'} />
            </div>
        </SectionWrapper>
    )
}
