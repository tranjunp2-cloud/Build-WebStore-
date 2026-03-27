'use client'

import type { BlockProps } from '../types'
import type { NavigationConfig } from './config'
import { motion } from 'framer-motion'
import { mergeNavigationBrandingWithSite } from '@/lib/site-settings'

export function NavigationBlock({ block, theme, site }: BlockProps<NavigationConfig>) {
    const mergedBlock = mergeNavigationBrandingWithSite(block, site)
    const { logoText, links = [], ctaButton, variant = 'simple' } = mergedBlock
    const pc = theme.primaryColor

    return (
        <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-0 z-50"
            style={{
                borderBottom: `1px solid ${pc}12`,
                background: 'rgba(9,9,11,0.85)',
                backdropFilter: 'blur(20px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
            }}
        >
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="font-bold text-xl font-heading flex items-center gap-2"
                >
                    {mergedBlock.logo?.url ? (
                        <img src={mergedBlock.logo.url} alt={logoText || 'Logo'} className="h-8 w-auto" />
                    ) : (
                        <span style={{
                            background: `linear-gradient(135deg, ${pc}, ${pc}90)`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}>
                            {logoText}
                        </span>
                    )}
                </motion.div>

                {/* Links */}
                <div className={`hidden md:flex items-center gap-1 ${variant === 'centered' ? 'absolute left-1/2 -translate-x-1/2' : ''}`}>
                    {links.map((link, i) => (
                        <motion.a
                            key={i}
                            href={link.url}
                            whileHover={{ y: -1 }}
                            className="relative px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-white/[0.04]"
                        >
                            {link.label}
                        </motion.a>
                    ))}
                </div>

                {/* CTA */}
                {ctaButton?.show && (
                    <motion.a
                        href={ctaButton.url || '#'}
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                        style={{
                            background: `linear-gradient(135deg, ${pc}, ${pc}cc)`,
                            boxShadow: `0 4px 15px ${pc}30`,
                        }}
                    >
                        {ctaButton.label}
                    </motion.a>
                )}
            </div>
        </motion.nav>
    )
}
