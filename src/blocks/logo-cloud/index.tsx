import type { BlockProps } from '../types'
import type { LogoCloudConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'

export function LogoCloudBlock({ block, theme }: BlockProps<LogoCloudConfig>) {
    const { headline, logos = [], variant = 'row' } = block

    // ── Grid variant ─────────────────────────────────────────────────────
    if (variant === 'grid') {
        return (
            <AnimatedSection className="py-16">
                <div className="container mx-auto px-6">
                    {headline && <RichText text={headline} as="p" className="text-sm font-semibold uppercase tracking-widest text-center mb-8 opacity-50" />}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {logos.map((item, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-center p-4 rounded-xl transition-all duration-200 hover:shadow-md"
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
        <AnimatedSection className="py-16">
            <div className="container mx-auto px-6">
                {headline && <RichText text={headline} as="p" className="text-sm font-semibold uppercase tracking-widest text-center mb-8 opacity-50" />}
                <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
                    {logos.map((item, i) => (
                        <img key={i} src={item.logo?.url} alt={item.logo?.alt || item.name} className="h-8 md:h-10 w-auto opacity-50 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" />
                    ))}
                </div>
            </div>
        </AnimatedSection>
    )
}
