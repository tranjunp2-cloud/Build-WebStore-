'use client'

import React, { useEffect, useState } from 'react'
import type { BlockProps } from '../types'
import type { BlogListConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import { SectionLabel, GradientBlob } from '../shared/decorative'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

interface BlogPost {
    id: string
    title: string
    excerpt: string
    date: string
    category: string
    image: string | null
    slug: string
}

/** Strip HTML tags and extract first ~160 chars as excerpt */
function extractExcerpt(content: unknown): string {
    if (!content || typeof content !== 'string') return ''
    const text = content.replace(/<[^>]*>/g, '').trim()
    return text.length > 160 ? text.substring(0, 157) + '...' : text
}

export function BlogListBlock({ block, theme, site }: BlockProps<BlogListConfig>) {
    const { headline = 'Latest Insights', subheadline, limit = 3, variant = 'cards' } = block
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [loading, setLoading] = useState(true)

    // BUG-F05-06: build blog links using tenant slug from server-injected site prop
    const tenantSlug = (site as Record<string, unknown>)?.tenantSlug as string | undefined
    const blogBasePath = tenantSlug ? `/sites/${tenantSlug}/blogs` : '/blogs'

    useEffect(() => {
        const tenantId = site?.tenant
            ? (typeof site.tenant === 'object' ? (site.tenant as { id: string }).id : site.tenant)
            : null

        if (!tenantId) {
            setLoading(false)
            return
        }

        fetch(`/api/storefront/blogs?tenant=${tenantId}&limit=${limit}&sort=-createdAt`)
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(json => {
                const docs = json.data || json.docs || []
                const mapped: BlogPost[] = docs.map((doc: any) => {
                    const thumbUrl = typeof doc.thumbnail === 'object' ? doc.thumbnail?.url : null
                    const catName = typeof doc.category === 'object' ? doc.category?.name : null
                    const publishDate = doc.publishedAt || doc.createdAt

                    return {
                        id: String(doc.id),
                        title: doc.title || 'Untitled',
                        excerpt: extractExcerpt(doc.content),
                        date: publishDate ? new Date(publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
                        category: catName || 'Uncategorized',
                        image: thumbUrl,
                        slug: doc.slug || '',
                    }
                })
                setPosts(mapped)
            })
            .catch(err => {
                console.error('[BlogListBlock] Failed to fetch blogs:', err)
            })
            .finally(() => setLoading(false))
    }, [limit, site])

    if (loading) {
        return (
            <AnimatedSection className="relative overflow-hidden">
                <SectionWrapper as="div" padding="default" container="default" background="transparent">
                    <div className="text-center">
                        <div className="animate-pulse flex flex-col items-center gap-4">
                            <div className="h-8 w-64 bg-white/10 rounded" />
                            <div className="h-4 w-48 bg-white/5 rounded" />
                        </div>
                    </div>
                </SectionWrapper>
            </AnimatedSection>
        )
    }

    if (posts.length === 0) {
        return (
            <AnimatedSection className="relative overflow-hidden">
                <SectionWrapper as="div" padding="default" container="default" background="transparent">
                    <div className="text-center">
                        {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                        <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-4" />
                        <p className="opacity-60 text-lg">No published posts yet. Check back soon!</p>
                    </div>
                </SectionWrapper>
            </AnimatedSection>
        )
    }

    return (
        <AnimatedSection className="relative overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="bottom-0 left-1/4" size={400} opacity={0.05} />

            <SectionWrapper as="div" padding="default" container="default" background="transparent" innerClassName="relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                    <Heading level={2} className="mb-4">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {subheadline && (
                        <Body size="lg" className="opacity-60">
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                </div>

                {variant === 'list' ? (
                    <div className="max-w-4xl mx-auto flex flex-col gap-10">
                        {posts.map((post) => (
                            <a href={`${blogBasePath}/${post.slug}`} key={post.id} className="group grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-black/10 dark:border-white/10 pb-10">
                                <div className="relative overflow-hidden rounded-xl aspect-[4/3] md:aspect-video bg-black/5 dark:bg-white/5">
                                    <div className="absolute inset-0 bg-black/10 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                                    {post.image ? (
                                        <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">📝</div>
                                    )}
                                </div>
                                <div className="md:col-span-2 group-hover:translate-x-2 transition-transform duration-300">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-primary)' }}>{post.category}</span>
                                        <span className="text-xs opacity-40">{post.date}</span>
                                    </div>
                                    <Heading level={2}
                                        className="mb-3 transition-colors"
                                        style={{ color: 'inherit' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = CSS_VARS.primary }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit' }}>
                                        {post.title}
                                    </Heading>
                                    <Body className="opacity-60 leading-relaxed">{post.excerpt}</Body>
                                </div>
                            </a>
                        ))}
                    </div>
                ) : (
                    <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post) => (
                            <StaggerItem key={post.id}>
                                <a href={`${blogBasePath}/${post.slug}`} className="block h-full">
                                    <HoverCard className="group flex flex-col h-full rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-500"
                                        style={{
                                            border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                                            background: `linear-gradient(to bottom, ${theme.colorMode === 'dark' ? '#111' : '#fff'}, transparent)`,
                                        }}
                                    >
                                        <div className="relative overflow-hidden aspect-[4/3] bg-black/5 dark:bg-white/5">
                                            {post.image ? (
                                                <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">📝</div>
                                            )}
                                            <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-black/50 backdrop-blur-md text-white border border-white/10">
                                                {post.category}
                                            </div>
                                        </div>
                                        <div className={`${CARD_PADDING.lg} flex flex-col flex-1`}>
                                            <Body size="small" className="opacity-50 mb-3">{post.date}</Body>
                                            <Heading level={3} className="mb-4">{post.title}</Heading>
                                            <Body size="small" className="opacity-60 mb-6 flex-1 leading-relaxed">{post.excerpt}</Body>

                                            <div className="mt-auto flex items-center text-sm font-semibold tracking-wide" style={{ color: 'var(--brand-primary)' }}>
                                                Read Article
                                                <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                                            </div>
                                            <div className="mt-6 h-0.5 w-0 group-hover:w-16 transition-all duration-500 rounded-full"
                                                style={{ background: 'var(--brand-primary)' }} />
                                        </div>
                                    </HoverCard>
                                </a>
                            </StaggerItem>
                        ))}
                    </StaggerGrid>
                )}
            </SectionWrapper>
        </AnimatedSection>
    )
}
