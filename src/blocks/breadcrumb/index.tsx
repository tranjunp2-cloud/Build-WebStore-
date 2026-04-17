'use client'

import type { BlockProps } from '../types'
import type { BreadcrumbConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { CONTAINER, INNER_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'

void _CSS_VARS

export function BreadcrumbBlock({ block, theme: _theme }: BlockProps<BreadcrumbConfig>) {
    void _theme
    const { items = [], variant = 'simple' } = block

    return (
        <AnimatedSection className="py-4">
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                <nav aria-label="Breadcrumb">
                    <ol className="flex items-center flex-wrap gap-1 text-sm">
                        {items.map((item, i) => {
                            const isLast = i === items.length - 1
                            return (
                                <li key={i} className="flex items-center gap-1">
                                    {i > 0 && (
                                        <span className="opacity-40 mx-1">
                                            {variant === 'with-icon' ? (
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
                                                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            ) : (
                                                '/'
                                            )}
                                        </span>
                                    )}
                                    {variant === 'with-icon' && i === 0 && (
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block mr-1 opacity-60">
                                            <path d="M2.5 8l5.5-5 5.5 5M4 9.5v4a.5.5 0 00.5.5h3v-3h1v3h3a.5.5 0 00.5-.5v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                    {isLast || !item.url ? (
                                        <span
                                            className={isLast ? 'font-medium' : 'opacity-70'}
                                            style={isLast ? { color: 'var(--brand-primary)' } : undefined}
                                        >
                                            {item.label}
                                        </span>
                                    ) : (
                                        <a
                                            href={item?.url}
                                            className={`opacity-70 hover:opacity-100 transition-opacity ${TOUCH_TARGET.min} inline-flex items-center`}
                                        >
                                            {item.label}
                                        </a>
                                    )}
                                </li>
                            )
                        })}
                    </ol>
                </nav>
            </div>
        </AnimatedSection>
    )
}
