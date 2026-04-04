'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { MenuFoodConfig, MenuItem } from './config'

export function MenuFoodBlock({ block, theme }: BlockProps<MenuFoodConfig>) {
    const { headline, categories = [], variant = 'classic' } = block
    const pc = theme.primaryColor

    const [activeTab, setActiveTab] = useState(0)

    const TagBadge = ({ tag }: { tag: string }) => (
        <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: `${pc}20`, color: pc }}
        >
            {tag}
        </span>
    )

    const renderClassicItem = (item: MenuItem, i: number) => (
        <div key={i} className="flex items-start gap-4 py-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-bold font-heading">{item.name}</h4>
                    {item.tag && <TagBadge tag={item.tag} />}
                </div>
                {item.description && <p className="text-sm opacity-50 mb-2">{item.description}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <span
                    className="flex-1 border-b border-dotted mx-3 min-w-[40px]"
                    style={{ borderColor: `${pc}30` }}
                />
                <span className="text-lg font-bold" style={{ color: pc }}>
                    {item.currency || 'RM'} {item.price}
                </span>
            </div>
        </div>
    )

    const renderCardItem = (item: MenuItem, i: number) => (
        <div
            key={i}
            className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg"
            style={{ border: `1px solid ${pc}15` }}
        >
            {item.imageUrl && (
                <div className="aspect-[16/10] overflow-hidden">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-base font-bold font-heading">{item.name}</h4>
                    {item.tag && <TagBadge tag={item.tag} />}
                </div>
                {item.description && <p className="text-sm opacity-50 mb-3">{item.description}</p>}
                <p className="text-lg font-bold" style={{ color: pc }}>
                    {item.currency || 'RM'} {item.price}
                </p>
            </div>
        </div>
    )

    const renderMinimalItem = (item: MenuItem, i: number) => (
        <div
            key={i}
            className="flex items-center justify-between py-3"
            style={{ borderBottom: `1px solid ${pc}10` }}
        >
            <div className="flex items-center gap-3">
                <span className="font-medium">{item.name}</span>
                {item.tag && <TagBadge tag={item.tag} />}
            </div>
            <span className="font-bold text-sm" style={{ color: pc }}>
                {item.currency || 'RM'} {item.price}
            </span>
        </div>
    )

    const activeCategory = categories[activeTab]

    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                </div>

                {/* Category tabs */}
                {categories.length > 1 && (
                    <div className="flex flex-wrap justify-center gap-3 mb-12">
                        {categories.map((cat, i) => (
                            <button
                                key={i}
                                onClick={() => setActiveTab(i)}
                                className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200"
                                style={activeTab === i
                                    ? { background: pc, color: '#fff' }
                                    : { background: `${pc}10`, border: `1px solid ${pc}20` }
                                }
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
                            <h3
                                className="text-2xl font-bold font-heading mb-8 text-center"
                                style={{ color: pc }}
                            >
                                {activeCategory.name}
                            </h3>
                        )}

                        {/* Items */}
                        {variant === 'classic' && (
                            <div className="divide-y" style={{ borderColor: `${pc}10` }}>
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
            </div>
        </section>
    )
}
