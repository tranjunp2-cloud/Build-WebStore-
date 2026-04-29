'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { MenuFoodConfig, MenuItem } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { TOUCH_TARGET } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

void _CSS_VARS

export function MenuFoodBlock({ block, theme: _theme }: BlockProps<MenuFoodConfig>) {
    void _theme
    const { headline, categories = [], variant = 'classic' } = block

    const [activeTab, setActiveTab] = useState(0)

    const TagBadge = ({ tag }: { tag: string }) => (
        <Caption
            className="px-2 py-0.5 rounded-full font-semibold"
            style={{ background: `rgba(var(--brand-primary-rgb), 0.125)`, color: 'var(--brand-primary)' }}
        >
            {tag}
        </Caption>
    )

    const renderClassicItem = (item: MenuItem, i: number) => (
        <div key={i} className="flex items-start gap-4 py-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Heading level={4} className="text-base">{item.name}</Heading>
                    {item.tag && <TagBadge tag={item.tag} />}
                </div>
                {item.description && <Body size="small" className="opacity-50 mb-2">{item.description}</Body>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <span
                    className="flex-1 border-b border-dotted mx-3 min-w-[40px]"
                    style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.188)` }}
                />
                <span className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>
                    {item.currency || 'RM'} {item.price}
                </span>
            </div>
        </div>
    )

    const renderCardItem = (item: MenuItem, i: number) => (
        <div
            key={i}
            className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg"
            style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
        >
            {item.imageUrl && (
                <div className="aspect-[16/10] overflow-hidden">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <Heading level={4} className="text-base">{item.name}</Heading>
                    {item.tag && <TagBadge tag={item.tag} />}
                </div>
                {item.description && <Body size="small" className="opacity-50 mb-3">{item.description}</Body>}
                <p className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>
                    {item.currency || 'RM'} {item.price}
                </p>
            </div>
        </div>
    )

    const renderMinimalItem = (item: MenuItem, i: number) => (
        <div
            key={i}
            className="flex items-center justify-between py-3"
            style={{ borderBottom: `1px solid rgba(var(--brand-primary-rgb), 0.063)` }}
        >
            <div className="flex items-center gap-3">
                <RichText text={item.name} as="span" className="font-medium" />
                {item.tag && <TagBadge tag={item.tag} />}
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--brand-primary)' }}>
                {item.currency || 'RM'} {item.price}
            </span>
        </div>
    )

    const activeCategory = categories[activeTab]

    return (
        <AnimatedSection>
            <SectionWrapper as="div" padding="default" container="default" background="transparent">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <Heading level={2} className="mb-5 leading-tight">
                        <RichText text={headline} as="span" />
                    </Heading>
                </div>

                {/* Category tabs */}
                {categories.length > 1 && (
                    <div className="flex flex-wrap justify-center gap-3 mb-12">
                        {categories.map((cat, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setActiveTab(i)}
                                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${TOUCH_TARGET.min}`}
                                style={activeTab === i
                                    ? { background: 'var(--brand-primary)', color: '#fff' }
                                    : { background: `rgba(var(--brand-primary-rgb), 0.063)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }
                                }
                                aria-current={activeTab === i}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}

                {activeCategory && (
                    <div className="max-w-3xl mx-auto">
                        {/* Category name (when single category) */}
                        {categories.length === 1 && (
                            <Heading level={3} className="mb-8 text-center" style={{ color: 'var(--brand-primary)' }}>
                                {activeCategory.name}
                            </Heading>
                        )}

                        {/* Items */}
                        {variant === 'classic' && (
                            <div className="divide-y" style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                                {activeCategory.items.map((item, i) => renderClassicItem(item, i))}
                            </div>
                        )}

                        {variant === 'cards' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {activeCategory.items.map((item, i) => renderCardItem(item, i))}
                            </div>
                        )}

                        {variant === 'minimal' && (
                            <div>
                                {activeCategory.items.map((item, i) => renderMinimalItem(item, i))}
                            </div>
                        )}
                    </div>
                )}
            </SectionWrapper>
        </AnimatedSection>
    )
}
