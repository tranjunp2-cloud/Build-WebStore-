'use client'

import { useState, useMemo, type ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { PortfolioGridConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { TOUCH_TARGET } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'
import { getGalleryImages } from '@/lib/images/industry-images'
import { MediaUploadOverlay } from '@/blocks/shared/media-upload-overlay'

void _CSS_VARS

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/<[^>]+>/g, '') // second pass for decoded tags
        .trim()
}

function PortfolioGridSection({ children }: { children: ReactNode }) {
    return (
        <AnimatedSection>
            <SectionWrapper as="div" padding="default" container="default" background="transparent">
                {children}
            </SectionWrapper>
        </AnimatedSection>
    )
}

type Project = NonNullable<PortfolioGridConfig['projects']>[number]

type ProjectCardProps = {
    project: Project
    className?: string
    imageIndex?: number
    /** Payload field path for the MediaUploadOverlay — omit for fallback-only slots. */
    uploadField?: string
}

function ProjectCard({ project, className = '', imageIndex, uploadField }: ProjectCardProps) {
    const Wrapper = project.linkUrl ? 'a' : 'div'
    const linkProps = project.linkUrl
        ? { href: project.linkUrl, target: '_blank' as const, rel: 'noopener noreferrer' }
        : {}
    return (
        <Wrapper {...linkProps} className={`group relative overflow-hidden rounded-2xl block ${className}`}>
            {uploadField ? (
                <MediaUploadOverlay
                    field={uploadField}
                    altText={project.title}
                    valueShape="media"
                    positionClass="relative"
                    className="w-full h-full"
                >
                    <img
                        src={project.imageUrl}
                        alt={project.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        data-image-index={imageIndex}
                    />
                </MediaUploadOverlay>
            ) : (
                <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    data-image-index={imageIndex}
                />
            )}
            {/* Hover overlay — pointer-events-none so mouse events reach the <img> for editor image-replace */}
            <div
                className="absolute inset-0 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: `linear-gradient(to top, rgba(var(--brand-primary-rgb), 0.867), rgba(var(--brand-primary-rgb), 0.251), transparent)` }}
            >
                <Caption className="font-semibold uppercase tracking-wider text-white/80 mb-1 block">{project.category}</Caption>
                <Heading level={4} className="text-white mb-1">{project.title}</Heading>
                <Body size="small" className="text-white/80 line-clamp-2">{project.description}</Body>
            </div>
        </Wrapper>
    )
}

export function PortfolioGridBlock({ block, site }: BlockProps<PortfolioGridConfig>) {
    const { headline, subheadline, projects: rawProjects = [], variant = 'grid' } = block
    const category = (site?.siteType as string) || 'business'

    // Per-slot fallback: prefer project.image.url (Payload upload), fallback to imageUrl (AI gen string), then Unsplash
    const fallbackUrls = getGalleryImages(category, 6, site?.imageLibraryS3 as Record<string, string> | undefined)
    const projectCount = rawProjects.length > 0 ? rawProjects.length : fallbackUrls.length
    const projects = Array.from({ length: projectCount }, (_, i) => {
        const p = rawProjects[i]
        const imgSrc = (p?.image as { url?: string } | undefined)?.url || p?.imageUrl
        const cat = stripHtml(p?.category || '')
        if (imgSrc) return { ...p, imageUrl: imgSrc, category: cat }
        return { ...p, imageUrl: fallbackUrls[i % fallbackUrls.length] ?? fallbackUrls[0], title: p?.title || '', category: cat, description: p?.description || '' }
    })

    const categories = useMemo(() => {
        const cats = Array.from(new Set(projects.map((p) => p.category)))
        return ['All', ...cats]
    }, [projects])

    const [activeCategory, setActiveCategory] = useState('All')

    // Track original index through filter so imageIndex always maps to the correct projects[] slot
    const filtered = useMemo(() =>
        projects
            .map((project, index) => ({ project, index }))
            .filter(({ project }) => activeCategory === 'All' || project.category === activeCategory),
        [projects, activeCategory]
    )

    return (
        <PortfolioGridSection>
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto mb-12">
                <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight" />
                {subheadline && <RichText text={subheadline} as="p" className="text-lg opacity-50 leading-relaxed" />}
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap justify-center gap-3 mb-12">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${TOUCH_TARGET.min}`}
                        style={activeCategory === cat
                            ? { background: 'var(--brand-primary)', color: '#fff' }
                            : { background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'inherit', border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }
                        }
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Showcase variant: first item large */}
            {variant === 'showcase' && filtered.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <ProjectCard
                        project={filtered[0].project}
                        className="aspect-[4/3]"
                        imageIndex={filtered[0].index}
                        uploadField={filtered[0].index < rawProjects.length ? `projects.${filtered[0].index}.image` : undefined}
                    />
                    <div className="grid grid-cols-2 gap-6">
                        {filtered.slice(1, 5).map(({ project, index }) => (
                            <ProjectCard
                                key={index}
                                project={project}
                                className="aspect-square"
                                imageIndex={index}
                                uploadField={index < rawProjects.length ? `projects.${index}.image` : undefined}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Masonry variant */}
            {variant === 'masonry' && (
                <div className="columns-2 md:columns-3 gap-6 space-y-6">
                    {filtered.map(({ project, index }, i) => (
                        <ProjectCard
                            key={index}
                            project={project}
                            className={`break-inside-avoid ${i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square'}`}
                            imageIndex={index}
                            uploadField={index < rawProjects.length ? `projects.${index}.image` : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Grid variant */}
            {variant === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(({ project, index }) => (
                        <ProjectCard
                            key={index}
                            project={project}
                            className="aspect-[4/3]"
                            imageIndex={index}
                            uploadField={index < rawProjects.length ? `projects.${index}.image` : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Showcase remaining items */}
            {variant === 'showcase' && filtered.length > 5 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.slice(5).map(({ project, index }) => (
                        <ProjectCard
                            key={index}
                            project={project}
                            className="aspect-[4/3]"
                            imageIndex={index}
                            uploadField={index < rawProjects.length ? `projects.${index}.image` : undefined}
                        />
                    ))}
                </div>
            )}
        </PortfolioGridSection>
    )
}
