import type { BlockProps } from '../types'
import type { LogoCloudConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'

export function LogoCloudBlock({ block, theme }: BlockProps<LogoCloudConfig>) {
    const { headline, logos = [] } = block
    return (
        <AnimatedSection className="py-16">
            <div className="container mx-auto px-6">
                {headline && <p className="text-sm font-semibold uppercase tracking-widest text-center mb-8 opacity-50">{headline}</p>}
                <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
                    {logos.map((item, i) => (
                        <img key={i} src={item.logo.url} alt={item.logo.alt || item.name} className="h-8 md:h-10 w-auto opacity-50 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" />
                    ))}
                </div>
            </div>
        </AnimatedSection>
    )
}
