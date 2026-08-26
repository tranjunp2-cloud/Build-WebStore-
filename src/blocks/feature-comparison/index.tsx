'use client'

import type { ReactNode } from 'react'
import type { BlockProps } from '../types'
import {
    normalizeComparisonValues,
    type FeatureComparisonConfig,
} from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, CARD_PADDING } from '@/lib/design-tokens'

const FC_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function FeatureComparisonSection({ children }: { children: ReactNode }) {
    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={FC_CONTAINER}>{children}</div>
        </AnimatedSection>
    )
}

function CheckIcon({ color }: { color: string }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 10l3.5 3.5L15 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function CrossIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="opacity-25">
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

export function FeatureComparisonBlock({ block }: BlockProps<FeatureComparisonConfig>) {
    const { variant = 'table', headline } = block
    const products = Array.isArray(block.products) ? block.products : []
    const features = Array.isArray(block.features)
        ? block.features.map((feature) => ({
            ...feature,
            values: normalizeComparisonValues(feature?.values, products.length),
        }))
        : []

    if (variant === 'cards') {
        return (
            <FeatureComparisonSection>
                {headline && (
                    <RichText text={headline} as="h2" className="text-3xl md:text-5xl font-bold font-heading text-center mb-12" />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((product, pIdx) => (
                        <div
                            key={pIdx}
                            className={`rounded-2xl ${CARD_PADDING.md} md:${CARD_PADDING.lg}`}
                            style={{
                                background: product.highlighted ? `rgba(var(--brand-primary-rgb), 0.063)` : `rgba(var(--brand-primary-rgb), 0.024)`,
                                border: `1px solid ${product.highlighted ? CSS_VARS.primary : `rgba(var(--brand-primary-rgb), 0.125)`}`,
                            }}
                        >
                            <Heading
                                level={3}
                                className="mb-6"
                                style={product.highlighted ? { color: 'var(--brand-primary)' } : undefined}
                            >
                                {product.name}
                            </Heading>
                            <ul className="space-y-3">
                                {features.map((feature, fIdx) => {
                                    const has = feature.values[pIdx] ?? false
                                    return (
                                        <li key={fIdx} className="flex items-center gap-3">
                                            {has ? <CheckIcon color={CSS_VARS.primary} /> : <CrossIcon />}
                                            <RichText text={feature.name} as="span" className={has ? '' : 'opacity-40 line-through'} />
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </FeatureComparisonSection>
        )
    }

    // table (default)
    return (
        <FeatureComparisonSection>
            {headline && (
                <RichText text={headline} as="h2" className="text-3xl md:text-5xl font-bold font-heading text-center mb-12" />
            )}
            <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}>
                <table className="w-full text-left">
                    <thead>
                        <tr style={{ background: `rgba(var(--brand-primary-rgb), 0.031)` }}>
                            <th className="p-4 md:p-6 font-heading font-semibold uppercase tracking-wider opacity-60">
                                <Caption>Feature</Caption>
                            </th>
                            {products.map((product, pIdx) => (
                                <th
                                    key={pIdx}
                                    className="p-4 md:p-6 text-center font-heading font-bold"
                                    style={product.highlighted ? { color: 'var(--brand-primary)', background: `rgba(var(--brand-primary-rgb), 0.071)` } : undefined}
                                >
                                    <RichText text={product.name} as="span" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {features.map((feature, fIdx) => (
                            <tr key={fIdx} className="border-t" style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.071)` }}>
                                <td className="p-4 md:p-6 font-medium"><RichText text={feature.name} as="span" /></td>
                                {products.map((product, pIdx) => {
                                    const has = feature.values[pIdx] ?? false
                                    return (
                                        <td
                                            key={pIdx}
                                            className="p-4 md:p-6 text-center"
                                            style={product.highlighted ? { background: `rgba(var(--brand-primary-rgb), 0.024)` } : undefined}
                                        >
                                            <span className="inline-flex justify-center">
                                                {has ? <CheckIcon color={CSS_VARS.primary} /> : <CrossIcon />}
                                            </span>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </FeatureComparisonSection>
    )
}
