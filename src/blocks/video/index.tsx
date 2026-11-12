import type { BlockProps } from '../types'
import type { VideoConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { VideoMedia } from './video-media'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'

void _CSS_VARS

export function VideoBlock({ block, theme: _theme }: BlockProps<VideoConfig>) {
    void _theme
    const { headline, subheadline, videoUrl, variant = 'embed' } = block
    // ── Background variant ───────────────────────────────────────────────
    if (variant === 'background') {
        return (
            <section className="relative min-h-[60vh] md:min-h-[80vh] flex items-center justify-center overflow-hidden">
                {/* Video background */}
                <VideoMedia videoUrl={videoUrl} variant="background" title={headline || 'Background video'} />
                {/* Overlay */}
                <div className="absolute inset-0 z-10 bg-black/60 pointer-events-none" />
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
                <VideoMedia videoUrl={videoUrl} variant="embed" title={headline || 'Video'} />
            </div>
        </SectionWrapper>
    )
}
