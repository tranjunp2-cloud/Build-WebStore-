'use client'

import { useState, useMemo, type ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { PortfolioGridConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'

void _CSS_VARS

const PG_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function PortfolioGridSection({ children }: { children: ReactNode }) {
    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={PG_CONTAINER}>{children}</div>
        </AnimatedSection>
    )
}

type Project = NonNullable<PortfolioGridConfig['projects']>[number]

type ProjectCardProps = {
    project: Project
    className?: string
}

function ProjectCard({ project, className = '' }: ProjectCardProps) {
    const Wrapper = project.linkUrl ? 'a' : 'div'
    const linkProps = project.linkUrl
        ? { href: project.linkUrl, target: '_blank' as const, rel: 'noopener noreferrer' }
        : {}
    return (
        <Wrapper {...linkProps} className={`group relative overflow-hidden rounded-2xl block ${className}`}>
            <img
                src={project.imageUrl}
                alt={project.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            {/* Hover overlay */}
            <div
                className="absolute inset-0 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(to top, rgba(var(--brand-primary-rgb), 0.867), rgba(var(--brand-primary-rgb), 0.251), transparent)` }}
            >
                <Caption className="font-semibold uppercase tracking-wider text-white/80 mb-1 block">{project.category}</Caption>
                <Heading level={4} className="text-white mb-1">{project.title}</Heading>
                <Body size="small" className="text-white/80 line-clamp-2">{project.description}</Body>
            </div>
        </Wrapper>
    )
}

export function PortfolioGridBlock({ block }: BlockProps<PortfolioGridConfig>) {
    const { headline, subheadline, projects = [], variant = 'grid' } = block

    const categories = useMemo(() => {
        const cats = Array.from(new Set(projects.map((p) => p.category)))
        return ['All', ...cats]
    }, [projects])

    const [activeCategory, setActiveCategory] = useState('All')

    const filtered = activeCategory === 'All'
        ? projects
        : projects.filter((p) => p.category === activeCategory)

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
                    <ProjectCard project={filtered[0]} className="aspect-[4/3]" />
                    <div className="grid grid-cols-2 gap-6">
                        {filtered.slice(1, 5).map((project, i) => (
                            <ProjectCard key={i} project={project} className="aspect-square" />
                        ))}
                    </div>
                </div>
            )}

            {/* Masonry variant */}
            {variant === 'masonry' && (
                <div className="columns-2 md:columns-3 gap-6 space-y-6">
                    {filtered.map((project, i) => (
                        <ProjectCard
                            key={i}
                            project={project}
                            className={`break-inside-avoid ${i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square'}`}
                        />
                    ))}
                </div>
            )}

            {/* Grid variant */}
            {variant === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((project, i) => (
                        <ProjectCard key={i} project={project} className="aspect-[4/3]" />
                    ))}
                </div>
            )}

            {/* Showcase remaining items */}
            {variant === 'showcase' && filtered.length > 5 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.slice(5).map((project, i) => (
                        <ProjectCard key={i} project={project} className="aspect-[4/3]" />
                    ))}
                </div>
            )}
        </PortfolioGridSection>
    )
}
