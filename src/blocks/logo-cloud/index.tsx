import type { BlockProps } from '../types'
import type { LogoCloudConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Caption } from '../shared/Typography'
import { CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

void _CSS_VARS

function LogoHeadline({ text }: { text?: string }) {
    if (!text) return null
    return (
        <Caption className="block font-semibold uppercase tracking-widest text-center mb-8 opacity-50">
            <RichText text={text} as="span" />
        </Caption>
    )
}

/** Text placeholder for logos without valid image URL — shows initials in a styled div */
function LogoPlaceholder({ name }: { name?: string }) {
    const initials = (name ?? '')
        .split(/\s+/)
        .map((w) => w[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?'
    return (
        <div
            className="h-8 px-4 rounded flex items-center justify-center text-xs font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity"
            style={{
                border: `1px solid rgba(var(--brand-primary-rgb), 0.188)`,
                color: 'var(--brand-primary)',
                background: `rgba(var(--brand-primary-rgb), 0.04)`,
            }}
        >
            {initials}
        </div>
    )
}

export function LogoCloudBlock({ block, theme: _theme }: BlockProps<LogoCloudConfig>) {
    void _theme
    const { headline, logos = [], variant = 'row' } = block

    // ── Grid variant ─────────────────────────────────────────────────────
    if (variant === 'grid') {
        return (
            <AnimatedSection>
                <SectionWrapper as="div" padding="compact" container="default" background="transparent">
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
                                {item.logo?.url ? (
                                    <img src={item.logo.url} alt={item.logo?.alt || item.name} className="h-8 w-auto opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" />
                                ) : (
                                    <LogoPlaceholder name={item.name} />
                                )}
                            </div>
                        ))}
                    </div>
                </SectionWrapper>
            </AnimatedSection>
        )
    }

    // ── Default: row variant ─────────────────────────────────────────────
    return (
        <AnimatedSection>
            <SectionWrapper as="div" padding="compact" container="default" background="transparent">
                <LogoHeadline text={headline} />
                <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
                    {logos.map((item, i) => (
                        item.logo?.url ? (
                            <img key={i} src={item.logo.url} alt={item.logo?.alt || item.name} className="h-8 md:h-10 w-auto opacity-50 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" />
                        ) : (
                            <LogoPlaceholder key={i} name={item.name} />
                        )
                    ))}
                </div>
            </SectionWrapper>
        </AnimatedSection>
    )
}
