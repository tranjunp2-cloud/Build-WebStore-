import { blockRegistry } from '@/blocks/registry'
import { isNavBlock } from '@/lib/ai/ensure-navigation'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import {
    HOMEPAGE_ALIASES,
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
import { BlockEditCallbackProvider } from './BlockEditCallbackContext'

// ── SiteRenderer — renders all blocks for a page using block registry ────────

export type NavPage = { id: string | number; slug: string; isVisible?: boolean; deletedAt?: string | null }

export type NavLinkItem = { label: string; url: string; newTab?: boolean; isReference?: boolean; reference?: { relationTo: string; value: string | number } | null; children?: NavLinkItem[] };
type PreviewBlock = {
    blockType: string
    links?: NavLinkItem[]
    ctaButton?: { url?: string; [key: string]: unknown }
    ctaButtons?: Array<{ url?: string; [key: string]: unknown }>
    __editorBlockIndex?: number
    [key: string]: unknown
}

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
    isBuilderPreview?: boolean
    siteId?: string
    isOwner?: boolean
    onBlockFieldChange?: (blockIndex: number, field: string, value: unknown) => void
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
        const normalizedHeader = { ...siteHeaderBlock, blockType: 'navigation', __editorBlockIndex: -1 }
        nextBlocks = navIndex >= 0
            ? nextBlocks.map((block, index) => index === navIndex ? normalizedHeader : block)
            : [normalizedHeader, ...nextBlocks]
    }

    if (siteFooterBlock?.blockType === 'footer') {
        const footerIndex = nextBlocks.findIndex(block => block.blockType === 'footer')
        const normalizedFooter = { ...siteFooterBlock, blockType: 'footer', __editorBlockIndex: -1 }
        nextBlocks = footerIndex >= 0
            ? nextBlocks.map((block, index) => index === footerIndex ? normalizedFooter : block)
            : [...nextBlocks, normalizedFooter]
    }

    // Inject breadcrumb globally from headerBlock.breadcrumbConfig
    const breadcrumbCfg = (siteHeaderBlock as Record<string, unknown> | null | undefined)?.breadcrumbConfig as
        { homeLabel?: string; separator?: string; showOnAllPages?: boolean } | undefined
    // Only inject breadcrumb when user has explicitly configured it; existing sites without the
    // config key must not get breadcrumb auto-enabled (would surprise published site owners).
    // Treat null same as false — Payload CMS may store unset booleans as null.
    const showBreadcrumb = breadcrumbCfg !== undefined &&
        breadcrumbCfg.showOnAllPages !== false &&
        breadcrumbCfg.showOnAllPages !== null
    // Remove any per-page breadcrumb blocks (legacy manual adds) — breadcrumb is global-only now.
    // DB data is unchanged; only the render is suppressed.
    nextBlocks = nextBlocks.filter(b => b.blockType !== 'breadcrumb')
    if (showBreadcrumb) {
        const navIdx = nextBlocks.findIndex(b => b.blockType === 'navigation')
        const breadcrumbBlock: PreviewBlock = {
            ...breadcrumbCfg,
            blockType: 'breadcrumb',
            homeLabel: breadcrumbCfg?.homeLabel || 'Home',
            separator: breadcrumbCfg?.separator || '/',
            showOnAllPages: true,
            items: [],
            __editorBlockIndex: -1,
            _navTree: siteHeaderBlock?.links || [], // Vital for mapping custom sub-menu labels
        }
        nextBlocks.splice(navIdx >= 0 ? navIdx + 1 : 0, 0, breadcrumbBlock)
    }

    return nextBlocks
}

export function SiteRenderer({ site, page, pages = [], isEditor = false, isBuilderPreview = false, siteId, isOwner, onBlockFieldChange }: SiteRendererProps) {
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

    const pageBlocks: PreviewBlock[] = ((page?.layout as PreviewBlock[]) || []).map((block, index) => ({
        ...block,
        __editorBlockIndex: block.__editorBlockIndex ?? index,
    }))
    const rawBlocks = applyGlobalSystemBlocks(pageBlocks, site).map(b => {
        if (b.blockType !== 'breadcrumb') return b
        // Pass page slug so breadcrumb renders correct path (in editor, usePathname returns /preview/... not the real slug)
        // Runtime check required: Payload may store slug as null; type cast alone doesn't guard this
        const slug = (page as Record<string, unknown>)?.slug
        return { ...b, _pageSlug: typeof slug === 'string' ? slug : undefined }
    })

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
    if (homepage) {
        const homepageId = String(homepage.id)
        slugToPageId.set('/', homepageId)
        // Mirror buildSlugCanonicalMap's HOMEPAGE_ALIASES so preview clicks on
        // `/Home`, `/Index`, etc. resolve the iframe to the homepage pageId
        // instead of dead-ending at `#`. Sharing the const prevents drift.
        for (const alias of HOMEPAGE_ALIASES) {
            if (!slugToPageId.has(alias)) slugToPageId.set(alias, homepageId)
        }
    }

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
        if (hit) return `/preview/${previewSiteId}?pageId=${hit}${isBuilderPreview ? '&builder=1' : ''}`
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
    const rewriteNavLinks = (links: unknown): unknown => {
        if (!Array.isArray(links)) return links
        return links.map((l) => {
            if (!l || typeof l !== 'object') return l
            const link = l as { url?: string; children?: unknown; [k: string]: unknown }
            return {
                ...link,
                url: rewriteUrl(link.url),
                children: link.children ? rewriteNavLinks(link.children) : undefined,
            }
        })
    }

    const blocks = rawBlocks.map((b) => {
        if (b.blockType === 'navigation') {
            return {
                ...b,
                links: rewriteNavLinks(b.links) as typeof b.links,
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
        if (b.blockType === 'breadcrumb') {
            const pageSlug = (page as Record<string, unknown>)?.slug as string || ''
            const navTree = b._navTree as NavLinkItem[] || []
            const homeLabel = (b.homeLabel as string) || 'Home'

            const normalize = (s: string) => s.startsWith('/') ? s : `/${s}`
            const target = normalize(pageSlug)

            let computedItems: { label: string; url: string }[] = []

            function searchTree(links: NavLinkItem[], currentPath: { label: string; url: string }[]): { label: string; url: string }[] | null {
                for (const link of links) {
                    const linkUrl = link.url || ''
                    const newPath = [...currentPath, { label: link.label, url: linkUrl }]
                    if (normalize(linkUrl) === target) return newPath
                    if (link.children && link.children.length > 0) {
                        const found = searchTree(link.children, newPath)
                        if (found) return found
                    }
                }
                return null
            }

            const foundPath = searchTree(navTree, [])
            if (foundPath !== null) {
                const firstLabel = foundPath[0]?.label.toLowerCase().trim() || ''
                const targetHomeLabel = homeLabel.toLowerCase().trim()
                
                // Only skip prepending Home if the first item in nav path is literally named Home/Trang chủ
                const isHomeAlreadyFirst = firstLabel === targetHomeLabel || firstLabel === 'home' || firstLabel === 'trang chủ'
                
                if (foundPath.length > 0 && !isHomeAlreadyFirst) {
                    computedItems = [{ label: homeLabel, url: '/' }, ...foundPath]
                } else {
                    computedItems = foundPath
                }
            } else {
                // Fallback to legacy slug split
                const fallbackItems: { label: string; url: string }[] = [{ label: homeLabel, url: '/' }]
                const HOMEPAGE_SLUGS = new Set(['/', '', 'home', 'index'])
                const segments = HOMEPAGE_SLUGS.has(pageSlug.replace(/^\//, '')) ? [] : target.split('/').filter(Boolean)
                const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
                const safeDecodeSegment = (seg: string) => { try { return decodeURIComponent(seg) } catch { return seg } }
                let accumulated = ''
                for (const seg of segments) {
                    accumulated += '/' + seg
                    fallbackItems.push({ label: capitalize(safeDecodeSegment(seg)), url: accumulated })
                }
                computedItems = fallbackItems
            }

            return {
                ...b,
                items: computedItems.map(item => ({ ...item, url: rewriteUrl(item.url) })),
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
        return b as PreviewBlock
    }) as PreviewBlock[]

    // JSON-LD schemas — auto-detect from blocks present
    const isHomepage = blocks.some(b => b.blockType === 'hero') && blocks[0]?.blockType === 'navigation'
    const jsonLdSchemas = generatePageSchemas({ blocks, site, page, isHomepage })

    // Heading hierarchy — compute levels for all blocks
    const allBlockTypes = blocks.map(b => b.blockType).filter(Boolean)

    // Nav offset: overlay nav variants (transparent, floating) are fixed-position and out of
    // document flow — in the editor their content can hide behind the nav without a paddingTop.
    // On live sites the overlay is intentional (hero background fills behind nav), so no offset.
    // Sticky variants (default, centered, mega) push content down naturally via document flow —
    // adding paddingTop would create a double gap. Sidebar nav is off-canvas (no top bar).
    const GLOBAL_BLOCK_TYPES = ['header', 'navigation', 'footer', 'breadcrumb']
    const navForOffset = blocks.find(b => isNavBlock(b))
    const firstContentBlockIdx = blocks.findIndex(b => !GLOBAL_BLOCK_TYPES.includes(b.blockType))
    // Normalize raw DB variant through legacy aliases (mirrors NavigationBlock VARIANT_ALIASES).
    // 'pill' is stored in legacy sites but resolves to 'floating' at render time.
    const NAV_VARIANT_DB_ALIASES: Record<string, string> = { simple: 'default', 'mega-menu': 'mega', pill: 'floating' }
    const rawNavVariant = ((navForOffset as Record<string, unknown> | undefined)?.variant as string) ?? 'default'
    const navVariant = NAV_VARIANT_DB_ALIASES[rawNavVariant] ?? rawNavVariant
    const OVERLAY_NAV_VARIANTS = new Set(['transparent', 'floating'])
    // Per-variant paddingTop for breadcrumb (always a thin strip directly under nav).
    // Heights confirmed from src/blocks/navigation/index.tsx: transparent/sidebar = 64px,
    // floating (pill, top-4) has ~80px footprint so 88px clears with margin.
    const BREADCRUMB_NAV_OFFSET: Record<string, string> = {
        transparent: '64px',
        sidebar:     '64px',
        floating:    '88px',
        default:     'var(--nav-height, 64px)',
        centered:    'var(--nav-height, 64px)',
        mega:        'var(--nav-height, 64px)',
    }
    const applyNavOffset =
        navForOffset != null &&
        OVERLAY_NAV_VARIANTS.has(navVariant) &&
        isEditor &&
        firstContentBlockIdx >= 0

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

                // Nav always renders every link the user authored, even when
                // a target page is `isVisible=false`. Hiding only affects
                // direct routing (public route query already returns 404 for
                // hidden pages); the nav menu itself stays stable so users
                // never see menu items disappear mid-session as they click
                // around.
                const normalizedBlock = block

                const headingLevel = getBlockHeadingLevel(block.blockType, allBlockTypes, index)

                // Block spacing — navigation/footer default to 0, others use custom or default
                const isGlobalBlock = ['header', 'navigation', 'footer', 'breadcrumb'].includes(block.blockType)
                const isBreadcrumb = block.blockType === 'breadcrumb'
                // Only out-of-flow nav variants (fixed/off-canvas) need to offset the breadcrumb.
                // Sticky variants (default/centered/mega) are in document flow — no extra offset needed.
                const BREADCRUMB_OFFSET_VARIANTS = new Set(['transparent', 'floating', 'sidebar'])
                const breadcrumbOffset =
                    isBreadcrumb && navForOffset != null && BREADCRUMB_OFFSET_VARIANTS.has(navVariant)
                        ? (BREADCRUMB_NAV_OFFSET[navVariant] ?? 'var(--nav-height, 64px)')
                        : undefined
                const blockSpacing = (block as Record<string, unknown>).blockSpacing as { paddingTop?: number; paddingBottom?: number } | undefined
                // Floating widget blocks (social-widget, whatsapp-button, cart-widget) render as
                // position:fixed — they are out of document flow so the spacing wrapper must not add
                // any padding (otherwise a blank 64px gap appears on the page). GH-821.
                const FLOATING_WIDGET_TYPES = new Set(['social-widget', 'whatsapp-button', 'cart-widget'])
                const isFloatingWidget = FLOATING_WIDGET_TYPES.has(block.blockType)
                    && (block as Record<string, unknown>).variant !== 'inline'
                const spacingStyle = isGlobalBlock || isFloatingWidget
                    ? (breadcrumbOffset ? { paddingTop: breadcrumbOffset } : {})
                    : {
                        paddingTop: applyNavOffset && index === firstContentBlockIdx
                            ? (navVariant === 'floating' ? 'calc(var(--nav-height, 64px) + 1rem)' : 'var(--nav-height, 64px)')
                            : blockSpacing?.paddingTop !== undefined ? `${blockSpacing.paddingTop}px` : 'var(--block-spacing-default)',
                        paddingBottom: blockSpacing?.paddingBottom !== undefined ? `${blockSpacing.paddingBottom}px` : 'var(--block-spacing-default)',
                    }

                // Use __editorBlockIndex when available (set by PreviewSiteRenderer from store order).
                // Falls back to loop index only for non-editor contexts or uninjected blocks.
                // This prevents nav-injection offset mismatch: preview injects nav at position 0 which
                // shifts all loop indices by +1, but the store has no injected nav, so hero is at
                // store index 0 while its loop index would be 1.
                const editorBlockIndex = typeof block.__editorBlockIndex === 'number' && block.__editorBlockIndex >= 0
                    ? block.__editorBlockIndex
                    : index
                const callbackValue = onBlockFieldChange
                    ? { blockIndex: editorBlockIndex, onFieldChange: (field: string, value: unknown) => onBlockFieldChange(editorBlockIndex, field, value) }
                    : null

                const blockContent = (
                    <BlockEditCallbackProvider value={callbackValue}>
                        <BlockErrorBoundary key={`${block.blockType}-${index}`} blockType={block.blockType}>
                            <HeadingProvider level={headingLevel}>
                                <BlockComponent block={normalizedBlock} theme={theme} site={site} page={page} />
                            </HeadingProvider>
                        </BlockErrorBoundary>
                    </BlockEditCallbackProvider>
                )

                if (isEditor) {
                    return (
                        <div
                            key={`${block.blockType}-${index}`}
                            data-block-index={block.__editorBlockIndex ?? index}
                            data-block-type={block.blockType}
                            className="group/block relative w-full"
                            style={spacingStyle}
                        >
                            {blockContent}
                        </div>
                    )
                }

                // Public site: wrap non-global blocks with spacing style so
                // user-customized blockSpacing (paddingTop/paddingBottom) is
                // preserved on the live published site. Global blocks (nav,
                // footer, breadcrumb) normally return unwrapped; breadcrumb gets
                // wrapped when a fixed-nav offset applies.
                if (!isGlobalBlock || (isBreadcrumb && breadcrumbOffset)) {
                    return (
                        <div key={`${block.blockType}-${index}`} style={spacingStyle}>
                            {blockContent}
                        </div>
                    )
                }
                return blockContent
            })}
        </OwnerProvider>
    )
}
