'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { FAQConfig } from './config'

export function FAQBlock({ block, theme }: BlockProps<FAQConfig>) {
    const { headline, subheadline, items = [], variant = 'accordion' } = block
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    if (variant === 'grid') {
        return (
            <section className="py-24">
                <div className="container mx-auto px-6">
                    {headline && <h2 className="text-4xl font-bold font-heading text-center mb-16">{headline}</h2>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {items.map((item, i) => (
                            <div key={i} className="p-6 rounded-xl border" style={{ borderColor: `${theme.primaryColor}20` }}>
                                <h3 className="font-semibold mb-2">{item.question}</h3>
                                <p className="opacity-70 text-sm">{item.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        )
    }

    // Default: accordion
    return (
        <section className="py-24">
            <div className="container mx-auto px-6 max-w-3xl">
                {headline && <h2 className="text-4xl font-bold font-heading text-center mb-4">{headline}</h2>}
                {subheadline && <p className="text-center opacity-70 mb-12">{subheadline}</p>}
                <div className="space-y-3">
                    {items.map((item, i) => (
                        <div key={i} className="border rounded-xl overflow-hidden" style={{ borderColor: `${theme.primaryColor}20` }}>
                            <button
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                className="w-full px-6 py-4 flex items-center justify-between text-left font-medium hover:bg-white/5 transition-colors"
                            >
                                {item.question}
                                <span className={`transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                            {openIndex === i && (
                                <div className="px-6 pb-4 opacity-70 text-sm">{item.answer}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
