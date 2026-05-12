'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import Image from 'next/image'
import type { BlockProps } from '../types'
import type { NavigationConfig, NavLink } from './config'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, EyeOff } from 'lucide-react'
import { mergeNavigationBrandingWithSite } from '@/lib/site-settings'
import { Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, TOUCH_TARGET, NAV_Z_CLASS } from '@/lib/design-tokens'
import { useScrollShrink } from './use-scroll-shrink'

// Token shortcut: nav containers consume CONTAINER.default + INNER_PADDING.
// h-16 stays because nav row height is a layout invariant, not section padding.
const NAV_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

// Theme-adaptive nav surface — uses color-mix so nav background reads the
// site's resolved --background CSS var and adds 85% opacity instead of the
// previous hardcoded `rgba(9,9,11,0.85)`. Falls back to near-black when
// color-mix is unsupported so existing dark-first sites look identical.
const NAV_SURFACE_BG = `color-mix(in srgb, var(--background, #09090b) 85%, transparent)`
const NAV_SURFACE_BG_SOLID = `color-mix(in srgb, var(--background, #09090b) 97%, transparent)`
const NAV_SURFACE_BORDER = `1px solid rgba(var(--brand-primary-rgb), 0.12)`
const NAV_SURFACE_TEXT = `var(--text, #fafafa)`

// ── Shared Logo Component ────────────────────────────────────────────────────
// Plan 260415 nav-bugfix C — nhận thêm gradientMode + scrolled để TransparentNav
// dùng chung component này thay cho logic inline duplicate. Mặc định luôn
// show gradient brand primary → 56% primary. Khi gradientMode='when-scrolled'
// (dùng cho TransparentNav), chỉ show gradient khi đã scroll — lúc trên hero
// giữ màu trắng trên overlay.

const LOGO_GRADIENT_STYLE = {
    background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.565))`,
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text' as const,
}

type NavLogoProps = {
    logo?: { url: string; alt?: string }
    logoText?: string
    className?: string
    gradientMode?: 'always' | 'when-scrolled' | 'never'
    scrolled?: boolean
}

function NavLogo({
    logo,
    logoText,
    className,
    gradientMode = 'always',
    scrolled = false,
}: NavLogoProps) {
    if (logo?.url) {
        return <Image src={logo.url} alt={logoText || 'Logo'} width={0} height={0} sizes="(max-width: 768px) 128px, 256px" className={className || 'h-6 sm:h-8 w-auto'} />
    }
    const shouldShowGradient =
        gradientMode === 'always' || (gradientMode === 'when-scrolled' && scrolled)
    return (
        <span style={shouldShowGradient ? LOGO_GRADIENT_STYLE : { color: 'inherit' }}>
            {logoText}
        </span>
    )
}

// ── Dropdown + recursive nav item helpers (BUG-F05-033) ─────────────────────
// Support link.children on desktop (hover dropdown) and mobile/sidebar
// (recursive nested list). Used by all variants.

function DropdownLink({ link, i }: { link: NavLink; i: number }) {
    const [open, setOpen] = useState(false)
    const hasChildren = link.children && link.children.length > 0

    if (!hasChildren) {
        return (
            <motion.a
                key={i}
                href={link?.url}
                whileHover={{ y: -1 }}
                className="relative px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-white/[0.04] inline-flex items-center gap-1"
            >
                {link.label}
                {link._hiddenFromVisitor && <EyeOff size={11} className="text-amber-400 shrink-0" aria-label="Hidden from visitors" />}
            </motion.a>
        )
    }

    return (
        <div
            className="relative"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                type="button"
                className="relative px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-white/[0.04] inline-flex items-center gap-1"
            >
                {link.label}
                <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute left-0 top-full ${NAV_Z_CLASS.dropdown} mt-1 min-w-[180px] rounded-xl p-1.5 shadow-xl backdrop-blur-lg`}
                        style={{
                            // Plan 260415 nav fix: theme-adaptive dropdown panel.
                            // Reads --surface from resolved theme so light themes
                            // get a light dropdown instead of the previous
                            // hardcoded navy `#0F172A`.
                            background: `color-mix(in srgb, var(--surface, #111111) 95%, transparent)`,
                            border: `1px solid color-mix(in srgb, var(--text, #fafafa) 10%, transparent)`,
                            color: NAV_SURFACE_TEXT,
                        }}
                    >
                        {link.children!.map((child, ci) => (
                            <a
                                key={ci}
                                href={child.url}
                                className="block rounded-lg px-3 py-2 text-sm font-medium opacity-70 hover:opacity-100 hover:bg-white/[0.06] transition-all"
                            >
                                {child.label}
                            </a>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function MobileNavItem({
    link,
    onNavigate,
    depth = 0,
}: {
    link: NavLink
    onNavigate: () => void
    depth?: number
}) {
    const hasChildren = Boolean(link.children?.length)

    return (
        <div>
            <a
                href={link?.url}
                className={`rounded-lg px-4 ${depth === 0 ? `py-3 text-sm font-medium opacity-70 hover:opacity-100 hover:bg-white/[0.06] ${TOUCH_TARGET.min} flex items-center gap-1` : 'py-2 text-sm opacity-50 hover:opacity-90 hover:bg-white/[0.04] flex items-center gap-1'} transition-all duration-200`}
                onClick={onNavigate}
            >
                {link.label}
                {link._hiddenFromVisitor && <EyeOff size={11} className="text-amber-400 shrink-0" aria-label="Hidden from visitors" />}
            </a>
            {hasChildren && (
                <div className="ml-4 flex flex-col gap-0.5">
                    {link.children!.map((child, index) => (
                        <MobileNavItem
                            key={`${child.label}-${index}`}
                            link={child}
                            onNavigate={onNavigate}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function SidebarNavItem({
    link,
    onNavigate,
    depth = 0,
}: {
    link: NavLink
    onNavigate: () => void
    depth?: number
}) {
    const hasChildren = Boolean(link.children?.length)

    return (
        <div>
            <a
                href={link?.url}
                className={`rounded-lg px-4 ${depth === 0 ? 'py-3 text-sm font-medium opacity-70 hover:opacity-100 hover:bg-white/[0.06] flex items-center gap-1' : 'py-2 text-sm opacity-50 hover:opacity-90 hover:bg-white/[0.04] flex items-center gap-1'} transition-all duration-200`}
                onClick={onNavigate}
            >
                {link.label}
                {link._hiddenFromVisitor && <EyeOff size={11} className="text-amber-400 shrink-0" aria-label="Hidden from visitors" />}
            </a>
            {hasChildren && (
                <div className="ml-4 border-l border-white/10 pl-2">
                    {link.children!.map((child, index) => (
                        <SidebarNavItem
                            key={`${child.label}-${index}`}
                            link={child}
                            onNavigate={onNavigate}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Shared Nav Helpers (Phase 05 refactor) ──────────────────────────────────
// Extract repeated CTA / hamburger / mobile drawer blocks. Brand identity vars
// unchanged per Option C. Drawer renders each link via MobileNavItem so nested
// children work automatically across all variants.

const NAV_CTA_OVERLAY_OPACITY = 0.8
const NAV_CTA_SHADOW_OPACITY = 0.188

const CTA_GRADIENT_BACKGROUND = `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), ${NAV_CTA_OVERLAY_OPACITY}))`

const CTA_GRADIENT_STYLE: CSSProperties = {
    background: CTA_GRADIENT_BACKGROUND,
    boxShadow: `0 4px 15px rgba(var(--brand-primary-rgb), ${NAV_CTA_SHADOW_OPACITY})`,
}

type NavCTAButtonProps = {
    href?: string
    label: string
    className?: string
    onClick?: () => void
}

/** Desktop CTA button — gradient bg + min-h 44px (WCAG 2.5.5). */
function NavCTAButton({
    href = '#',
    label,
    className = 'hidden sm:inline-flex px-5 py-2.5',
    onClick,
}: NavCTAButtonProps) {
    const cls = `${className} rounded-lg text-sm font-semibold text-white text-center transition-all duration-200 ${TOUCH_TARGET.min} items-center justify-center`.trim()
    return (
        <motion.a
            href={href}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className={cls}
            style={CTA_GRADIENT_STYLE}
            onClick={onClick}
        >
            {label}
        </motion.a>
    )
}

/** Mobile drawer CTA — full-width, centered, min-h 44px. */
function NavMobileCTAButton({ href = '#', label, onClick }: { href?: string; label: string; onClick?: () => void }) {
    return (
        <a
            href={href}
            className={`mt-2 px-4 py-3 rounded-lg text-sm font-semibold text-white text-center transition-all duration-200 ${TOUCH_TARGET.min} flex items-center justify-center`}
            style={{ background: CTA_GRADIENT_BACKGROUND }}
            onClick={onClick}
        >
            {label}
        </a>
    )
}

type NavHamburgerProps = {
    open: boolean
    onClick: () => void
    className?: string
    style?: CSSProperties
}

/** Mobile hamburger button — min 44px touch target (was p-2 ≈ 36px ❌). */
function NavHamburgerButton({ open, onClick, className = '', style }: NavHamburgerProps) {
    return (
        <button
            type="button"
            className={`md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center ${className}`.trim()}
            onClick={onClick}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            style={style}
        >
            {open ? <X size={20} /> : <Menu size={20} />}
        </button>
    )
}

type NavMobileDrawerProps = {
    open: boolean
    onClose: () => void
    links: NavLink[]
    ctaButton?: { show: boolean; label: string; url: string }
    background?: string
    children?: ReactNode
}

/**
 * Mobile menu drawer used by simple/transparent/centered/mega-menu variants.
 * Sidebar + pill have their own drawer designs and don't use this helper.
 * Each link is rendered via MobileNavItem so nested children are walked recursively.
 */
function NavMobileMenuDrawer({
    open,
    onClose,
    links,
    ctaButton,
    background = NAV_SURFACE_BG_SOLID,
}: NavMobileDrawerProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="md:hidden overflow-hidden"
                    style={{
                        background,
                        color: NAV_SURFACE_TEXT,
                        borderTop: NAV_SURFACE_BORDER,
                    }}
                >
                    <div className={`${NAV_CONTAINER} py-4 flex flex-col gap-1`}>
                        {links.map((link, i) => (
                            <MobileNavItem key={i} link={link} onNavigate={onClose} />
                        ))}
                        {ctaButton?.show && (
                            <NavMobileCTAButton href={ctaButton.url || '#'} label={ctaButton.label} onClick={onClose} />
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────

// Dual-read: accept old DB variant names → normalize to new canonical names.
// Permanent alias layer — safe to pass unknown strings (falls through to 'default').
const VARIANT_ALIASES: Record<string, NavigationConfig['variant']> = {
    simple: 'default',
    'mega-menu': 'mega',
    pill: 'floating',
}

export function NavigationBlock({ block, theme, site }: BlockProps<NavigationConfig>) {
    const mergedBlock = mergeNavigationBrandingWithSite(block, site)
    const { logoText, links = [], ctaButton, variant: rawVariant = 'default' } = mergedBlock
    const variant = VARIANT_ALIASES[rawVariant as string] ?? rawVariant
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const scrolled = useScrollShrink(50)

    // ── Transparent variant ───────────────────────────────────────────────
    if (variant === 'transparent') {
        return <TransparentNav mergedBlock={mergedBlock} logoText={logoText} links={links} ctaButton={ctaButton} />
    }

    // ── Sidebar variant ───────────────────────────────────────────────────
    if (variant === 'sidebar') {
        return <SidebarNav mergedBlock={mergedBlock} logoText={logoText} links={links} ctaButton={ctaButton} />
    }

    // ── Floating (pill) variant ───────────────────────────────────────────
    if (variant === 'floating') {
        return <PillNav mergedBlock={mergedBlock} logoText={logoText} links={links} ctaButton={ctaButton} />
    }

    // ── Centered variant ────────────────────────────────────────────────
    if (variant === 'centered') {
        return <CenteredNav mergedBlock={mergedBlock} logoText={logoText} links={links} ctaButton={ctaButton} />
    }

    // ── Mega variant ─────────────────────────────────────────────────────
    if (variant === 'mega') {
        return <MegaMenuNav mergedBlock={mergedBlock} logoText={logoText} links={links} ctaButton={ctaButton} />
    }

    // ── Default: 'default' (was 'simple') ────────────────────────────────
    return (
        <motion.nav
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            aria-label={mergedBlock.ariaLabel || 'Main navigation'}
            className={`sticky top-0 ${NAV_Z_CLASS.base} transition-[height,box-shadow] duration-300`}
            style={{
                borderBottom: NAV_SURFACE_BORDER,
                background: NAV_SURFACE_BG,
                // Plan 260415 nav fix: text color reads the site's resolved
                // --text CSS var so the nav adapts to both light and dark
                // themes. DropdownLink's `opacity-60` renders as 60% of that
                // color (was locked to white on near-black before).
                color: NAV_SURFACE_TEXT,
                backdropFilter: 'blur(20px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
            }}
        >
            <div className={`${NAV_CONTAINER} ${scrolled ? 'h-14' : 'h-16'} flex items-center justify-between transition-[height] duration-300`}>
                {/* Logo */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`font-bold ${scrolled ? 'text-lg' : 'text-xl'} font-heading flex items-center gap-2 transition-[font-size] duration-300`}
                >
                    <NavLogo logo={mergedBlock.logo} logoText={logoText} />
                </motion.div>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-1">
                    {links.map((link, i) => (
                        <DropdownLink key={i} link={link} i={i} />
                    ))}
                </div>

                {/* Desktop CTA + Mobile Menu Button */}
                <div className="flex items-center gap-3">
                    {ctaButton?.show && (
                        <NavCTAButton
                            href={ctaButton.url || '#'}
                            label={ctaButton.label}
                            className="hidden sm:inline-flex px-4 py-2 sm:px-5 sm:py-2.5"
                        />
                    )}
                    <NavHamburgerButton
                        open={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    />
                </div>
            </div>

            <NavMobileMenuDrawer
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                links={links}
                ctaButton={ctaButton}
            />
        </motion.nav>
    )
}

// ── Transparent Nav ──────────────────────────────────────────────────────────

function TransparentNav({ mergedBlock, logoText, links, ctaButton }: {
    mergedBlock: NavigationConfig & { logo?: { url: string; alt?: string } }
    logoText?: string
    links: NavLink[]
    ctaButton?: { show: boolean; label: string; url: string }
}) {
    const scrolled = useScrollShrink(100)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <motion.nav
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            aria-label={mergedBlock.ariaLabel || 'Main navigation'}
            className={`fixed top-0 left-0 right-0 ${NAV_Z_CLASS.base} transition-all duration-300`}
            style={{
                // Plan 260415 — TransparentNav giờ LUÔN có nền mờ nhẹ (25%
                // khi chưa scroll, 95% khi scroll) + text theo `--text` CSS var,
                // không dùng text trắng cứng nữa. Lý do: site light-theme (beauty,
                // fnb, wellness) có hero sáng, text trắng trên hero sáng =
                // invisible (bug gốc làm nav "biến mất" trên staging 2026-04-15).
                background: scrolled
                    ? `color-mix(in srgb, var(--background, #ffffff) 95%, transparent)`
                    : `color-mix(in srgb, var(--background, #ffffff) 25%, transparent)`,
                backdropFilter: scrolled ? 'blur(20px)' : 'blur(8px)',
                WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'blur(8px)',
                borderBottom: scrolled
                    ? NAV_SURFACE_BORDER
                    : '1px solid transparent',
                color: NAV_SURFACE_TEXT,
            }}
        >
            <div className={`${NAV_CONTAINER} h-16 flex items-center justify-between`}>
                {/* Logo */}
                <motion.div whileHover={{ scale: 1.02 }} className="font-bold text-xl font-heading">
                    <NavLogo
                        logo={mergedBlock.logo}
                        logoText={logoText}
                        gradientMode="when-scrolled"
                        scrolled={scrolled}
                    />
                </motion.div>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                    {links.map((link, i) => (
                        <DropdownLink key={i} link={link} i={i} />
                    ))}
                </div>

                {/* CTA + Mobile */}
                <div className="flex items-center gap-3">
                    {ctaButton?.show && (
                        <NavCTAButton href={ctaButton.url || '#'} label={ctaButton.label} />
                    )}
                    <NavHamburgerButton
                        open={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{ color: 'inherit' }}
                    />
                </div>
            </div>

            <NavMobileMenuDrawer
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                links={links}
                ctaButton={ctaButton}
            />
        </motion.nav>
    )
}

// ── Sidebar Nav ──────────────────────────────────────────────────────────────

function SidebarNav({ mergedBlock, logoText, links, ctaButton }: {
    mergedBlock: NavigationConfig & { logo?: { url: string; alt?: string } }
    logoText?: string
    links: NavLink[]
    ctaButton?: { show: boolean; label: string; url: string }
}) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* Hamburger trigger — always visible */}
            <button
                type="button"
                className={`fixed top-4 left-4 ${NAV_Z_CLASS.base} p-2.5 rounded-xl transition-all duration-200 ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center`}
                onClick={() => setIsOpen(true)}
                aria-label="Open navigation"
                style={{
                    background: NAV_SURFACE_BG,
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: NAV_SURFACE_BORDER,
                    color: NAV_SURFACE_TEXT,
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
                            className={`fixed inset-0 bg-black/50 ${NAV_Z_CLASS.mobileBackdrop}`}
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className={`fixed top-0 left-0 bottom-0 w-72 ${NAV_Z_CLASS.mobileSidebar} flex flex-col`}
                            style={{
                                background: NAV_SURFACE_BG_SOLID,
                                borderRight: NAV_SURFACE_BORDER,
                                color: NAV_SURFACE_TEXT,
                            }}
                        >
                            {/* Close + Logo */}
                            <div className="flex items-center justify-between p-6">
                                <div className="font-bold text-xl font-heading">
                                    <NavLogo logo={mergedBlock.logo} logoText={logoText} />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center`}
                                    aria-label="Close navigation"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Links */}
                            <nav className="flex-1 px-4 space-y-1">
                                {links.map((link, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                    >
                                        <SidebarNavItem link={link} onNavigate={() => setIsOpen(false)} />
                                    </motion.div>
                                ))}
                            </nav>

                            {/* CTA at bottom */}
                            {ctaButton?.show && (
                                <div className="p-6">
                                    <a
                                        href={ctaButton.url || '#'}
                                        className={`block w-full px-4 py-3 rounded-lg text-sm font-semibold text-white text-center transition-all duration-200 ${TOUCH_TARGET.min} flex items-center justify-center`}
                                        style={CTA_GRADIENT_STYLE}
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

// ── Centered Nav ────────────────────────────────────────────────────────────

function CenteredNav({ mergedBlock, logoText, links, ctaButton }: {
    mergedBlock: NavigationConfig & { logo?: { url: string; alt?: string } }
    logoText?: string
    links: NavLink[]
    ctaButton?: { show: boolean; label: string; url: string }
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const scrolled = useScrollShrink(50)
    const midpoint = Math.ceil(links.length / 2)
    const leftLinks = links.slice(0, midpoint)
    const rightLinks = links.slice(midpoint)

    return (
        <motion.nav
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            aria-label={mergedBlock.ariaLabel || 'Main navigation'}
            className={`sticky top-0 ${NAV_Z_CLASS.base} transition-[height,box-shadow] duration-300`}
            style={{
                borderBottom: NAV_SURFACE_BORDER,
                background: NAV_SURFACE_BG,
                // Plan 260415 nav fix: theme-adaptive text for DropdownLink children.
                color: NAV_SURFACE_TEXT,
                backdropFilter: 'blur(20px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
            }}
        >
            <div className={`${NAV_CONTAINER} ${scrolled ? 'h-14' : 'h-16'} transition-[height] duration-300`}>
                {/* Desktop: 3-column grid layout */}
                <div className="hidden md:grid grid-cols-3 items-center h-full">
                    {/* Left links */}
                    <div className="flex items-center gap-1 justify-start">
                        {leftLinks.map((link, i) => (
                            <DropdownLink key={i} link={link} i={i} />
                        ))}
                    </div>

                    {/* Center logo */}
                    <div className="flex justify-center">
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="font-bold text-xl font-heading flex items-center gap-2"
                        >
                            <NavLogo logo={mergedBlock.logo} logoText={logoText} />
                        </motion.div>
                    </div>

                    {/* Right links + CTA */}
                    <div className="flex items-center gap-1 justify-end">
                        {rightLinks.map((link, i) => (
                            <DropdownLink key={i} link={link} i={i} />
                        ))}
                        {ctaButton?.show && (
                            <NavCTAButton
                                href={ctaButton.url || '#'}
                                label={ctaButton.label}
                                className="ml-2 inline-flex px-5 py-2.5"
                            />
                        )}
                    </div>
                </div>

                {/* Mobile: logo left, hamburger right */}
                <div className="flex md:hidden items-center justify-between h-full">
                    <motion.div whileHover={{ scale: 1.02 }} className="font-bold text-xl font-heading">
                        <NavLogo logo={mergedBlock.logo} logoText={logoText} />
                    </motion.div>
                    <NavHamburgerButton
                        open={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    />
                </div>
            </div>

            <NavMobileMenuDrawer
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                links={links}
                ctaButton={ctaButton}
            />
        </motion.nav>
    )
}

// ── Mega Menu Nav ───────────────────────────────────────────────────────────

function MegaMenuNav({ mergedBlock, logoText, links, ctaButton }: {
    mergedBlock: NavigationConfig & { logo?: { url: string; alt?: string } }
    logoText?: string
    links: NavLink[]
    ctaButton?: { show: boolean; label: string; url: string }
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const scrolled = useScrollShrink(50)

    const getSubLinks = (link?: NavLink) => {
        const children = link?.children ?? []
        const cols: NavLink[][] = [[], [], []]

        children.forEach((child, index) => {
            cols[index % 3].push(child)
        })

        return cols.filter(column => column.length > 0)
    }

    return (
        <motion.nav
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            aria-label={mergedBlock.ariaLabel || 'Main navigation'}
            className={`sticky top-0 ${NAV_Z_CLASS.base} transition-[height,box-shadow] duration-300`}
            style={{
                borderBottom: NAV_SURFACE_BORDER,
                background: NAV_SURFACE_BG,
                // Plan 260415 nav fix: theme-adaptive text for DropdownLink children.
                color: NAV_SURFACE_TEXT,
                backdropFilter: 'blur(20px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
            }}
            onMouseLeave={() => setHoveredIndex(null)}
        >
            <div className={`${NAV_CONTAINER} ${scrolled ? 'h-14' : 'h-16'} flex items-center justify-between transition-[height] duration-300`}>
                {/* Logo */}
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="font-bold text-xl font-heading flex items-center gap-2"
                >
                    <NavLogo logo={mergedBlock.logo} logoText={logoText} />
                </motion.div>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-1">
                    {links.map((link, i) => (
                        link.children?.length ? (
                            <div
                                key={i}
                                className="relative"
                                onMouseEnter={() => setHoveredIndex(i)}
                            >
                                <button
                                    type="button"
                                    className="relative px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-white/[0.04] flex items-center gap-1"
                                >
                                    {link.label}
                                    <svg className="w-3 h-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <motion.a
                                key={i}
                                href={link?.url}
                                whileHover={{ y: -1 }}
                                className="relative px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-white/[0.04]"
                            >
                                {link.label}
                            </motion.a>
                        )
                    ))}
                </div>

                {/* Desktop CTA + Mobile Menu Button */}
                <div className="flex items-center gap-3">
                    {ctaButton?.show && (
                        <NavCTAButton href={ctaButton.url || '#'} label={ctaButton.label} />
                    )}
                    <NavHamburgerButton
                        open={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    />
                </div>
            </div>

            {/* Mega Menu Dropdown Panel */}
            <AnimatePresence>
                {hoveredIndex !== null && links[hoveredIndex]?.children?.length ? (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className={`hidden md:block absolute left-0 right-0 ${NAV_Z_CLASS.dropdown}`}
                        style={{
                            background: NAV_SURFACE_BG_SOLID,
                            borderBottom: NAV_SURFACE_BORDER,
                            color: NAV_SURFACE_TEXT,
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                        }}
                        onMouseEnter={() => {/* keep open */}}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <div className={`${NAV_CONTAINER} py-8`}>
                            <Caption
                                className="block font-semibold uppercase tracking-widest opacity-40 mb-5"
                                style={{ color: 'var(--brand-primary)' }}
                            >
                                {links[hoveredIndex]?.label}
                            </Caption>
                            <div className={`grid gap-8 ${getSubLinks(links[hoveredIndex]).length > 1 ? 'grid-cols-3' : 'grid-cols-1'}`}>
                                {getSubLinks(links[hoveredIndex]).map((col, ci) => (
                                    <div key={ci} className="flex flex-col gap-2">
                                        {col.map((subLink, si) => (
                                            <a
                                                key={si}
                                                href={subLink?.url}
                                                className="block px-3 py-2.5 rounded-lg text-sm opacity-60 hover:opacity-100 hover:bg-white/[0.04] transition-all duration-200"
                                            >
                                                {subLink.label}
                                            </a>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <NavMobileMenuDrawer
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                links={links}
                ctaButton={ctaButton}
            />
        </motion.nav>
    )
}

// ── Pill Nav ─────────────────────────────────────────────────────────────────

function PillNav({ mergedBlock, logoText, links, ctaButton }: {
    mergedBlock: NavigationConfig & { logo?: { url: string; alt?: string } }
    logoText?: string
    links: NavLink[]
    ctaButton?: { show: boolean; label: string; url: string }
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <motion.nav
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed top-4 left-4 ${NAV_Z_CLASS.base} w-[calc(100%-2rem)] max-w-3xl`}
        >
            <div
                className="rounded-full px-6 py-3 flex items-center justify-between min-h-[56px]"
                style={{
                    // Plan 260415 — pill variant was hardcoded white which
                    // flipped against dark-theme sites. Read --background so
                    // light sites get a white pill, dark sites get a dark pill.
                    // 96% opacity (was 90%) improves visibility on mobile where
                    // only logo + hamburger remain — prevents pill blending into hero.
                    background: `color-mix(in srgb, var(--background, #ffffff) 96%, transparent)`,
                    color: NAV_SURFACE_TEXT,
                    backdropFilter: 'blur(20px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
                    border: NAV_SURFACE_BORDER,
                }}
            >
                {/* Logo */}
                <div className="font-bold text-lg font-heading">
                    <NavLogo logo={mergedBlock.logo} logoText={logoText} className="h-6 w-auto" />
                </div>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-0.5">
                    {links.map((link, i) => (
                        <DropdownLink key={i} link={link} i={i} />
                    ))}
                </div>

                {/* CTA + Mobile */}
                <div className="flex items-center gap-2">
                    {ctaButton?.show && (
                        <a
                            href={ctaButton.url || '#'}
                            className={`hidden sm:inline-flex px-4 py-1.5 rounded-full text-sm font-semibold text-white text-center transition-all duration-200 ${TOUCH_TARGET.min} items-center justify-center`}
                            style={{ background: CTA_GRADIENT_BACKGROUND }}
                        >
                            {ctaButton.label}
                        </a>
                    )}
                    <button
                        type="button"
                        className={`md:hidden p-1.5 rounded-full opacity-90 hover:opacity-100 transition-opacity ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center`}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                        style={{ color: 'inherit' }}
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
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
                            background: `color-mix(in srgb, var(--background, #ffffff) 95%, transparent)`,
                            color: NAV_SURFACE_TEXT,
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                            border: NAV_SURFACE_BORDER,
                        }}
                    >
                        <div className="p-3 flex flex-col gap-0.5">
                            {links.map((link, i) => (
                                <MobileNavItem key={i} link={link} onNavigate={() => setMobileMenuOpen(false)} />
                            ))}
                            {ctaButton?.show && (
                                <a
                                    href={ctaButton.url || '#'}
                                    className={`mt-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white text-center ${TOUCH_TARGET.min} flex items-center justify-center`}
                                    style={{ background: CTA_GRADIENT_BACKGROUND }}
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
