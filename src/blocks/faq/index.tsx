'use client'

import { KeyboardEvent, useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import type { BlockProps } from '../types'
import type { FAQConfig, FAQItem } from './config'

function SectionHeader({ headline, subheadline }: { headline?: string; subheadline?: string }) {
    if (!headline) return null
    return (
        <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
                {headline}
            </h2>
            {subheadline && <p className="max-w-2xl mx-auto" style={{ color: 'var(--muted)' }}>{subheadline}</p>}
        </div>
    )
}

function AccordionVariant({ headline, subheadline, items }: { headline?: string; subheadline?: string; items: FAQItem[] }) {
    const [openIndex, setOpenIndex] = useState<number | null>(null)
    const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

    const toggle = useCallback((i: number) => {
        setOpenIndex(prev => prev === i ? null : i)
    }, [])

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>, i: number) => {
        let target: number | null = null
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            target = i < items.length - 1 ? i + 1 : 0
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            target = i > 0 ? i - 1 : items.length - 1
        } else if (e.key === 'Home') {
            e.preventDefault()
            target = 0
        } else if (e.key === 'End') {
            e.preventDefault()
            target = items.length - 1
        }
        if (target !== null) {
            buttonRefs.current[target]?.focus()
        }
    }, [items.length])

    return (
        <AnimatedSection className="py-16 md:py-24" style={{ color: 'var(--text)', background: 'var(--background)' }}>
            <div className="container mx-auto px-6 max-w-3xl">
                <SectionHeader headline={headline} subheadline={subheadline} />
                <div className="space-y-3" role="presentation">
                    {items.map((item, i) => {
                        const isOpen = openIndex === i
                        const headingId = `faq-heading-${i}`
                        const panelId = `faq-panel-${i}`

                        return (
                            <div
                                key={i}
                                className="overflow-hidden transition-shadow"
                                style={{
                                    border: '1px solid rgba(var(--brand-primary-rgb), 0.12)',
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'var(--surface)',
                                }}
                            >
                                <h3>
                                    <button
                                        ref={el => { buttonRefs.current[i] = el }}
                                        id={headingId}
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                        onClick={() => toggle(i)}
                                        onKeyDown={e => handleKeyDown(e, i)}
                                        className="w-full px-6 py-4 flex items-center justify-between text-left font-medium transition-colors hover:bg-[rgba(var(--brand-primary-rgb),0.04)]"
                                        style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
                                    >
                                        <span>{item.question}</span>
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            className={`flex-shrink-0 ml-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                            aria-hidden="true"
                                        >
                                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </h3>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            id={panelId}
                                            role="region"
                                            aria-labelledby={headingId}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-6 pb-5 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                                                {item.answer}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            </div>
        </AnimatedSection>
    )
}

function GridVariant({ headline, subheadline, items }: { headline?: string; subheadline?: string; items: FAQItem[] }) {
    return (
        <AnimatedSection className="py-16 md:py-24" style={{ color: 'var(--text)', background: 'var(--background)' }}>
            <div className="container mx-auto px-6">
                <SectionHeader headline={headline} subheadline={subheadline} />
                <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {items.map((item, i) => (
                        <StaggerItem
                            key={i}
                            className="p-6"
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                                borderRadius: 'var(--radius-lg)',
                            }}
                        >
                            <h3 className="font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
                                {item.question}
                            </h3>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                                {item.answer}
                            </p>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </AnimatedSection>
    )
}

function SimpleVariant({ headline, subheadline, items }: { headline?: string; subheadline?: string; items: FAQItem[] }) {
    return (
        <AnimatedSection className="py-16 md:py-24" style={{ color: 'var(--text)', background: 'var(--background)' }}>
            <div className="container mx-auto px-6 max-w-3xl">
                <SectionHeader headline={headline} subheadline={subheadline} />
                <StaggerGrid className="flex flex-col">
                    {items.map((item, i) => (
                        <StaggerItem
                            key={i}
                            className="py-6"
                            style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(var(--brand-primary-rgb), 0.1)' : 'none' }}
                        >
                            <h3 className="font-semibold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
                                {item.question}
                            </h3>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                                {item.answer}
                            </p>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </AnimatedSection>
    )
}

export function FAQBlock({ block }: BlockProps<FAQConfig>) {
    const { headline, subheadline, items = [], variant = 'accordion' } = block

    if (!items.length) return null

    switch (variant) {
        case 'grid':
            return <GridVariant headline={headline} subheadline={subheadline} items={items} />
        case 'simple':
            return <SimpleVariant headline={headline} subheadline={subheadline} items={items} />
        case 'accordion':
        default:
            return <AccordionVariant headline={headline} subheadline={subheadline} items={items} />
    }
}
