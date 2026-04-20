import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import { filterNavigationLinksByVisibility } from '@/lib/navigation'
import {
    buildSlugCanonicalMap,
    rewriteLiveUrl,
    splitPathAndTail,
} from '@/lib/navigation-url'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { GoogleFontsLoader } from './GoogleFontsLoader'
import { generatePageSchemas } from '@/lib/seo/json-ld'
import { HeadingProvider } from '@/lib/seo/heading-context'
import { getBlockHeadingLevel } from '@/lib/seo/heading-utils'
import { TrackingManager } from './TrackingManager'
import { OwnerProvider } from './OwnerContext'

// ── SiteRenderer — renders all blocks for a page using block registry ────────

export type NavPage = { id: string | number; slug: string; isVisible?: boolean; deletedAt?: string | null }

export type NavLinkItem = { label: string; url: string; newTab?: boolean; isReference?: boolean; reference?: { relationTo: string; value: string | number } | null };
type PreviewBlock = { blockType: string; links?: NavLinkItem[]; ctaButton?: { url?: string; [key: string]: unknown }; ctaButtons?: Array<{ url?: string; [key: string]: unknown }>; [key: string]: unknown }

export type SiteRendererProps = {
    site: {
        headerBlock?: Record<string, unknown> | null
        footerBlock?: Record<string, unknown> | null
        theme?: {
            primaryColor?: string
            secondaryColor?: string
            accentColor?: string
            surfaceColor?: string
            textColor?: string
            mutedColor?: string
            fontPairingId?: string | null
            fontHeading?: string
            fontBody?: string
            spacingPreset?: 'compact' | 'default' | 'relaxed'
            borderRadius?: 'sharp' | 'subtle' | 'rounded' | 'soft' | 'pill'
            shadowPreset?: 'none' | 'subtle' | 'medium' | 'dramatic'
            colorMode?: 'dark' | 'light'
            backgroundColor?: string
            [key: string]: unknown
        }
        [key: string]: unknown
    }
    page: {
        layout?: unknown[]
        [key: string]: unknown
    }
    pages?: NavPage[]
    isEditor?: boolean
    siteId?: string
    isOwner?: boolean
}

function applyGlobalSystemBlocks(
    blocks: PreviewBlock[],
    site: SiteRendererProps['site'],
): PreviewBlock[] {
    const siteHeaderBlock = site.headerBlock as PreviewBlock | null | undefined
    const siteFooterBlock = site.footerBlock as PreviewBlock | null | undefined

    let nextBlocks = [...blocks]

    if (siteHeaderBlock?.blockType === 'navigation') {
        const navIndex = nextBlocks.findIndex(block => block.blockType === 'navigation')
        const normalizedHeader = { ...siteHeaderBlock, blockType: 'navigation' }
        nextBlocks = navIndex >= 0
            ? nextBlocks.map((block, index) => index === navIndex ? normalizedHeader : block)
            : [normalizedHeader, ...nextBlocks]
    }

    if (siteFooterBlock?.blockType === 'footer') {
        const footerIndex = nextBlocks.findIndex(block => block.blockType === 'footer')
        const normalizedFooter = { ...siteFooterBlock, blockType: 'footer' }
        nextBlocks = footerIndex >= 0
            ? nextBlocks.map((block, index) => index === footerIndex ? normalizedFooter : block)
            : [...nextBlocks, normalizedFooter]
    }

    return nextBlocks
}

export function SiteRenderer({ site, page, pages = [], isEditor = false, siteId, isOwner }: SiteRendererProps) {
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

    const pageBlocks: PreviewBlock[] = (page?.layout as PreviewBlock[]) || []
    const rawBlocks = applyGlobalSystemBlocks(pageBlocks, site)

    // In editor preview, rewrite internal nav/CTA links so subpages are navigable.
    // - Internal paths ("/about") → /preview/{siteId}?pageId={matchedPageId} (keeps iframe in preview scope)
    // - Unmatched internal paths → '#' (prevent 404)
    // - External URLs (http*) → preserved as-is
    const previewSiteId = String(
        (site as { id?: string | number })?.id ?? '',
    )

    // Use the real pages list as the source of truth for URL resolution:
    //
    // - slugToPageId: any-form slug → pageId. Editor preview routes nav
    //   links to `/preview/{siteId}?pageId=...` so the iframe stays in
    //   preview scope.
    // - slugCanonical: any-form slug → canonical `/slug`. Live mode
    //   rewrites nav/footer/cta URLs to the real slug, fixing cases like
    //   AI-seeded `/Services` → stored `/services`. Built once via
    //   buildSlugCanonicalMap; both helpers index three forms (exact,
    //   lowercased, bare) so case and leading-slash drift both resolve.
    const slugToPageId = new Map<string, string>()
    for (const p of pages) {
        const pid = String(p.id)
        const rawSlug = (p.slug ?? '').trim()
        if (!rawSlug) continue
        const withSlash = rawSlug.startsWith('/') ? rawSlug : `/${rawSlug}`
        slugToPageId.set(withSlash, pid)
        slugToPageId.set(withSlash.toLowerCase(), pid)
        if (rawSlug !== '/') {
            slugToPageId.set(rawSlug.replace(/^\//, ''), pid)
        }
    }
    const homepage = pages.find((p) => (p as NavPage & { isHomepage?: boolean }).isHomepage) ?? pages[0]
    if (homepage) slugToPageId.set('/', String(homepage.id))

    const slugCanonical = buildSlugCanonicalMap(pages as unknown as { id: string | number; slug?: string | null; isHomepage?: boolean | null }[])

    const rewritePreviewUrl = (url: string | undefined): string => {
        if (!url) return '#'
        if (/^https?:\/\//i.test(url)) return url
        if (url.startsWith('#')) return url
        if (url.includes('#') && !url.startsWith('/')) return url
        if (!previewSiteId) return '#'
        const [path] = splitPathAndTail(url)
        const hit =
            slugToPageId.get(path) ??
            slugToPageId.get(path.toLowerCase()) ??
            slugToPageId.get(path.replace(/^\//, ''))
        if (hit) return `/preview/${previewSiteId}?pageId=${hit}`
        return '#'
    }

    const rewriteUrl = isEditor
        ? rewritePreviewUrl
        : (url: string | undefined) => rewriteLiveUrl(url, slugCanonical)

    const rewriteFooterColumns = (columns: unknown): unknown => {
        if (!Array.isArray(columns)) return columns
        return columns.map((col) => {
            if (!col || typeof col !== 'object') return col
            const c = col as { links?: Array<{ url?: string; [k: string]: unknown }>; [k: string]: unknown }
            return {
                ...c,
                links: Array.isArray(c.links)
                    ? c.links.map((l) => ({ ...l, url: rewriteUrl(l?.url) }))
                    : c.links,
            }
        })
    }

    const blocks = rawBlocks.map((b) => {
        if (b.blockType === 'navigation') {
            return {
                ...b,
                links: b.links?.map((l) => ({ ...l, url: rewriteUrl(l.url) })),
                ctaButton: b.ctaButton
                    ? { ...b.ctaButton, url: rewriteUrl(b.ctaButton.url) }
                    : b.ctaButton,
            }
        }
        if (b.blockType === 'hero' && Array.isArray(b.ctaButtons)) {
            return {
                ...b,
                ctaButtons: b.ctaButtons.map((btn) => ({
                    ...btn,
                    url: rewriteUrl(btn?.url),
                })),
            }
        }
        if (b.blockType === 'footer') {
            return {
                ...b,
                columns: rewriteFooterColumns(b.columns),
            }
        }
        if (b.blockType === 'cta' && b.ctaButton && typeof b.ctaButton === 'object') {
            const ctaBtn = b.ctaButton as { url?: string; [k: string]: unknown }
            return {
                ...b,
                ctaButton: { ...ctaBtn, url: rewriteUrl(ctaBtn.url) },
            }
        }
        return b
    })

    // JSON-LD schemas — auto-detect from blocks present
    const isHomepage = blocks.some(b => b.blockType === 'hero') && blocks[0]?.blockType === 'navigation'
    const jsonLdSchemas = generatePageSchemas({ blocks, site, page, isHomepage })

    // Heading hierarchy — compute levels for all blocks
    const allBlockTypes = blocks.map(b => b.blockType).filter(Boolean)

    return (
        <OwnerProvider value={!!isOwner}>
            <GoogleFontsLoader fontBody={theme.fontBody} fontHeading={theme.fontHeading} />
            <style>{`
          ${themeCSS}
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html { scroll-behavior: smooth; }
          body {
            font-family: var(--font-body);
            background: var(--background);
            color: var(--text);
          }
          h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
          .container { max-width: 1200px; margin: 0 auto; }
          img { max-width: 100%; height: auto; }
          a { color: inherit; text-decoration: none; }
          /* Default block spacing — overridden by inline style when user customizes */
          :root { --block-spacing-default: 32px; }
          @media (max-width: 768px) { :root { --block-spacing-default: 24px; } }
          /* Dark-mode opacity boost — blocks widely use opacity-50/40/60 for muted
             text. On dark backgrounds this drops below WCAG AA. Boost to 0.78+
             via scoped rules so muted text stays readable without touching 195
             occurrences across blocks. Applied via data-color-mode on root below.
             Plan: 260414-1400-ai-gen-unsplash-pipeline followup (dark-mode contrast). */
          ${theme.colorMode === 'dark' ? `
          .opacity-30 { opacity: 0.65 !important; }
          .opacity-40 { opacity: 0.72 !important; }
          .opacity-50 { opacity: 0.80 !important; }
          .opacity-60 { opacity: 0.85 !important; }
          .opacity-70 { opacity: 0.90 !important; }
          ` : ''}
          /* Print — show all content, no animations */
          @media print {
            * { opacity: 1 !important; transform: none !important; animation: none !important; }
          }
        `}</style>

            {/* No-JS fallback — Framer Motion initial="hidden" sets opacity:0 */}
            <noscript>
                <style>{`[style*="opacity: 0"], [style*="opacity:0"] { opacity: 1 !important; transform: none !important; }`}</style>
            </noscript>

            {/* Analytics & Tracking */}
            {siteId && !isEditor && (
                <TrackingManager siteId={siteId} isOwner={isOwner} />
            )}

            {/* JSON-LD Structured Data */}
            {jsonLdSchemas.map((schema, i) => (
                <script
                    key={`jsonld-${i}`}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
            ))}

            {blocks.map((block, index) => {
                if (!block.blockType) return null

                const BlockComponent = blockRegistry.getComponent(block.blockType)
                if (!BlockComponent) {
                    // Unknown block type — skip silently (AC-6)
                    return null
                }

                const normalizedBlock = block.blockType === 'navigation'
                    ? {
                        ...block,
                        links: filterNavigationLinksByVisibility(block.links, pages),
                    }
                    : block

                const headingLevel = getBlockHeadingLevel(block.blockType, allBlockTypes, index)

                // Block spacing — navigation/footer default to 0, others use custom or default
                const isGlobalBlock = block.blockType === 'navigation' || block.blockType === 'footer'
                const blockStyle = (block as Record<string, unknown>).style as { paddingTop?: number; paddingBottom?: number } | undefined
                const spacingStyle = isGlobalBlock
                    ? {}
                    : {
                        paddingTop: blockStyle?.paddingTop !== undefined ? `${blockStyle.paddingTop}px` : 'var(--block-spacing-default)',
                        paddingBottom: blockStyle?.paddingBottom !== undefined ? `${blockStyle.paddingBottom}px` : 'var(--block-spacing-default)',
                    }

                const blockContent = (
                    <BlockErrorBoundary key={`${block.blockType}-${index}`} blockType={block.blockType}>
                        <HeadingProvider level={headingLevel}>
                            <BlockComponent block={normalizedBlock} theme={theme} site={site} page={page} />
                        </HeadingProvider>
                    </BlockErrorBoundary>
                )

                if (isEditor) {
                    return (
                        <div
                            key={`${block.blockType}-${index}`}
                            data-block-index={index}
                            data-block-type={block.blockType}
                            className="group/block relative w-full"
                            style={spacingStyle}
                        >
                            {blockContent}
                        </div>
                    )
                }

                // Public site: no extra wrapper div to avoid breaking CSS selectors.
                // Spacing is applied via the global CSS variable on block root elements.
                return blockContent
            })}
        </OwnerProvider>
    )
}
