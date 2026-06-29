'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff } from 'lucide-react'
import type { NavLink } from './config'
import { useNavOverflow } from './use-nav-overflow'
import { DropdownLink, DROPDOWN_CHILD_LINK_CLASS } from './nav-dropdown-link'
import { useI18n } from '@/i18n'
import { NAV_Z_CLASS } from '@/lib/design-tokens'
import { useLocalHref } from '@/lib/hooks/use-local-href'
import { SmartLink } from '@/blocks/_shared/smart-link'

// Re-declared inline to avoid coupling to index.tsx internals
const NAV_SURFACE_BG_SOLID = `color-mix(in srgb, var(--background, #09090b) 97%, transparent)`
const NAV_SURFACE_BORDER = `1px solid rgba(var(--brand-primary-rgb), 0.12)`

// Width-affecting classes mirrored on hidden measurement spans.
const LINK_CLASS =
    'relative px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-white/[0.04] inline-flex items-center gap-1 whitespace-nowrap'

/** Single item inside MoreDropdown — plain link or click-to-expand accordion when children exist. */
function MoreDropdownItem({ link, isOpen = false, onToggle = () => {} }: { link: NavLink; isOpen?: boolean; onToggle?: () => void }) {
    const resolveHref = useLocalHref()
    const hasChildren = link.children && link.children.length > 0
    // Stable panel id for aria-controls — derived from label, safe for nav labels
    const panelId = `more-sub-${link.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

    if (!hasChildren) {
        return (
            <SmartLink
                href={resolveHref(link.url)}
                title={link.label}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg opacity-70 hover:opacity-100 hover:bg-white/[0.1] transition-all"
            >
                <span className="truncate">{link.label}</span>
                {link._hiddenFromVisitor && (
                    <EyeOff size={11} className="text-amber-400 shrink-0" aria-label="Hidden from visitors" />
                )}
            </SmartLink>
        )
    }

    return (
        <div className="relative">
            <button
                type="button"
                title={link.label}
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg opacity-70 hover:opacity-100 hover:bg-white/[0.1] transition-all"
            >
                <span className="truncate">{link.label}</span>
                <svg
                    aria-hidden="true"
                    className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {link._hiddenFromVisitor && (
                    <EyeOff size={11} className="text-amber-400 shrink-0" aria-label="Hidden from visitors" />
                )}
            </button>
            {/* overflow-hidden required so height:0 clips children during collapse */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={panelId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden ml-3 pl-2 border-l border-white/10"
                    >
                        {link.children!.map((child, ci) => (
                            <SmartLink key={ci} href={resolveHref(child.url)} className={DROPDOWN_CHILD_LINK_CLASS}>
                                {child.label}
                            </SmartLink>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/** Dropdown shown for nav links that overflow the container width. */
export function MoreDropdown({ links }: { links: NavLink[] }) {
    const [open, setOpen] = useState(false)
    const [openIndex, setOpenIndex] = useState<number | null>(null)
    const { t } = useI18n()

    return (
        <div
            className="relative shrink-0"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => { setOpen(false); setOpenIndex(null) }}
        >
            <button type="button" className={LINK_CLASS}>
                {t.storefront.nav.overflowMore}
                <svg
                    className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute right-0 top-full ${NAV_Z_CLASS.dropdown} mt-1 min-w-[180px] max-w-[260px] rounded-xl p-1.5 shadow-xl backdrop-blur-lg`}
                        style={{ background: NAV_SURFACE_BG_SOLID, border: NAV_SURFACE_BORDER }}
                    >
                        {links.map((link, i) => (
                            <MoreDropdownItem
                                key={i}
                                link={link}
                                isOpen={openIndex === i}
                                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

type NavDesktopLinksProps = {
    links: NavLink[]
    /** Extra Tailwind classes for the container (e.g. "hidden md:flex", "gap-0.5") */
    className?: string
    /** Pixels to subtract from measured width before computing overflow.
     *  Use to reserve space for absolutely-positioned siblings inside the same flex row. */
    budgetOffset?: number
}

/**
 * Renders desktop nav links with automatic overflow handling.
 * Links that don't fit collapse into a "More ▼" dropdown.
 * Attaches a ResizeObserver so it adjusts when the container resizes.
 *
 * A hidden measurement layer always renders all links so that itemRefs
 * are always populated — this lets measure() expand visibleCount when a
 * previously-overflow link's label is shortened and it now fits.
 */
export function NavDesktopLinks({ links, className, budgetOffset = 0 }: NavDesktopLinksProps) {
    const { containerRef, itemRefs, visibleCount } = useNavOverflow(links, budgetOffset)
    const visibleLinks = links.slice(0, visibleCount)
    const overflowLinks = links.slice(visibleCount)

    return (
        <div
            ref={containerRef}
            className={`flex items-center min-w-0 ${className ?? ''}`}
        >
            {/* Hidden measurement layer — always renders all links so itemRefs
                are never null and measure() can correctly expand visibleCount.
                Includes the chevron for links-with-children to match their real width.
                Inline-styled absolute off-screen (not Tailwind fixed) so CSS transforms
                on ancestor containers (e.g. editor preview frame) don't affect placement. */}
            <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: -9999, opacity: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                {links.map((link, i) => (
                    <span key={i} ref={(el) => { itemRefs[i] = el as HTMLElement | null }} className={`shrink-0 ${LINK_CLASS}`}>
                        {link.label}
                        {link.children?.length ? (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        ) : null}
                        {link._hiddenFromVisitor && <EyeOff size={11} />}
                    </span>
                ))}
            </div>

            {visibleLinks.map((link, i) => (
                <DropdownLink key={i} link={link} i={i} />
            ))}
            {overflowLinks.length > 0 && <MoreDropdown links={overflowLinks} />}
        </div>
    )
}
