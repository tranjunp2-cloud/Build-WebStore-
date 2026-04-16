import type { BlockProps } from '../types'
import type { LogoCloudConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, CARD_PADDING } from '@/lib/design-tokens'

void _CSS_VARS

const LOGO_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function LogoHeadline({ text }: { text?: string }) {
    if (!text) return null
    return (
        <Caption className="block font-semibold uppercase tracking-widest text-center mb-8 opacity-50">
            <RichText text={text} as="span" />
        </Caption>
    )
}

export function LogoCloudBlock({ block, theme: _theme }: BlockProps<LogoCloudConfig>) {
    void _theme
    const { headline, logos = [], variant = 'row' } = block

    // ── Grid variant ─────────────────────────────────────────────────────
    if (variant === 'grid') {
        return (
            <AnimatedSection className={SECTION_PADDING.compact}>
                <div className={LOGO_CONTAINER}>
                    <LogoHeadline text={headline} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {logos.map((item, i) => (
                            <div
                                key={i}
                                className={`flex items-center justify-center ${CARD_PADDING.sm} rounded-xl transition-all duration-200 hover:shadow-md`}
                                style={{
                                    border: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                                    background: `rgba(var(--brand-primary-rgb), 0.02)`,
                                }}
                            >
                                <img src={item.logo?.url} alt={item.logo?.alt || item.name} className="h-8 w-auto opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" />
                            </div>
                        ))}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // ── Default: row variant ─────────────────────────────────────────────
    return (
        <AnimatedSection className={SECTION_PADDING.compact}>
            <div className={LOGO_CONTAINER}>
                <LogoHeadline text={headline} />
                <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
                    {logos.map((item, i) => (
                        <img key={i} src={item.logo?.url} alt={item.logo?.alt || item.name} className="h-8 md:h-10 w-auto opacity-50 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" />
                    ))}
                </div>
            </div>
        </AnimatedSection>
    )
}
