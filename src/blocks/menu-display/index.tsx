'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BlockProps } from '../types'
import type { MenuDisplayConfig, MenuDisplayItem, DietaryTag } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'

const DIETARY_ICONS: Record<DietaryTag, { label: string; icon: string }> = {
    halal: { label: 'Halal', icon: '\u2714\uFE0F' },
    vegetarian: { label: 'Vegetarian', icon: '\uD83E\uDD66' },
    vegan: { label: 'Vegan', icon: '\uD83C\uDF31' },
    spicy: { label: 'Spicy', icon: '\uD83C\uDF36\uFE0F' },
    'gluten-free': { label: 'Gluten Free', icon: '\uD83C\uDF3E' },
}

export function MenuDisplayBlock({ block }: BlockProps<MenuDisplayConfig>) {
    const {
        headline,
        subheadline,
        categories = [],
        variant = 'tabs',
        currency = 'RM',
        showDietaryIcons = true,
    } = block

    const [activeTab, setActiveTab] = useState(0)
    const [openAccordion, setOpenAccordion] = useState(0)

    const DietaryBadges = ({ tags }: { tags: DietaryTag[] }) => {
        if (!showDietaryIcons || tags.length === 0) return null
        return (
            <div className="flex items-center gap-1.5 flex-wrap">
                {tags.map((tag) => (
                    <span
                        key={tag}
                        title={DIETARY_ICONS[tag].label}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                    >
                        <span>{DIETARY_ICONS[tag].icon}</span>
                        <span className="hidden sm:inline">{DIETARY_ICONS[tag].label}</span>
                    </span>
                ))}
            </div>
        )
    }

    const PopularBadge = () => (
        <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: 'var(--brand-primary)', color: '#fff' }}
        >
            Popular
        </span>
    )

    const NewBadge = () => (
        <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: `rgba(var(--brand-primary-rgb), 0.188)`, color: 'var(--brand-primary)' }}
        >
            New
        </span>
    )

    const PriceDisplay = ({ item }: { item: MenuDisplayItem }) => (
        <div className="flex items-center gap-2 shrink-0">
            {item.originalPrice && item.originalPrice > item.price && (
                <span className="text-sm line-through opacity-40">
                    {currency} {item.originalPrice.toFixed(2)}
                </span>
            )}
            <span className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>
                {currency} {item.price.toFixed(2)}
            </span>
        </div>
    )

    /* ── Tabs variant ────────────────────────────────────────────────────────── */
    const renderTabs = () => {
        const activeCategory = categories[activeTab]
        if (!activeCategory) return null
        return (
            <>
                {categories.length > 1 && (
                    <div className="flex flex-wrap justify-center gap-3 mb-12" role="tablist">
                        {categories.map((cat, i) => (
                            <button
                                key={i}
                                role="tab"
                                aria-selected={activeTab === i}
                                onClick={() => setActiveTab(i)}
                                className="px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200"
                                style={activeTab === i
                                    ? { background: 'var(--brand-primary)', color: '#fff' }
                                    : { background: `rgba(var(--brand-primary-rgb), 0.063)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }
                                }
                            >
                                {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="max-w-3xl mx-auto"
                    >
                        {activeCategory.description && (
                            <p className="text-center opacity-50 mb-8">{activeCategory.description}</p>
                        )}
                        <div className="divide-y" style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                            {activeCategory.items.map((item, i) => (
                                <div key={i} className="flex items-start gap-4 py-5">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <h4 className="text-base font-bold font-heading">{item.name}</h4>
                                            {item.isPopular && <PopularBadge />}
                                            {item.isNew && <NewBadge />}
                                        </div>
                                        {item.description && <p className="text-sm opacity-50 mb-2">{item.description}</p>}
                                        <DietaryBadges tags={item.dietaryTags} />
                                    </div>
                                    <PriceDisplay item={item} />
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </>
        )
    }

    /* ── Photo Grid variant ──────────────────────────────────────────────────── */
    const renderPhotoGrid = () => (
        <div className="space-y-16">
            {categories.map((cat, ci) => (
                <div key={ci}>
                    <h3 className="text-2xl font-bold font-heading mb-2 text-center" style={{ color: 'var(--brand-primary)' }}>
                        {cat.icon && <span className="mr-2">{cat.icon}</span>}
                        {cat.name}
                    </h3>
                    {cat.description && <p className="text-center opacity-50 mb-8">{cat.description}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cat.items.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-lg"
                                style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                            >
                                {item.imageUrl && (
                                    <div className="aspect-[16/10] overflow-hidden relative">
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                        {item.isPopular && (
                                            <div className="absolute top-3 left-3"><PopularBadge /></div>
                                        )}
                                        {item.isNew && (
                                            <div className="absolute top-3 right-3"><NewBadge /></div>
                                        )}
                                    </div>
                                )}
                                <div className="p-5">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <h4 className="text-base font-bold font-heading">{item.name}</h4>
                                        <PriceDisplay item={item} />
                                    </div>
                                    {item.description && <p className="text-sm opacity-50 mb-3">{item.description}</p>}
                                    <DietaryBadges tags={item.dietaryTags} />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )

    /* ── Accordion variant ───────────────────────────────────────────────────── */
    const renderAccordion = () => (
        <div className="max-w-3xl mx-auto space-y-4">
            {categories.map((cat, ci) => {
                const isOpen = openAccordion === ci
                return (
                    <div
                        key={ci}
                        className="rounded-2xl overflow-hidden"
                        style={{ border: `1px solid rgba(var(--brand-primary-rgb), ${isOpen ? 0.188 : 0.082})` }}
                    >
                        <button
                            onClick={() => setOpenAccordion(isOpen ? -1 : ci)}
                            className="w-full flex items-center justify-between p-6 text-left transition-colors duration-200"
                            style={{ background: isOpen ? `rgba(var(--brand-primary-rgb), 0.04)` : 'transparent' }}
                            aria-expanded={isOpen}
                        >
                            <div className="flex items-center gap-3">
                                {cat.icon && <span className="text-xl">{cat.icon}</span>}
                                <div>
                                    <h3 className="text-lg font-bold font-heading">{cat.name}</h3>
                                    {cat.description && <p className="text-sm opacity-50">{cat.description}</p>}
                                </div>
                            </div>
                            <span className="text-sm opacity-50 shrink-0 ml-4">
                                {cat.items.length} items
                            </span>
                            <svg
                                className={`w-5 h-5 ml-3 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-6 pb-6 divide-y" style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.063)` }}>
                                        {cat.items.map((item, i) => (
                                            <div key={i} className="flex items-start gap-4 py-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <h4 className="text-base font-bold font-heading">{item.name}</h4>
                                                        {item.isPopular && <PopularBadge />}
                                                        {item.isNew && <NewBadge />}
                                                    </div>
                                                    {item.description && <p className="text-sm opacity-50 mb-2">{item.description}</p>}
                                                    <DietaryBadges tags={item.dietaryTags} />
                                                </div>
                                                <PriceDisplay item={item} />
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
            })}
        </div>
    )

    return (
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight" />
                    {subheadline && <RichText text={subheadline} as="p" className="text-lg opacity-50 leading-relaxed" />}
                </div>

                {variant === 'tabs' && renderTabs()}
                {variant === 'photo-grid' && renderPhotoGrid()}
                {variant === 'accordion' && renderAccordion()}
            </div>
        </AnimatedSection>
    )
}
