'use client'

import { useState, useEffect } from 'react'
import type { BlockProps } from '../types'
import type { NavigationConfig } from './config'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { mergeNavigationBrandingWithSite } from '@/lib/site-settings'

// ── Shared Logo Component ────────────────────────────────────────────────────

function NavLogo({ logo, logoText, className }: { logo?: { url: string; alt?: string }; logoText?: string; className?: string }) {
    if (logo?.url) {
        return <img src={logo.url} alt={logoText || 'Logo'} className={className || 'h-6 sm:h-8 w-auto'} />
    }
    return (
        <span style={{
            background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.565))`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
        }}>
            {logoText}
        </span>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function NavigationBlock({ block, theme, site }: BlockProps<NavigationConfig>) {
    const mergedBlock = mergeNavigationBrandingWithSite(block, site)
    const { logoText, links = [], ctaButton, variant = 'simple' } = mergedBlock
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // ── Transparent variant ───────────────────────────────────────────────
    if (variant === 'transparent') {
        return <TransparentNav mergedBlock={mergedBlock} logoText={logoText} links={links} ctaButton={ctaButton} />
    }

    // ── Sidebar variant ───────────────────────────────────────────────────
    if (variant === 'sidebar') {
        return <SidebarNav mergedBlock={mergedBlock} logoText={logoText} links={links} ctaButton={ctaButton} />
    }

    // ── Pill variant ──────────────────────────────────────────────────────
    if (variant === 'pill') {
        return <PillNav mergedBlock={mergedBlock} logoText={logoText} links={links} ctaButton={ctaButton} />
    }

    // ── Default: simple / centered / mega-menu (existing) ─────────────────
    return (
        <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-0 z-50"
            style={{
                borderBottom: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
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
                    <NavLogo logo={mergedBlock.logo} logoText={logoText} />
                </motion.div>

                {/* Desktop Links */}
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

                {/* Desktop CTA + Mobile Menu Button */}
                <div className="flex items-center gap-3">
                    {ctaButton?.show && (
                        <motion.a
                            href={ctaButton.url || '#'}
                            whileHover={{ scale: 1.04, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className="hidden sm:inline-flex px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                            style={{
                                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                boxShadow: `0 4px 15px rgba(var(--brand-primary-rgb), 0.188)`,
                            }}
                        >
                            {ctaButton.label}
                        </motion.a>
                    )}

                    {/* Mobile hamburger button */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="md:hidden overflow-hidden"
                        style={{
                            background: 'rgba(9,9,11,0.95)',
                            borderTop: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                        }}
                    >
                        <div className="container mx-auto px-6 py-4 flex flex-col gap-1">
                            {links.map((link, i) => (
                                <a
                                    key={i}
                                    href={link.url}
                                    className="px-4 py-3 text-sm font-medium opacity-70 hover:opacity-100 rounded-lg hover:bg-white/[0.06] transition-all duration-200"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {link.label}
                                </a>
                            ))}
                            {ctaButton?.show && (
                                <a
                                    href={ctaButton.url || '#'}
                                    className="mt-2 px-4 py-3 rounded-lg text-sm font-semibold text-white text-center transition-all duration-200"
                                    style={{
                                        background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                    }}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {ctaButton.label}
                                </a>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    )
}

// ── Transparent Nav ──────────────────────────────────────────────────────────

function TransparentNav({ mergedBlock, logoText, links, ctaButton }: {
    mergedBlock: NavigationConfig & { logo?: { url: string; alt?: string } }
    logoText?: string
    links: { label: string; url: string }[]
    ctaButton?: { show: boolean; label: string; url: string }
}) {
    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 100)
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
            style={{
                background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
                backdropFilter: scrolled ? 'blur(20px)' : 'none',
                WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
                borderBottom: scrolled ? `1px solid rgba(var(--brand-primary-rgb), 0.071)` : '1px solid transparent',
                color: scrolled ? '#18181b' : '#fff',
            }}
        >
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <motion.div whileHover={{ scale: 1.02 }} className="font-bold text-xl font-heading">
                    {mergedBlock.logo?.url ? (
                        <img src={mergedBlock.logo.url} alt={logoText || 'Logo'} className="h-6 sm:h-8 w-auto" />
                    ) : (
                        <span style={scrolled ? {
                            background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.565))`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        } : { color: 'inherit' }}>
                            {logoText}
                        </span>
                    )}
                </motion.div>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                    {links.map((link, i) => (
                        <motion.a
                            key={i}
                            href={link.url}
                            whileHover={{ y: -1 }}
                            className="px-4 py-2 text-sm font-medium opacity-70 hover:opacity-100 transition-all duration-200 rounded-lg"
                            style={{
                                color: 'inherit',
                            }}
                        >
                            {link.label}
                        </motion.a>
                    ))}
                </div>

                {/* CTA + Mobile */}
                <div className="flex items-center gap-3">
                    {ctaButton?.show && (
                        <motion.a
                            href={ctaButton.url || '#'}
                            whileHover={{ scale: 1.04, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className="hidden sm:inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                            style={{
                                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                boxShadow: `0 4px 15px rgba(var(--brand-primary-rgb), 0.188)`,
                            }}
                        >
                            {ctaButton.label}
                        </motion.a>
                    )}
                    <button
                        className="md:hidden p-2 rounded-lg transition-colors"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                        style={{ color: 'inherit' }}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="md:hidden overflow-hidden"
                        style={{
                            background: 'rgba(9,9,11,0.95)',
                            borderTop: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                            color: '#fff',
                        }}
                    >
                        <div className="container mx-auto px-6 py-4 flex flex-col gap-1">
                            {links.map((link, i) => (
                                <a key={i} href={link.url} className="px-4 py-3 text-sm font-medium opacity-70 hover:opacity-100 rounded-lg hover:bg-white/[0.06] transition-all duration-200" onClick={() => setMobileMenuOpen(false)}>
                                    {link.label}
                                </a>
                            ))}
                            {ctaButton?.show && (
                                <a href={ctaButton.url || '#'} className="mt-2 px-4 py-3 rounded-lg text-sm font-semibold text-white text-center" style={{ background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))` }} onClick={() => setMobileMenuOpen(false)}>
                                    {ctaButton.label}
                                </a>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    )
}

// ── Sidebar Nav ──────────────────────────────────────────────────────────────

function SidebarNav({ mergedBlock, logoText, links, ctaButton }: {
    mergedBlock: NavigationConfig & { logo?: { url: string; alt?: string } }
    logoText?: string
    links: { label: string; url: string }[]
    ctaButton?: { show: boolean; label: string; url: string }
}) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* Hamburger trigger — always visible */}
            <button
                className="fixed top-4 left-4 z-50 p-2.5 rounded-xl transition-all duration-200"
                onClick={() => setIsOpen(true)}
                aria-label="Open navigation"
                style={{
                    background: 'rgba(9,9,11,0.85)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                    color: '#fff',
                }}
            >
                <Menu size={20} />
            </button>

            {/* Sidebar Drawer + Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/50 z-50"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed top-0 left-0 bottom-0 w-72 z-50 flex flex-col"
                            style={{
                                background: 'rgba(9,9,11,0.97)',
                                borderRight: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                                color: '#fff',
                            }}
                        >
                            {/* Close + Logo */}
                            <div className="flex items-center justify-between p-6">
                                <div className="font-bold text-xl font-heading">
                                    <NavLogo logo={mergedBlock.logo} logoText={logoText} />
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                    aria-label="Close navigation"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Links */}
                            <nav className="flex-1 px-4 space-y-1">
                                {links.map((link, i) => (
                                    <motion.a
                                        key={i}
                                        href={link.url}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="block px-4 py-3 text-sm font-medium opacity-70 hover:opacity-100 rounded-lg hover:bg-white/[0.06] transition-all duration-200"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        {link.label}
                                    </motion.a>
                                ))}
                            </nav>

                            {/* CTA at bottom */}
                            {ctaButton?.show && (
                                <div className="p-6">
                                    <a
                                        href={ctaButton.url || '#'}
                                        className="block w-full px-4 py-3 rounded-lg text-sm font-semibold text-white text-center transition-all duration-200"
                                        style={{
                                            background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                                            boxShadow: `0 4px 15px rgba(var(--brand-primary-rgb), 0.188)`,
                                        }}
                                        onClick={() => setIsOpen(false)}
                                    >
                                        {ctaButton.label}
                                    </a>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}

// ── Pill Nav ─────────────────────────────────────────────────────────────────

function PillNav({ mergedBlock, logoText, links, ctaButton }: {
    mergedBlock: NavigationConfig & { logo?: { url: string; alt?: string } }
    logoText?: string
    links: { label: string; url: string }[]
    ctaButton?: { show: boolean; label: string; url: string }
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <motion.nav
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl"
        >
            <div
                className="rounded-full px-6 py-3 flex items-center justify-between"
                style={{
                    background: 'rgba(255,255,255,0.90)',
                    backdropFilter: 'blur(20px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    border: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                }}
            >
                {/* Logo */}
                <div className="font-bold text-lg font-heading text-zinc-900">
                    {mergedBlock.logo?.url ? (
                        <img src={mergedBlock.logo.url} alt={logoText || 'Logo'} className="h-6 w-auto" />
                    ) : (
                        <span style={{
                            background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.565))`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}>
                            {logoText}
                        </span>
                    )}
                </div>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-0.5">
                    {links.map((link, i) => (
                        <a
                            key={i}
                            href={link.url}
                            className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors duration-200 rounded-full hover:bg-black/[0.04]"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                {/* CTA + Mobile */}
                <div className="flex items-center gap-2">
                    {ctaButton?.show && (
                        <a
                            href={ctaButton.url || '#'}
                            className="hidden sm:inline-flex px-4 py-1.5 rounded-full text-sm font-semibold text-white transition-all duration-200"
                            style={{
                                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                            }}
                        >
                            {ctaButton.label}
                        </a>
                    )}
                    <button
                        className="md:hidden p-1.5 rounded-full text-zinc-600 hover:text-zinc-900 transition-colors"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </div>

            {/* Mobile dropdown under pill */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="md:hidden mt-2 rounded-2xl overflow-hidden"
                        style={{
                            background: 'rgba(255,255,255,0.95)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                            border: `1px solid rgba(var(--brand-primary-rgb), 0.071)`,
                        }}
                    >
                        <div className="p-3 flex flex-col gap-0.5">
                            {links.map((link, i) => (
                                <a
                                    key={i}
                                    href={link.url}
                                    className="px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-xl hover:bg-black/[0.04] transition-all duration-200"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {link.label}
                                </a>
                            ))}
                            {ctaButton?.show && (
                                <a
                                    href={ctaButton.url || '#'}
                                    className="mt-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white text-center"
                                    style={{ background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))` }}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {ctaButton.label}
                                </a>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    )
}
