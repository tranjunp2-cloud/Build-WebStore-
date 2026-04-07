'use client'

import { motion } from 'framer-motion'
import type { HeroConfig } from './config'

// ── Shared CTA renderer ──────────────────────────────────────────────────────
export function CTAButtons({ buttons, variant = 'default' }: { buttons: HeroConfig['ctaButtons']; variant?: 'default' | 'glass' }) {
    if (!buttons || buttons.length === 0) return null

    return (
        <div className="flex flex-wrap gap-4">
            {buttons.map((btn, i) => (
                <motion.a
                    key={i}
                    href={btn.url}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-300"
                    style={btn.style === 'outline'
                        ? variant === 'glass'
                            ? {
                                border: '2px solid rgba(255,255,255,0.3)',
                                color: '#fff',
                                background: 'rgba(255,255,255,0.05)',
                                backdropFilter: 'blur(8px)',
                            }
                            : {
                                border: `2px solid rgba(var(--brand-primary-rgb), 0.314)`,
                                color: 'var(--brand-primary)',
                                background: `rgba(var(--brand-primary-rgb), 0.031)`,
                            }
                        : variant === 'glass'
                            ? {
                                background: 'rgba(255,255,255,0.15)',
                                backdropFilter: 'blur(12px)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                            }
                            : {
                                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                color: '#fff',
                                boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.208)`,
                            }}
                >
                    {btn.label}
                </motion.a>
            ))}
        </div>
    )
}
