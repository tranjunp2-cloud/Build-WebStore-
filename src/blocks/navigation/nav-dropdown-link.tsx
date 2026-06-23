'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EyeOff } from 'lucide-react'
import type { NavLink } from './config'
import { NAV_Z_CLASS } from '@/lib/design-tokens'
import { useLocalHref } from '@/lib/hooks/use-local-href'

const NAV_SURFACE_TEXT = `var(--text, #fafafa)`

/** Shared class for child links inside any nav dropdown (DropdownLink children, MoreDropdownItem sub-flyout). */
export const DROPDOWN_CHILD_LINK_CLASS =
    'block rounded-lg px-3 py-2 text-sm font-medium opacity-70 hover:opacity-100 hover:bg-white/[0.1] transition-all'

/** Desktop nav link — renders a plain anchor or a hover-dropdown button when children exist. */
export function DropdownLink({ link, i }: { link: NavLink; i: number }) {
    const [open, setOpen] = useState(false)
    const resolveHref = useLocalHref()
    const hasChildren = link.children && link.children.length > 0

    if (!hasChildren) {
        return (
            <motion.a
                key={i}
                href={resolveHref(link?.url)}
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
            className="relative shrink-0"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                type="button"
                className="relative px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-white/[0.04] inline-flex items-center gap-1"
            >
                {link.label}
                <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className={`absolute left-0 top-full ${NAV_Z_CLASS.dropdown} mt-1 min-w-[180px] rounded-xl p-1.5 shadow-xl backdrop-blur-lg`}
                        style={{
                            background: `color-mix(in srgb, var(--background, #09090b) 97%, transparent)`,
                            border: `1px solid rgba(var(--brand-primary-rgb), 0.12)`,
                            color: NAV_SURFACE_TEXT,
                        }}
                    >
                        {link.children!.map((child, ci) => (
                            <a key={ci} href={resolveHref(child.url)} className={DROPDOWN_CHILD_LINK_CLASS}>
                                {child.label}
                            </a>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
