import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import { buildSlugCanonicalMap, resolveInternalUrlPath, rewriteLiveUrl } from '@/lib/navigation-url'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { GoogleFontsLoader } from './GoogleFontsLoader'
import { OwnerProvider } from './OwnerContext'
import type { NavPage, SiteRendererProps } from './SiteRenderer'

// Mirrors NavigationBlock's VARIANT_ALIASES (navigation/index.tsx) — keep in sync when adding new aliases.
// Maps legacy DB variant names → canonical names used in FIXED_NAV_SPACER.
const NAV_VARIANT_ALIASES: Record<string, string> = { simple: 'default', 'mega-menu': 'mega', pill: 'floating' }

// Heights for nav variants that use position:fixed (out of document flow).
// Sticky variants (default, centered, mega) occupy flow naturally — omit them here.
const FIXED_NAV_SPACER: Record<string, string> = {
    transparent: '4rem',            // fixed top-0 + h-16 (4rem); rem mirrors Tailwind unit
    floating: 'calc(1rem + 64px)',  // fixed top-4 (1rem) + min-h-[56px] (56px) + 8px buffer
}

type SiteLayoutShellProps = {
    site: SiteRendererProps['site']
    pages?: NavPage[]
    isOwner?: boolean
    children: React.ReactNode
}

/** Rewrite all `url` fields in nav links array recursively; filter hidden/deleted page slugs for visitors. */
function rewriteNavLinks(
    links: unknown,
    rewriteUrl: (u: string | undefined) => string,
    hiddenSlugs: Set<string>,
    slugCanonical: Map<string, string>,
): unknown {
    if (!Array.isArray(links)) return links
    return links
        .filter((l) => {
            if (!hiddenSlugs.size || !l || typeof l !== 'object') return true
            const link = l as { url?: string }
            const resolvedPath = resolveInternalUrlPath(link.url, slugCanonical)
            return !resolvedPath || !hiddenSlugs.has(resolvedPath)
        })
        .map((l) => {
            if (!l || typeof l !== 'object') return l
            const link = l as { url?: string; children?: unknown; [k: string]: unknown }
            return {
                ...link,
                url: rewriteUrl(link.url),
                children: link.children ? rewriteNavLinks(link.children, rewriteUrl, hiddenSlugs, slugCanonical) : undefined,
            }
        })
}

/** Rewrite `url` fields in footer column links; filter links pointing to hidden/deleted/draft pages. */
function rewriteFooterColumns(
    columns: unknown,
    rewriteUrl: (u: string | undefined) => string,
    hiddenSlugs: Set<string>,
    slugCanonical: Map<string, string>,
): unknown {
    if (!Array.isArray(columns)) return columns
    return columns.map((col) => {
        if (!col || typeof col !== 'object') return col
        const c = col as { links?: Array<{ url?: string; [k: string]: unknown }>; [k: string]: unknown }
        return {
            ...c,
            links: Array.isArray(c.links)
                ? c.links
                    .filter((l) => {
                        if (!hiddenSlugs.size || !l?.url) return true
                        const resolvedPath = resolveInternalUrlPath(l.url, slugCanonical)
                        return !resolvedPath || !hiddenSlugs.has(resolvedPath)
                    })
                    .map((l) => ({ ...l, url: rewriteUrl(l?.url) }))
                : c.links,
        }
    })
}

/**
 * Site layout wrapper: applies theme CSS, renders site header block + children + site footer block.
 * Use for pages outside SiteRenderer (e.g. product detail, checkout) that need full site chrome.
 * NOT for use in editor/preview — live mode only.
 */
export function SiteLayoutShell({ site, pages = [], isOwner, children }: SiteLayoutShellProps) {
    const theme: ThemeConfig = resolveTheme({
        primaryColor: site.theme?.primaryColor,
        secondaryColor: site.theme?.secondaryColor,
        accentColor: site.theme?.accentColor,
        surfaceColor: site.theme?.surfaceColor,
        textColor: site.theme?.textColor,
        mutedColor: site.theme?.mutedColor,
        fontPairingId: site.theme?.fontPairingId,
        fontHeading: site.theme?.fontHeading,
        fontBody: site.theme?.fontBody,
        spacingPreset: site.theme?.spacingPreset,
        borderRadius: site.theme?.borderRadius,
        shadowPreset: site.theme?.shadowPreset,
        colorMode: site.theme?.colorMode,
        backgroundColor: site.theme?.backgroundColor,
    })

    const themeCSS = generateThemeCSS(theme)
    const slugCanonical = buildSlugCanonicalMap(pages as unknown as { id: string | number; slug?: string | null; isHomepage?: boolean | null }[])
    const rewriteUrl = (url: string | undefined) => rewriteLiveUrl(url, slugCanonical)

    // SiteLayoutShell is live-mode only — filter hidden/deleted/draft pages for non-owners
    const hiddenSlugs = new Set<string>()
    if (!isOwner) {
        for (const p of pages) {
            if (p.isVisible === false || (p.deletedAt != null && p.deletedAt !== '') || p.status === 'draft') {
                const raw = (p.slug ?? '').trim()
                hiddenSlugs.add(!raw || raw === '/' ? '/' : (raw.startsWith('/') ? raw : `/${raw}`))
            }
        }
    }

    // Rewrite URLs in nav + footer blocks
    const rawHeader = site.headerBlock as Record<string, unknown> | null | undefined
    const rawFooter = site.footerBlock as Record<string, unknown> | null | undefined

    const rawHeaderCta = rawHeader?.ctaButton as { show?: boolean; url?: string; [k: string]: unknown } | null | undefined
    const headerCtaPath = resolveInternalUrlPath(rawHeaderCta?.url, slugCanonical)
    const headerCtaHidden = hiddenSlugs.size > 0 && !!headerCtaPath && hiddenSlugs.has(headerCtaPath)
    const headerBlock: Record<string, unknown> | null = rawHeader
        ? {
            ...rawHeader,
            links: rewriteNavLinks(rawHeader.links, rewriteUrl, hiddenSlugs, slugCanonical),
            ctaButton: rawHeaderCta
                ? headerCtaHidden
                    ? { ...rawHeaderCta, show: false }
                    : { ...rawHeaderCta, url: rewriteUrl(rawHeaderCta.url) }
                : rawHeader.ctaButton,
        }
        : null

    const footerBlock: Record<string, unknown> | null = rawFooter
        ? {
            ...rawFooter,
            columns: rewriteFooterColumns(rawFooter.columns, rewriteUrl, hiddenSlugs, slugCanonical),
            _filteredNavLinks: rewriteNavLinks(rawHeader?.links, rewriteUrl, hiddenSlugs, slugCanonical),
        }
        : null

    const rawNavVariant = (rawHeader?.variant as string) ?? ''
    const fixedNavSpacer = FIXED_NAV_SPACER[NAV_VARIANT_ALIASES[rawNavVariant] ?? rawNavVariant]

    const renderBlock = (block: Record<string, unknown>, blockType: string) => {
        const BlockComponent = blockRegistry.getComponent(blockType)
        if (!BlockComponent) return null
        return (
            <BlockErrorBoundary blockType={blockType}>
                <BlockComponent block={block as never} theme={theme} site={site} page={null} />
            </BlockErrorBoundary>
        )
    }

    return (
        <OwnerProvider value={!!isOwner}>
            <GoogleFontsLoader fontBody={theme.fontBody} fontHeading={theme.fontHeading} />
            <style>{`
                ${themeCSS}
                * { box-sizing: border-box; margin: 0; padding: 0; }
                html { scroll-behavior: smooth; }
                body { font-family: var(--font-body); background: var(--background); color: var(--text); }
                h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
                .container { max-width: 1200px; margin: 0 auto; }
                img { max-width: 100%; height: auto; }
                a { color: inherit; text-decoration: none; }
                :root { --block-spacing-default: 32px; }
                @media (max-width: 768px) { :root { --block-spacing-default: 24px; } }
                ${theme.colorMode === 'dark' ? `
                .opacity-30 { opacity: 0.65 !important; }
                .opacity-40 { opacity: 0.72 !important; }
                .opacity-50 { opacity: 0.80 !important; }
                .opacity-60 { opacity: 0.85 !important; }
                .opacity-70 { opacity: 0.90 !important; }
                ` : ''}
            `}</style>

            {headerBlock && renderBlock(headerBlock, headerBlock.blockType as string || 'navigation')}
            {fixedNavSpacer && <div style={{ height: fixedNavSpacer }} aria-hidden="true" />}
            {children}
            {footerBlock && renderBlock(footerBlock, footerBlock.blockType as string || 'footer')}
        </OwnerProvider>
    )
}
