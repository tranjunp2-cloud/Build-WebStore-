'use client'

import React from 'react'
import type { BlockProps } from '../types'
import type { ProductsGridConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import { SectionLabel, GradientBlob } from '../shared/decorative'

// Mock Data
const MOCK_PRODUCTS = [
    { id: 1, name: 'Premium Leather Bag', price: '$120', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&q=80' },
    { id: 2, name: 'Minimalist Watch', price: '$85', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80' },
    { id: 3, name: 'Wireless Headphones', price: '$250', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80' },
    { id: 4, name: 'Classic Sunglasses', price: '$95', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&q=80' },
    { id: 5, name: 'Ceramic Coffee Mug', price: '$24', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=500&q=80' },
    { id: 6, name: 'Smart Home Speaker', price: '$150', image: 'https://images.unsplash.com/photo-1543512214-318c7553f230?w=500&q=80' },
    { id: 7, name: 'Ergonomic Chair', price: '$350', image: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=500&q=80' },
    { id: 8, name: 'Mechanical Keyboard', price: '$130', image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=500&q=80' },
]

export function ProductsGridBlock({ block, theme }: BlockProps<ProductsGridConfig>) {
    const { headline = 'Featured Products', subheadline, limit = 6, variant = 'grid-3' } = block

    const products = MOCK_PRODUCTS.slice(0, limit)

    const gridCols = {
        'grid-3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        'grid-4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        'list': 'grid-cols-1 max-w-3xl mx-auto',
    }[variant] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

    return (
        <AnimatedSection className="py-24 relative overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="bottom-[10%] left-[-5%]" size={500} opacity={0.04} />

            <div className="container mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline}</h2>
                    {subheadline && <p className="opacity-60 text-lg">{subheadline}</p>}
                </div>

                {/* Grid */}
                <StaggerGrid className={`grid gap-8 ${gridCols}`}>
                    {products.map((product, i) => (
                        <StaggerItem key={product.id}>
                            <HoverCard
                                className={`group overflow-hidden rounded-2xl h-full flex ${variant === 'list' ? 'flex-row items-center gap-6 p-4' : 'flex-col'}`}
                                style={{
                                    border: `1px solid rgba(var(--brand-primary-rgb), 0.125)`,
                                    background: `linear-gradient(135deg, ${theme.colorMode === 'dark' ? '#ffffff03' : '#00000003'}, transparent)`,
                                }}
                            >
                                <div className={`relative overflow-hidden bg-black/5 dark:bg-white/5 ${variant === 'list' ? 'w-32 h-32 rounded-xl flex-shrink-0' : 'aspect-square'}`}>
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 mix-blend-multiply dark:mix-blend-normal"
                                        loading="lazy"
                                    />
                                    {/* Quick View Overlay */}
                                    {variant !== 'list' && (
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                                            <button className="px-6 py-2 bg-white text-black font-semibold rounded-full transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                                Quick View
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className={variant === 'list' ? 'flex-1 py-2' : 'p-6 flex flex-col flex-1'}>
                                    <h3 className="font-body font-semibold text-lg mb-2">{product.name}</h3>
                                    <p className="text-xl font-heading mb-4" style={{ color: 'var(--brand-primary)' }}>{product.price}</p>
                                    
                                    {variant !== 'list' && <div className="mt-auto" />}
                                    
                                    <button 
                                        className={`px-4 py-2 font-medium transition-all duration-300 ${variant === 'list' ? 'rounded-lg text-sm w-max' : 'rounded-xl w-full text-center'}`}
                                        style={{ 
                                            backgroundColor: variant === 'list' ? `rgba(var(--brand-primary-rgb), 0.082)` : 'transparent',
                                            color: 'var(--brand-primary)',
                                            border: variant === 'list' ? 'none' : `1px solid rgba(var(--brand-primary-rgb), 0.188)`,
                                        }}
                                        onMouseEnter={(e) => {
                                            if (variant !== 'list') {
                                                e.currentTarget.style.backgroundColor = CSS_VARS.primary;
                                                e.currentTarget.style.color = theme.colorMode === 'dark' ? '#000' : '#fff';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (variant !== 'list') {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = CSS_VARS.primary;
                                            }
                                        }}
                                    >
                                        Add to Cart
                                    </button>
                                </div>
                            </HoverCard>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </AnimatedSection>
    )
}
