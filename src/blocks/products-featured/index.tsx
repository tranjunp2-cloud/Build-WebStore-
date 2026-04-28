'use client'

import React from 'react'
import type { BlockProps } from '../types'
import type { ProductsFeaturedConfig } from './config'
import { GradientBlob, SectionLabel } from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { TOUCH_TARGET } from '@/lib/design-tokens'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { getGalleryImages } from '@/lib/images/industry-images'

function ProductsFeaturedSection({ children }: { children: React.ReactNode }) {
    return (
        <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent" className="relative overflow-hidden" innerClassName="relative z-10">
            {children}
        </SectionWrapper>
    )
}

const MOCK_FEATURED = [
    {
        id: 1,
        name: 'The Obsidian Chronograph',
        price: '$1,250',
        description: 'Engineered for precision. Crafted for elegance. The Obsidian Chronograph features a matte black titanium case, sapphire crystal, and our proprietary automatic movement. Water-resistant up to 200m.',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&q=80',
        tags: ['Limited Edition', 'Titanium'],
    },
    {
        id: 2,
        name: 'Acoustic Excellence Headphones',
        price: '$450',
        description: 'Immerse yourself in pure studio sound with active noise cancellation and 40-hour battery life.',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&q=80',
        tags: ['New Release', 'Audio'],
    }
]

export function ProductsFeaturedBlock({ block, theme, site }: BlockProps<ProductsFeaturedConfig>) {
    const { headline = 'Featured Collection', subheadline, variant = 'hero-product' } = block
    const category = (site?.siteType as string) || 'business'

    // Fallback to industry images when mock/real product images lack URLs
    const hasAnyImage = MOCK_FEATURED.some((p) => p.image)
    const fallbackUrls = hasAnyImage ? [] : getGalleryImages(category, MOCK_FEATURED.length, site?.imageLibraryS3 as Record<string, string> | undefined)
    const products = hasAnyImage
        ? MOCK_FEATURED
        : MOCK_FEATURED.map((p, i) => ({ ...p, image: fallbackUrls[i] || fallbackUrls[0] }))
    const product = products[0] // For hero-product we just show the first one

    if (variant === 'carousel') {
        return (
            <SectionWrapper as={AnimatedSection} padding="default" container="default" background="transparent" className="relative overflow-hidden" innerClassName="relative z-10">
                <GradientBlob color={CSS_VARS.primary} className="top-1/4 right-0" size={600} opacity={0.05} />
                <div className="text-center max-w-2xl mx-auto mb-16">
                    {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                    <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-4" />
                    {subheadline && <RichText text={subheadline} as="p" className="opacity-60 text-lg" />}
                </div>

                <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 hide-scrollbar">
                    {products.map((p) => (
                        <div key={p.id} className="snap-center w-[85vw] sm:w-[500px] flex-shrink-0 relative rounded-3xl overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                            <img src={p.image} alt={p.name} className="w-full h-[500px] object-cover mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute bottom-0 left-0 p-8 z-20 w-full text-white">
                                <Heading level={3} className="mb-2">{p.name}</Heading>
                                <Body size="lg" className="font-medium" style={{ color: 'var(--brand-primary)' }}>{p.price}</Body>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionWrapper>
        )
    }

    // Default: hero-product split view
    return (
        <ProductsFeaturedSection>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                {/* Left: Huge Product Image */}
                <div className="relative group">
                    <GradientBlob color={CSS_VARS.primary} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" size={500} opacity={0.15} />
                    <div className="relative z-10 rounded-2xl overflow-hidden animate-float" style={{ animationDuration: '6s' }}>
                        <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-auto object-cover transform scale-110 drop-shadow-2xl mix-blend-multiply dark:mix-blend-normal"
                        />
                    </div>
                </div>

                {/* Right: Info */}
                <div className="flex flex-col justify-center">
                    {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}

                    <div className="flex flex-wrap gap-2 mb-6">
                        {product.tags.map((tag) => (
                            <Caption key={tag} className="px-3 py-1 rounded-full font-semibold tracking-wider uppercase"
                                style={{ backgroundColor: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)', border: `1px solid rgba(var(--brand-primary-rgb), 0.188)` }}>
                                {tag}
                            </Caption>
                        ))}
                    </div>

                    <h2 className="text-5xl lg:text-7xl font-bold font-heading mb-6 leading-tight">{product.name}</h2>

                    <p className="text-4xl font-heading mb-6" style={{ color: 'var(--brand-primary)' }}>{product.price}</p>

                    <Body size="lg" className="opacity-70 mb-10 max-w-lg">
                        {product.description}
                    </Body>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            type="button"
                            className={`px-8 py-4 rounded-full font-bold text-lg transition-transform hover:scale-105 ${TOUCH_TARGET.min}`}
                            style={{ backgroundColor: 'var(--brand-primary)', color: theme.colorMode === 'dark' ? '#000' : '#fff' }}
                        >
                            Add to Cart
                        </button>
                        <button
                            type="button"
                            className={`px-8 py-4 rounded-full font-bold text-lg transition-colors ${TOUCH_TARGET.min}`}
                            style={{ border: `2px solid rgba(var(--brand-primary-rgb), 0.314)`, color: theme.colorMode === 'dark' ? '#fff' : '#000' }}
                        >
                            View Details
                        </button>
                    </div>
                </div>
            </div>
            {/* Inline CSS for float animation */}
            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-15px); }
                    100% { transform: translateY(0px); }
                }
                .animate-float {
                    animation: float ease-in-out infinite;
                }
            `}</style>
        </ProductsFeaturedSection>
    )
}
