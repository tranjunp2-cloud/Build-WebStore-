'use client'

import React from 'react'
import type { BlockProps } from '../types'
import type { BlogListConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import { SectionLabel, GradientBlob } from '../shared/decorative'

const MOCK_POSTS = [
    {
        id: 1,
        title: 'The Future of AI in Architecture Design',
        excerpt: 'Exploring how generative models are transforming the way architects conceptualize spaces and streamline drafting workflows.',
        date: 'Oct 24, 2026',
        category: 'Technology',
        image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
    },
    {
        id: 2,
        title: 'Minimalism: A Strategy for Clarity',
        excerpt: 'Why reducing UI clutter correlates directly with increased user engagement and retention in SaaS platforms.',
        date: 'Oct 18, 2026',
        category: 'Design',
        image: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?w=800&q=80',
    },
    {
        id: 3,
        title: 'Building Resilience in Distributed Systems',
        excerpt: 'Lessons learned from scaling our microservices architecture to handle sudden 10x traffic spikes.',
        date: 'Oct 12, 2026',
        category: 'Engineering',
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
    }
]

export function BlogListBlock({ block, theme }: BlockProps<BlogListConfig>) {
    const { headline = 'Latest Insights', subheadline, limit = 3, variant = 'cards' } = block

    const posts = MOCK_POSTS.slice(0, limit)

    return (
        <AnimatedSection className="py-24 relative overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="bottom-0 left-1/4" size={400} opacity={0.05} />

            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline}</h2>
                    {subheadline && <p className="opacity-60 text-lg">{subheadline}</p>}
                </div>

                {variant === 'list' ? (
                    <div className="max-w-4xl mx-auto flex flex-col gap-10">
                        {posts.map((post, i) => (
                            <a href="#" key={post.id} className="group grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-black/10 dark:border-white/10 pb-10">
                                <div className="relative overflow-hidden rounded-xl aspect-[4/3] md:aspect-video bg-black/5 dark:bg-white/5">
                                    <div className="absolute inset-0 bg-black/10 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                                    <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                </div>
                                <div className="md:col-span-2 group-hover:translate-x-2 transition-transform duration-300">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-primary)' }}>{post.category}</span>
                                        <span className="text-xs opacity-40">{post.date}</span>
                                    </div>
                                    <h3 className="text-2xl md:text-3xl font-heading font-bold mb-3 transition-colors"
                                        style={{ color: 'inherit' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = CSS_VARS.primary }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit' }}>
                                        {post.title}
                                    </h3>
                                    <p className="opacity-60 leading-relaxed">{post.excerpt}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                ) : (
                    <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post) => (
                            <StaggerItem key={post.id}>
                                <HoverCard className="group flex flex-col h-full rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-500"
                                    style={{
                                        border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                                        background: `linear-gradient(to bottom, ${theme.colorMode === 'dark' ? '#111' : '#fff'}, transparent)`,
                                    }}
                                >
                                    <div className="relative overflow-hidden aspect-[4/3] bg-black/5 dark:bg-white/5">
                                        <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                        <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-black/50 backdrop-blur-md text-white border border-white/10">
                                            {post.category}
                                        </div>
                                    </div>
                                    <div className="p-8 flex flex-col flex-1">
                                        <span className="text-sm opacity-50 mb-3">{post.date}</span>
                                        <h3 className="text-xl font-heading font-bold mb-4">{post.title}</h3>
                                        <p className="opacity-60 mb-6 flex-1 text-sm leading-relaxed">{post.excerpt}</p>
                                        
                                        <div className="mt-auto flex items-center text-sm font-semibold tracking-wide" style={{ color: 'var(--brand-primary)' }}>
                                            Read Article 
                                            <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                                        </div>
                                        <div className="mt-6 h-0.5 w-0 group-hover:w-16 transition-all duration-500 rounded-full"
                                            style={{ background: 'var(--brand-primary)' }} />
                                    </div>
                                </HoverCard>
                            </StaggerItem>
                        ))}
                    </StaggerGrid>
                )}
            </div>
        </AnimatedSection>
    )
}
