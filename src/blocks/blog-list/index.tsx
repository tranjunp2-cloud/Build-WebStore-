'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { blogExcerpt } from '@/lib/blog/excerpt'
import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, FileText } from 'lucide-react'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import type { BlockProps } from '../types'
import { SmartLink } from '@/blocks/_shared/smart-link'
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

function formatBlogDate(value: unknown, locale: string): string {
    if (!value) return ''
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) return ''
    try {
        return date.toLocaleDateString(locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    } catch {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }
}

export function BlogListBlock({ block, theme, site }: BlockProps<BlogListConfig>) {
    const {
        subheadline,
        limit = 3,
        variant = 'cards',
        readArticleLabel,
        uncategorizedLabel = 'Uncategorized',
        emptyStateLabel,
    } = block
    const headline = block.headline || block.sectionLabel || ''
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [editorCategory, setEditorCategory] = useState('')
    const [categories, setCategories] = useState<Array<{ slug: string; name: string }>>([])
    const category = block.showCategoryFilter ? (pathname?.startsWith('/editor') ? editorCategory : searchParams.get('blogCategory') || '') : ''
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [loading, setLoading] = useState(true)

    // Build blog detail base path with 4-tier fallback:
    //   1. blogPreviewPath — set by preview/[siteId]/page.tsx (preview namespace, fix #1183)
    //   2. siteBasePath   — enriched by [[...path]]/page.tsx (canonical path)
    //   3. tenantSlug     — flat prop (legacy enrichment)
    //   4. site.tenant.slug — populated relation (editor preview / test harness)
    // Using blogPreviewPath (not siteBasePath) keeps the override scoped to blog links only,
    // so product/other blocks in the same preview page retain their existing base paths.
    const siteRec = site as Record<string, unknown>
    const siteLocale =
        (typeof siteRec?.generationLocale === 'string' && siteRec.generationLocale)
        || (typeof siteRec?.locale === 'string' && siteRec.locale)
        || 'en'
    const readMoreLabel = readArticleLabel?.trim() || (siteLocale.toLowerCase().split('-')[0] === 'ms' ? ms : en).storefront.blog.readMore
    const emptyMessage = emptyStateLabel?.trim() || (siteLocale.toLowerCase().split('-')[0] === 'ms' ? ms : en).storefront.blog.noPosts
    const blogPreviewPath = typeof siteRec?.blogPreviewPath === 'string' ? (siteRec.blogPreviewPath as string) : null
    const explicitBase = typeof siteRec?.siteBasePath === 'string' ? (siteRec.siteBasePath as string) : null
    const tenantSlugRaw =
        siteRec?.tenantSlug ??
        (siteRec?.tenant && typeof siteRec.tenant === 'object'
            ? (siteRec.tenant as Record<string, unknown>).slug
            : null)
    const siteBasePath = explicitBase ?? (typeof tenantSlugRaw === 'string' && tenantSlugRaw ? `/sites/${tenantSlugRaw}` : '')
    const blogBasePath = blogPreviewPath ?? `${siteBasePath}/blog`

    useEffect(() => {
        const tenantId = site?.tenant
            ? (typeof site.tenant === 'object' ? (site.tenant as { id: string }).id : site.tenant)
            : null

        if (!tenantId) {
            setLoading(false)
            return
        }

        const controller = new AbortController()
        fetch(`/api/storefront/blogs?tenant=${tenantId}&limit=${limit}&sort=-createdAt${block.showCategoryFilter ? '&includeCategories=1' : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}`, { signal: controller.signal })
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(json => {
                const docs = json.data || json.docs || []
                const mapped: BlogPost[] = docs.map((doc: any) => {
                    const thumbUrl = typeof doc.thumbnail === 'object' ? doc.thumbnail?.url : null
                    const catName = typeof doc.category === 'object' ? doc.category?.name : null
                    const publishDate = doc.publishedAt || doc.createdAt

                    return {
                        id: String(doc.id),
                        title: doc.title || headline,
                        excerpt: blogExcerpt(doc.content),
                        date: formatBlogDate(publishDate, siteLocale),
                        category: catName || uncategorizedLabel,
                        image: thumbUrl,
                        slug: doc.slug || '',
                    }
                })
                if (controller.signal.aborted) return
                setCategories(json.categories ?? [])
                setPosts(mapped)
            })
            .catch(err => {
                if (controller.signal.aborted) return
                console.error('[BlogListBlock] Failed to fetch blogs:', err)
            })
            .finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [headline, limit, site, siteLocale, uncategorizedLabel, category, block.showCategoryFilter])

    const categoryFilter = block.showCategoryFilter && categories.length > 0 ? (
        <label className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm font-medium" style={{ color: CSS_VARS.textPrimary }}>{siteLocale.toLowerCase().split('-')[0] === 'ms' ? 'Kategori' : 'Category'}</span>
            <div className="relative w-full sm:w-56">
            <select aria-label={siteLocale.toLowerCase().split('-')[0] === 'ms' ? 'Kategori artikel' : 'Article category'} value={category || '__all__'} className="h-11 w-full appearance-none cursor-pointer rounded-lg border border-solid pl-3 pr-10 text-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]" style={{ backgroundColor: CSS_VARS.surfacePrimary, color: CSS_VARS.textPrimary, borderColor: 'var(--divider)', colorScheme: theme.colorMode === 'dark' ? 'dark' : 'light' }} onChange={event => {
                const value = event.target.value
                const next = value === '__all__' ? '' : value
                if (pathname?.startsWith('/editor')) { setEditorCategory(next); return }
                const params = new URLSearchParams(searchParams.toString())
                if (next) params.set('blogCategory', next); else params.delete('blogCategory')
                router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false })
            }}>
                <option value="__all__">{siteLocale.toLowerCase().split('-')[0] === 'ms' ? 'Semua kategori' : 'All categories'}</option>
                {categories.map(cat => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: CSS_VARS.textPrimary }} />
            </div>
        </label>
    ) : null

    const sectionHeader = (headline || block.sectionLabel || subheadline || categoryFilter) ? (
        <div className={categoryFilter ? 'mb-6' : 'mb-12'}>
            <div className="mx-auto max-w-2xl text-center">
                {block.sectionLabel && <SectionLabel color={CSS_VARS.primary}>{block.sectionLabel}</SectionLabel>}
                {headline && <Heading level={2} className={subheadline ? 'mb-3' : 'mb-0'}><RichText text={headline} as="span" /></Heading>}
                {subheadline && <Body size="lg" className="opacity-60"><RichText text={subheadline} as="span" /></Body>}
            </div>
            {categoryFilter && <div className="mt-7 flex justify-start">{categoryFilter}</div>}
        </div>
    ) : null

    if (loading) {
        return (
            <AnimatedSection className="relative overflow-hidden">
                <SectionWrapper as="div" padding="default" container="default" background="transparent">
                    {sectionHeader}
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
                    {sectionHeader}
                    <div
                        role="status"
                        data-testid="blog-list-empty"
                        className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-secondary)] px-6 py-14 text-center"
                    >
                        <FileText aria-hidden="true" className="mx-auto mb-4 h-10 w-10 opacity-40" />
                        <Body size="lg" className="opacity-75">{emptyMessage}</Body>
                    </div>
                </SectionWrapper>
            </AnimatedSection>
        )
    }

    return (
        <AnimatedSection className="relative overflow-hidden">
            <GradientBlob color={CSS_VARS.primary} className="bottom-0 left-1/4" size={400} opacity={0.05} />

            <SectionWrapper as="div" padding="default" container="default" background="transparent" innerClassName="relative z-10">
                {sectionHeader}

                {variant === 'list' ? (
                    <div className="max-w-4xl mx-auto flex flex-col gap-10">
                        {posts.map((post) => (
                            <SmartLink href={`${blogBasePath}/${post.slug}`} key={post.id} className="group grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-black/10 dark:border-white/10 pb-10">
                                <div className="relative overflow-hidden rounded-xl aspect-[4/3] md:aspect-video bg-black/5 dark:bg-white/5">
                                    <div className="absolute inset-0 bg-black/10 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                                    {post.image ? (
                                        <Image src={post.image} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
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
                            </SmartLink>
                        ))}
                    </div>
                ) : (
                    <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post) => (
                            <StaggerItem key={post.id}>
                                <SmartLink href={`${blogBasePath}/${post.slug}`} className="block h-full">
                                    <HoverCard className="group flex flex-col h-full rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-500"
                                        style={{
                                            border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                                            background: `linear-gradient(to bottom, ${theme.colorMode === 'dark' ? '#111' : '#fff'}, transparent)`,
                                        }}
                                    >
                                        <div className="relative overflow-hidden aspect-[4/3] bg-black/5 dark:bg-white/5">
                                            {post.image ? (
                                                <Image src={post.image} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
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
                                                {readMoreLabel}
                                                <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                                            </div>
                                            <div className="mt-6 h-0.5 w-0 group-hover:w-16 transition-all duration-500 rounded-full"
                                                style={{ background: 'var(--brand-primary)' }} />
                                        </div>
                                    </HoverCard>
                                </SmartLink>
                            </StaggerItem>
                        ))}
                    </StaggerGrid>
                )}
            </SectionWrapper>
        </AnimatedSection>
    )
}
