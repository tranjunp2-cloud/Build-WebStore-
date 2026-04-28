'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { AccordionConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { TOUCH_TARGET } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

void _CSS_VARS

export function AccordionBlock({ block, theme: _theme }: BlockProps<AccordionConfig>) {
    void _theme
    const { headline, description, items = [], variant = 'bordered' } = block
    const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set())

    const toggle = (i: number) => {
        setOpenIndexes((prev) => {
            const next = new Set(prev)
            if (next.has(i)) next.delete(i)
            else next.add(i)
            return next
        })
    }

    const itemStyles = (() => {
        switch (variant) {
            case 'bordered':
                return {
                    wrapper: 'border rounded-xl overflow-hidden',
                    wrapperStyle: { borderColor: `rgba(var(--brand-primary-rgb), 0.125)` },
                    container: 'space-y-3',
                }
            case 'separated':
                return {
                    wrapper: 'rounded-xl overflow-hidden',
                    wrapperStyle: { backgroundColor: `rgba(var(--brand-primary-rgb), 0.024)` },
                    container: 'space-y-4',
                }
            case 'flush':
                return {
                    wrapper: 'border-b',
                    wrapperStyle: { borderColor: `rgba(var(--brand-primary-rgb), 0.082)` },
                    container: 'divide-y-0',
                }
            default:
                return { wrapper: '', wrapperStyle: {}, container: '' }
        }
    })()

    return (
        <AnimatedSection>
            <SectionWrapper as="div" padding="default" container="default" background="transparent" innerClassName="max-w-3xl">
                {headline && (
                    <Heading level={2} className="text-center mb-4">
                        <RichText text={headline} as="span" />
                    </Heading>
                )}
                {description && (
                    <Body size="lg" className="text-center opacity-70 mb-12 max-w-2xl mx-auto">{description}</Body>
                )}
                <div className={itemStyles.container}>
                    {items.map((item, i) => {
                        const isOpen = openIndexes.has(i)
                        return (
                            <div
                                key={i}
                                className={itemStyles.wrapper}
                                style={itemStyles.wrapperStyle}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggle(i)}
                                    className={`w-full px-6 py-4 flex items-center justify-between text-left font-medium hover:bg-white/5 transition-colors ${TOUCH_TARGET.min}`}
                                    aria-expanded={isOpen}
                                >
                                    <RichText text={item.title} as="span" className="font-heading" />
                                    <span
                                        className="transition-transform duration-300 flex-shrink-0 ml-4"
                                        style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)', color: 'var(--brand-primary)' }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                            <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                </button>
                                <div
                                    className="overflow-hidden transition-all duration-300"
                                    style={{
                                        maxHeight: isOpen ? '500px' : '0',
                                        opacity: isOpen ? 1 : 0,
                                    }}
                                >
                                    <div className="px-6 pb-5 text-sm opacity-70 leading-relaxed">
                                        <RichText text={item.content} as="span" />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </SectionWrapper>
        </AnimatedSection>
    )
}
