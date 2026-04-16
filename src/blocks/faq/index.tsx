'use client'

import { KeyboardEvent, useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AnimatedSection, StaggerGrid, StaggerItem } from '../shared/animations'
import type { BlockProps } from '../types'
import type { FAQConfig, FAQItem } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CARD_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

/**
 * Plan 260415 Lỗi G + Decision 4 — FAQ answer accept cả `string` (legacy) và
 * `JSONContent` Lexical (new). Runtime check render đúng type, không cần SQL
 * migration. Tương thích với existing FAQs plain string + cho phép rich text
 * cho FAQs mới qua admin panel.
 *
 * RichText component đã handle cả 2 types runtime check.
 */
function FAQAnswer({ answer }: { answer: FAQItem['answer'] }) {
    return <RichText text={answer as string} as="span" />
}

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────

function FAQSection({ children, narrow = false, labelledBy }: { children: ReactNode; narrow?: boolean; labelledBy?: string }) {
    return (
        <SectionWrapper
            as={AnimatedSection}
            padding="default"
            container={narrow ? 'narrow' : 'default'}
            style={{ color: CSS_VARS.text, background: CSS_VARS.background }}
            aria-labelledby={labelledBy}
        >
            {children}
        </SectionWrapper>
    )
}

function SectionHeader({ headline, subheadline, labelledBy }: { headline?: string; subheadline?: string; labelledBy?: string }) {
    if (!headline) return null
    return (
        <div className="text-center mb-12">
            <Heading level={2} id={labelledBy} className="mb-3" style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                <RichText text={headline} as="span" />
            </Heading>
            {subheadline && (
                <Body className="max-w-2xl mx-auto" style={{ color: CSS_VARS.muted }}>
                    <RichText text={subheadline} as="span" />
                </Body>
            )}
        </div>
    )
}

/**
 * Plan 260415 Lỗi I — allowMultiple prop để user có thể mở nhiều items đồng
 * thời. Default false (single-expand giữ behavior cũ). Config override qua
 * block.allowMultiple.
 */
function AccordionVariant({ headline, subheadline, items, allowMultiple = false, labelledBy }: { headline?: string; subheadline?: string; items: FAQItem[]; allowMultiple?: boolean; labelledBy?: string }) {
    const [openIndices, setOpenIndices] = useState<Set<number>>(new Set())
    const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
    const idPrefix = useId()

    const toggle = useCallback((i: number) => {
        setOpenIndices(prev => {
            const next = new Set(allowMultiple ? prev : [])
            if (prev.has(i)) {
                next.delete(i)
            } else {
                next.add(i)
            }
            return next
        })
    }, [allowMultiple])

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
        <FAQSection narrow labelledBy={labelledBy}>
            <SectionHeader headline={headline} subheadline={subheadline} labelledBy={labelledBy} />
            {/* Plan 260415 Lỗi J — role="list" semantic hơn role="presentation" */}
            <div className="space-y-3" role="list">
                {items.map((item, i) => {
                    const isOpen = openIndices.has(i)
                    const headingId = `${idPrefix}-faq-heading-${i}`
                    const panelId = `${idPrefix}-faq-panel-${i}`

                    return (
                        <div
                            /* Plan 260415 Lỗi B — stable key từ question text */
                            key={`${item.question}-${i}`}
                            role="listitem"
                            className="overflow-hidden transition-shadow"
                            style={{
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.12)',
                                borderRadius: 'var(--radius-lg)',
                                background: CSS_VARS.surface,
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
                                    className={`w-full px-6 py-4 ${TOUCH_TARGET.min} flex items-center justify-between text-left font-medium transition-colors hover:bg-[rgba(var(--brand-primary-rgb),0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.35)]`}
                                    style={{ color: CSS_VARS.text, fontFamily: CSS_VARS.fontHeading }}
                                >
                                    <span className="flex-1 pr-4">{item.question}</span>
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
                                        {/* Plan 260415 Lỗi G + Decision 4 — answer support RichText (Lexical) */}
                                        <Body size="small" className="px-6 pb-5" style={{ color: CSS_VARS.muted }}>
                                            <FAQAnswer answer={item.answer} />
                                        </Body>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>
        </FAQSection>
    )
}

function GridVariant({ headline, subheadline, items, labelledBy }: { headline?: string; subheadline?: string; items: FAQItem[]; labelledBy?: string }) {
    return (
        <FAQSection labelledBy={labelledBy}>
            <SectionHeader headline={headline} subheadline={subheadline} labelledBy={labelledBy} />
            <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {items.map((item, i) => (
                    <StaggerItem
                        /* Plan 260415 Lỗi B — stable key */
                        key={`${item.question}-${i}`}
                        className={CARD_PADDING.md}
                        style={{
                            background: CSS_VARS.surface,
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.1)',
                            borderRadius: 'var(--radius-lg)',
                        }}
                    >
                        <Heading level={4} className="mb-2" style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                            {item.question}
                        </Heading>
                        <Body size="small" style={{ color: CSS_VARS.muted }}>
                            <FAQAnswer answer={item.answer} />
                        </Body>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </FAQSection>
    )
}

function SimpleVariant({ headline, subheadline, items, labelledBy }: { headline?: string; subheadline?: string; items: FAQItem[]; labelledBy?: string }) {
    return (
        <FAQSection narrow labelledBy={labelledBy}>
            <SectionHeader headline={headline} subheadline={subheadline} labelledBy={labelledBy} />
            <StaggerGrid className="flex flex-col">
                {items.map((item, i) => (
                    <StaggerItem
                        /* Plan 260415 Lỗi B + F — stable key + last:border-none */
                        key={`${item.question}-${i}`}
                        className="py-6 border-b last:border-b-0"
                        style={{ borderColor: 'rgba(var(--brand-primary-rgb), 0.1)' }}
                    >
                        <Heading level={4} className="mb-2" style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                            {item.question}
                        </Heading>
                        <Body size="small" style={{ color: CSS_VARS.muted }}>
                            <FAQAnswer answer={item.answer} />
                        </Body>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </FAQSection>
    )
}

export function FAQBlock({ block }: BlockProps<FAQConfig>) {
    const { headline, subheadline, items = [], variant = 'accordion' } = block
    /* Plan 260415 Lỗi I — allowMultiple từ block config (schema đã add) */
    const allowMultiple = block.allowMultiple || false
    /* Plan 260415 Lỗi K — aria-labelledby cho section */
    const labelledBy = useId()

    /* Plan 260415 Lỗi C — empty state dev warn */
    if (!items.length) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn('[faq] items array empty — block rendered nothing')
        }
        return null
    }

    switch (variant) {
        case 'grid':
            return <GridVariant headline={headline} subheadline={subheadline} items={items} labelledBy={labelledBy} />
        case 'simple':
            return <SimpleVariant headline={headline} subheadline={subheadline} items={items} labelledBy={labelledBy} />
        case 'accordion':
        default:
            return <AccordionVariant headline={headline} subheadline={subheadline} items={items} allowMultiple={allowMultiple} labelledBy={labelledBy} />
    }
}
