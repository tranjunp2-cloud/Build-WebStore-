'use client'

import { useState, useMemo } from 'react'
import type { BlockProps } from '../types'
import type { PortfolioGridConfig } from './config'

export function PortfolioGridBlock({ block, theme }: BlockProps<PortfolioGridConfig>) {
    const { headline, subheadline, projects = [], variant = 'grid' } = block

    const categories = useMemo(() => {
        const cats = Array.from(new Set(projects.map((p) => p.category)))
        return ['All', ...cats]
    }, [projects])

    const [activeCategory, setActiveCategory] = useState('All')

    const filtered = activeCategory === 'All'
        ? projects
        : projects.filter((p) => p.category === activeCategory)

    const ProjectCard = ({ project, className = '' }: { project: typeof projects[0]; className?: string }) => {
        const Wrapper = project.linkUrl ? 'a' : 'div'
        const linkProps = project.linkUrl ? { href: project.linkUrl, target: '_blank' as const, rel: 'noopener noreferrer' } : {}
        return (
            <Wrapper {...linkProps} className={`group relative overflow-hidden rounded-2xl block ${className}`}>
                <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(to top, rgba(var(--brand-primary-rgb), 0.867), rgba(var(--brand-primary-rgb), 0.251), transparent)` }}>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/80 mb-1">{project.category}</span>
                    <h3 className="text-lg font-bold font-heading text-white mb-1">{project.title}</h3>
                    <p className="text-sm text-white/80 line-clamp-2">{project.description}</p>
                </div>
            </Wrapper>
        )
    }

    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                    {subheadline && <p className="text-lg opacity-50 leading-relaxed">{subheadline}</p>}
                </div>

                {/* Category filter */}
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200"
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

                {/* Grid variant (also remaining showcase items) */}
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
            </div>
        </section>
    )
}
