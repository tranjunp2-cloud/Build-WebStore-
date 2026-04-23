'use client'

import { usePathname } from 'next/navigation'
import type { BlockProps } from '../types'
import type { BreadcrumbConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { CONTAINER, INNER_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

function safeDecodeSegment(seg: string): string {
    try { return decodeURIComponent(seg) } catch { return seg }
}

const HOMEPAGE_SLUGS = new Set(['/', '', 'home', 'index'])

function useAutoBreadcrumb(homeLabel: string, pageSlug?: string, homeUrl?: string): { label: string; url?: string }[] {
    const pathname = usePathname()
    // Use provided page slug (correct in editor preview) or real pathname (live site)
    // Guard null: Payload may store slug as null even though TS types it as string
    const rawSlug = (pageSlug !== undefined && pageSlug !== null) ? pageSlug : pathname
    const normSlug = rawSlug.startsWith('/') ? rawSlug : `/${rawSlug}`
    const segments = HOMEPAGE_SLUGS.has(rawSlug.replace(/^\//, ''))
        ? []
        : normSlug.split('/').filter(Boolean)
    const items: { label: string; url?: string }[] = [{ label: homeLabel, url: homeUrl ?? '/' }]
    let accumulated = ''
    for (const seg of segments) {
        accumulated += '/' + seg
        items.push({ label: capitalize(safeDecodeSegment(seg)), url: accumulated })
    }
    return items
}

export function BreadcrumbBlock({ block }: BlockProps<BreadcrumbConfig>) {
    const {
        items = [],
        variant = 'simple',
        homeLabel = 'Home',
        separator = '/',
        showIcon = variant === 'with-icon',
        showOnAllPages = true,
    } = block

    const pageSlug = (block as Record<string, unknown>)._pageSlug as string | undefined
    const homeUrl = (block as Record<string, unknown>)._homeUrl as string | undefined
    const autoItems = useAutoBreadcrumb(homeLabel, pageSlug, homeUrl)
    // legacy: if items[] populated use them, otherwise auto-generate
    const breadcrumbs = items.length > 0 ? items : autoItems

    // hide on homepage (only 1 item = just "Home")
    if (breadcrumbs.length <= 1) return null

    return (
        <AnimatedSection className="py-1.5">
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                <nav aria-label="Breadcrumb">
                    <ol className="flex items-center flex-wrap gap-1 text-sm">
                        {breadcrumbs.map((item, i) => {
                            const isLast = i === breadcrumbs.length - 1
                            return (
                                <li key={i} className="flex items-center gap-1">
                                    {i > 0 && (
                                        <span className="opacity-40 mx-1">
                                            {separator}
                                        </span>
                                    )}
                                    {showIcon && i === 0 && (
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
                                            href={item.url}
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
