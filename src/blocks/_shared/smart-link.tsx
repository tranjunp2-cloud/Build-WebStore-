'use client'

import Link from 'next/link'
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { isInEditorEditMode } from '@/lib/storefront/editor-intercept'

/**
 * True when a (already-resolved) href points at an internal Next.js route that
 * the App Router can soft-navigate to.
 *
 * Internal  → single-leading-slash paths (`/sites/foo`, `/about`, `/preview/x`).
 * External  → http(s):, protocol-relative `//`, `mailto:`/`tel:`/`sms:`/`whatsapp:`,
 *             in-page `#` anchors, broken-url markers (`_broken_url_:`), relatives.
 *
 * Note: expects the href AFTER `useLocalHref()` resolution, which already
 * prefixes internal paths with `/sites/{slug}` and passes external/special
 * links through unchanged.
 */
export function isInternalHref(href: string | undefined): boolean {
    if (!href) return false
    if (!href.startsWith('/')) return false // http(s):, mailto:, tel:, #, relative, _broken_url_:
    if (href.startsWith('//')) return false // protocol-relative external
    return true
}

export type SmartLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
    href?: string
}

/**
 * Drop-in replacement for `<a>` in storefront blocks.
 *
 * Renders `next/link` `<Link>` for internal routes → client-side soft
 * navigation (no full HTML reload). Falls back to a plain `<a>` for external /
 * special links and for any link opening a new tab (`target` ≠ `_self`).
 *
 * Either branch emits a real `<a href>` in the DOM, so:
 *   - SEO: crawlers see the same anchor + href (link equity preserved).
 *   - Editor: the preview click interceptor (`target.closest('a')`) still fires.
 */
export const SmartLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
    function SmartLink({ href, target, onClick, ...rest }, ref) {
        // New-tab / non-self targets must stay hard anchors (Link soft-nav
        // would defeat opening a fresh document).
        const forceAnchor = Boolean(target && target !== '_self')

        // Inside the EDITOR edit canvas (?editor=1), clicking a block must select it,
        // not navigate the preview away. Next's <Link> fires its router.push from
        // React's delegated handler before the editor's native interceptor can absorb
        // the click, so suppress navigation here. The builder RESULT preview (?builder=1)
        // is exempt — there the user must be able to click links to explore the generated
        // site. Checked at click-time (not render) to avoid any SSR/hydration mismatch.
        const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
            if (isInEditorEditMode()) e.preventDefault()
            onClick?.(e)
        }

        if (!href || forceAnchor || !isInternalHref(href)) {
            return <a ref={ref} href={href} target={target} onClick={handleClick} {...rest} />
        }

        return <Link ref={ref} href={href} onClick={handleClick} {...rest} />
    },
)
