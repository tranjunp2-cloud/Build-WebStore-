'use client'

import type { BlockProps } from '../types'
import type { FeatureComparisonConfig } from './config'
import { AnimatedSection } from '../shared/animations'

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

export function FeatureComparisonBlock({ block, theme }: BlockProps<FeatureComparisonConfig>) {
    const { variant = 'table', headline, products = [], features = [] } = block
    const pc = theme.primaryColor

    if (variant === 'cards') {
        return (
            <AnimatedSection className="py-24">
                <div className="container mx-auto px-6">
                    {headline && (
                        <h2 className="text-3xl md:text-5xl font-bold font-heading text-center mb-12">{headline}</h2>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map((product, pIdx) => (
                            <div
                                key={pIdx}
                                className="rounded-2xl p-6 md:p-8"
                                style={{
                                    background: product.highlighted ? `${pc}10` : `${pc}06`,
                                    border: `1px solid ${product.highlighted ? pc : `${pc}20`}`,
                                }}
                            >
                                <h3
                                    className="text-xl font-bold font-heading mb-6"
                                    style={product.highlighted ? { color: pc } : undefined}
                                >
                                    {product.name}
                                </h3>
                                <ul className="space-y-3">
                                    {features.map((feature, fIdx) => {
                                        const has = feature.values[pIdx] ?? false
                                        return (
                                            <li key={fIdx} className="flex items-center gap-3">
                                                {has ? <CheckIcon color={pc} /> : <CrossIcon />}
                                                <span className={has ? '' : 'opacity-40 line-through'}>{feature.name}</span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // table (default)
    return (
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6">
                {headline && (
                    <h2 className="text-3xl md:text-5xl font-bold font-heading text-center mb-12">{headline}</h2>
                )}
                <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${pc}20` }}>
                    <table className="w-full text-left">
                        <thead>
                            <tr style={{ background: `${pc}08` }}>
                                <th className="p-4 md:p-6 font-heading font-semibold text-sm uppercase tracking-wider opacity-60">
                                    Feature
                                </th>
                                {products.map((product, pIdx) => (
                                    <th
                                        key={pIdx}
                                        className="p-4 md:p-6 text-center font-heading font-bold"
                                        style={product.highlighted ? { color: pc, background: `${pc}12` } : undefined}
                                    >
                                        {product.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((feature, fIdx) => (
                                <tr key={fIdx} className="border-t" style={{ borderColor: `${pc}12` }}>
                                    <td className="p-4 md:p-6 font-medium">{feature.name}</td>
                                    {products.map((product, pIdx) => {
                                        const has = feature.values[pIdx] ?? false
                                        return (
                                            <td
                                                key={pIdx}
                                                className="p-4 md:p-6 text-center"
                                                style={product.highlighted ? { background: `${pc}06` } : undefined}
                                            >
                                                <span className="inline-flex justify-center">
                                                    {has ? <CheckIcon color={pc} /> : <CrossIcon />}
                                                </span>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AnimatedSection>
    )
}
