import { blockRegistry } from '@/blocks/registry'
import { isNavBlock } from '@/lib/ai/ensure-navigation'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import { applyGlobalBlock } from '@/lib/site-renderer/apply-global-block'
import {
    BROKEN_URL_PREFIX,
    HOMEPAGE_ALIASES,
    buildSlugCanonicalMap,
    resolveInternalUrlPath,
    rewriteLiveUrl,
    splitPathAndTail,
} from '@/lib/navigation-url'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { GoogleFontsLoader } from './GoogleFontsLoader'
import { generatePageSchemas, serializeJsonLd } from '@/lib/seo/json-ld'
import { HeadingProvider } from '@/lib/seo/heading-context'
import { getBlockHeadingLevel } from '@/lib/seo/heading-utils'
import { TrackingManager } from './TrackingManager'
import { OwnerProvider } from './OwnerContext'
import { HiddenSlugsProvider } from './HiddenSlugsContext'
import { BlockEditCallbackProvider } from './BlockEditCallbackContext'
import { FloatingContainerProvider } from './FloatingContainerContext'

// ── SiteRenderer — renders all blocks for a page using block registry ────────

// Blocks that skip block-spacing wrapper (position:fixed or sticky) — no padding applied.
// socialWidget/cartWidget are camelCase (BLOCK_TYPES registry); whatsapp-button/announcement-bar are kebab.
const FLOATING_BLOCK_TYPES = new Set(['socialWidget', 'whatsapp-button', 'cartWidget', 'announcement-bar'])

export type NavPage = { id: string | number; slug: string; isVisible?: boolean; deletedAt?: string | null; status?: string; layout?: unknown[]; isHomepage?: boolean }

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
        globalBlocks?: {
            cartWidget?: Record<string, unknown> | null
            whatsappButton?: Record<string, unknown> | null
            socialWidget?: Record<string, unknown> | null
        } | null
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
    /** True when loaded inside the standard page editor iframe (PreviewFrame). */
    isEditorIframe?: boolean
    siteId?: string
    isOwner?: boolean
    onBlockFieldChange?: (blockIndex: number, field: string, value: unknown) => void
}

function applyGlobalSystemBlocks(
    blocks: PreviewBlock[],
    site: SiteRendererProps['site'],
    pages: Array<{ layout?: unknown[] }> = [],
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

    const gb = site.globalBlocks

    if (process.env.NODE_ENV !== 'production' && gb === undefined && pages.length > 0) {
        console.warn('[SiteRenderer] site.globalBlocks not configured — BC page-scan fallback active')
    }

    // When gb is null (full wipe via mergeGlobalBlocks), treat every key as null (explicit delete)
    // so BC page-scan fallback is suppressed. When gb is undefined (column missing from DB), pass
    // undefined to each key to activate BC fallback for legacy sites.
    const cartEntry   = gb === null ? null : gb?.cartWidget
    const waEntry     = gb === null ? null : gb?.whatsappButton
    const socialEntry = gb === null ? null : gb?.socialWidget

    nextBlocks = applyGlobalBlock(nextBlocks, 'cartWidget', cartEntry, pages, {
        autoInject: true,
        siteHeaderBlock,
    })
    nextBlocks = applyGlobalBlock(nextBlocks, 'whatsapp-button', waEntry, pages)
    nextBlocks = applyGlobalBlock(nextBlocks, 'socialWidget', socialEntry, pages)

    return nextBlocks
}

export function SiteRenderer({ site, page, pages = [], isEditor = false, isBuilderPreview = false, isEditorIframe = false, siteId, isOwner, onBlockFieldChange }: SiteRendererProps) {
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
    const _preprocessedBlocks = applyGlobalSystemBlocks(pageBlocks, site, pages)
    // Detect cart: true when cartWidget block was injected (site has commerce enabled)
    const _hasCart = _preprocessedBlocks.some(b => b.blockType === 'cartWidget')
    const rawBlocks = _preprocessedBlocks.map(b => {
        if (b.blockType === 'navigation') {
            return { ...b, _hasCart }
        }
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
    const homepage = pages.find((p) => p.isHomepage) ?? pages[0]
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

    // All slugs + IDs of hidden/deleted pages.
    // warnSlugs: normalized /slug — used for live-site URL matching.
    // warnPageIds: page IDs — used for editor preview URLs (/preview/...?pageId=xxx).
    const warnSlugs = new Set<string>()
    const warnPageIds = new Set<string>()
    for (const p of pages) {
        if (p.isVisible === false || (p.deletedAt != null && p.deletedAt !== '') || p.status === 'draft') {
            const raw = (p.slug ?? '').trim()
            warnSlugs.add(!raw || raw === '/' ? '/' : (raw.startsWith('/') ? raw : `/${raw}`))
            warnPageIds.add(String(p.id))
        }
    }
    // Indicators (EyeOff, BrokenLinkWarning) only active inside the page editor iframe
    // or AI Builder. Page Preview and live site both render clean — no editor indicators.
    const showIndicators = isEditor && (isEditorIframe || isBuilderPreview)
    // Filter hidden pages from nav/CTA/footer links:
    //   - Builder/editor mode (showIndicators): keep all, indicators handle the warning
    //   - Page Preview (isEditor=true, no iframe): isEditor short-circuits → warnSlugs (filters)
    //   - Live site visitor (!isOwner): !isOwner → warnSlugs (filters)
    //   - Live site owner (isOwner=true): both conditions false → empty (owner sees all)
    // IMPORTANT: isOwner must always originate from server-side auth. SiteRenderer has no
    // internal enforcement — any caller that passes isOwner=true without auth check would
    // silently expose hidden link slugs in rendered HTML.
    const hiddenSlugs = showIndicators ? new Set<string>() : (isEditor || !isOwner) ? warnSlugs : new Set<string>()
    // Mark hidden nav links with _hiddenFromVisitor flag (EyeOff indicator) — builder mode only.
    const markHiddenLinks = showIndicators && warnSlugs.size > 0

    // Returns true when a URL points to a page that should be hidden from visitors.
    const isHiddenSlug = (url: string | undefined): boolean => {
        if (!hiddenSlugs.size) return false
        const resolvedPath = resolveInternalUrlPath(url, slugCanonical)
        return !!resolvedPath && hiddenSlugs.has(resolvedPath)
    }

    const rewriteFooterColumns = (columns: unknown): unknown => {
        if (!Array.isArray(columns)) return columns
        return columns.map((col) => {
            if (!col || typeof col !== 'object') return col
            const c = col as { links?: Array<{ url?: string; [k: string]: unknown }>; [k: string]: unknown }
            return {
                ...c,
                links: Array.isArray(c.links)
                    ? c.links
                        .filter((l) => !isHiddenSlug(l?.url))
                        .map((l) => {
                            const resolvedPath = resolveInternalUrlPath(l?.url, slugCanonical)
                            const isHiddenFromVisitor = markHiddenLinks && !!resolvedPath && warnSlugs.has(resolvedPath)
                            const rewritten = rewriteUrl(l?.url)
                            return {
                                ...l,
                                url: markBrokenUrl(l?.url, rewritten),
                                ...(isHiddenFromVisitor ? { _hiddenFromVisitor: true } : {}),
                            }
                        })
                    : c.links,
            }
        })
    }

    const rewriteNavLinks = (links: unknown): unknown => {
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
                const resolvedPath = resolveInternalUrlPath(link.url, slugCanonical)
                const isHiddenFromVisitor = markHiddenLinks && !!resolvedPath && warnSlugs.has(resolvedPath)
                return {
                    ...link,
                    url: rewriteUrl(link.url),
                    children: link.children ? rewriteNavLinks(link.children) : undefined,
                    ...(isHiddenFromVisitor ? { _hiddenFromVisitor: true } : {}),
                }
            })
    }

    // In editor mode: when rewriteUrl cannot resolve an internal path (returns '#'),
    // prefix with '_broken_url_:' so BrokenLinkWarning can detect the broken link.
    // On live site or for external/anchor URLs this is a no-op.
    const markBrokenUrl = (original: string | undefined, rewritten: string): string => {
        if (!showIndicators || rewritten !== '#') return rewritten
        const trimmed = (original ?? '').trim()
        if (!trimmed || trimmed === '#' || trimmed.startsWith('#')) return rewritten
        if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) return rewritten
        if (!trimmed.startsWith('/')) return rewritten
        return `${BROKEN_URL_PREFIX}${trimmed}`
    }

    const blocks = rawBlocks.map((b) => {
        if (b.blockType === 'navigation') {
            const rawCta = b.ctaButton as { show?: boolean; url?: string; [k: string]: unknown } | null | undefined
            return {
                ...b,
                links: rewriteNavLinks(b.links) as typeof b.links,
                ctaButton: rawCta
                    ? isHiddenSlug(rawCta.url)
                        ? { ...rawCta, show: false }
                        : { ...rawCta, url: markBrokenUrl(rawCta.url, rewriteUrl(rawCta.url)) }
                    : b.ctaButton,
                // rewritten so editor iframe navigates to homepage pageId, not bare '/'
                _logoHref: rewriteUrl('/'),
            }
        }
        if (b.blockType === 'hero' && Array.isArray(b.ctaButtons)) {
            return {
                ...b,
                ctaButtons: b.ctaButtons
                    .filter((btn) => !isHiddenSlug(btn?.url))
                    .map((btn) => ({ ...btn, url: markBrokenUrl(btn?.url, rewriteUrl(btn?.url)) })),
            }
        }
        if (b.blockType === 'cta') {
            const ctaUrl = b.ctaUrl as string | undefined
            const secUrl = b.secondaryCtaUrl as string | undefined
            return {
                ...b,
                ctaUrl: isHiddenSlug(ctaUrl) ? '' : markBrokenUrl(ctaUrl, rewriteUrl(ctaUrl)),
                secondaryCtaUrl: isHiddenSlug(secUrl) ? '' : markBrokenUrl(secUrl, rewriteUrl(secUrl)),
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
            const rawSiteHeaderLinks = (site?.headerBlock as Record<string, unknown> | undefined)?.links
            return {
                ...b,
                columns: rewriteFooterColumns(b.columns),
                _filteredNavLinks: rewriteNavLinks(rawSiteHeaderLinks),
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

    // Group floating widgets by their corner position so they stack vertically
    // instead of overlapping when multiple are placed on the same corner.
    // GH-1412: 'cta' joins the floating stack ONLY in its floating-sticky variant, so a
    // floating CTA no longer overlaps the WhatsApp/social/cart launchers (same bottom-right corner).
    const FLOATING_WIDGET_TYPES = new Set(['socialWidget', 'whatsapp-button', 'cartWidget', 'cta'])
    const getFloatingBlockPos = (b: PreviewBlock) => {
        if (b.blockType === 'cartWidget') return 'bottom-left'
        if (b.blockType === 'whatsapp-button' && (b.position as string) === 'bottom-left') return 'bottom-left'
        return 'bottom-right'
    }
    const floatingBlockSet = new Set<number>()
    const floatingByPos = new Map<string, number[]>()
    blocks.forEach((b, i) => {
        if (!FLOATING_WIDGET_TYPES.has(b.blockType)) return
        // CTA only floats in the floating-sticky variant; every other variant stays in normal flow.
        if (b.blockType === 'cta' && (b.variant as string) !== 'floating-sticky') return
        // Other widgets keep their existing behavior: skip the inline (in-flow) variant.
        if (b.blockType !== 'cta' && (b.variant as string) === 'inline') return
        floatingBlockSet.add(i)
        const pos = getFloatingBlockPos(b)
        const arr = floatingByPos.get(pos) ?? []
        arr.push(i)
        floatingByPos.set(pos, arr)
    })

    return (
        <HiddenSlugsProvider value={showIndicators ? { slugs: warnSlugs, pageIds: warnPageIds } : { slugs: new Set(), pageIds: new Set() }}>
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
                    dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
                />
            ))}

            {blocks.map((block, index) => {
                if (!block.blockType) return null

                // Floating widgets are rendered in grouped stacking containers below
                if (floatingBlockSet.has(index)) return null

                const BlockComponent = blockRegistry.getComponent(block.blockType)
                if (!BlockComponent) {
                    // Unknown block type — skip silently (AC-6)
                    return null
                }

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
                const blockVariant = (block as Record<string, unknown>).variant as string | undefined
                const isFloatingBlock = FLOATING_BLOCK_TYPES.has(block.blockType) && blockVariant !== 'inline'
                const blockSpacing = (block as Record<string, unknown>).blockSpacing as { paddingTop?: number; paddingBottom?: number } | undefined
                const spacingStyle = (isGlobalBlock || isFloatingBlock)
                    ? (breadcrumbOffset ? { paddingTop: breadcrumbOffset } : {})
                    : {
                        // GH-1412: nav-offset is only a DEFAULT — when the user has explicitly set
                        // a Top Spacing value (blockSpacing.paddingTop), respect it instead of
                        // silently overriding it with the nav height.
                        paddingTop: applyNavOffset && index === firstContentBlockIdx && blockSpacing?.paddingTop === undefined
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
                    <BlockEditCallbackProvider key={`${block.blockType}-${index}`} value={callbackValue}>
                        <BlockErrorBoundary blockType={block.blockType}>
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

            {/* Floating widgets — grouped by corner so they stack vertically instead of overlapping */}
            {Array.from(floatingByPos.entries()).map(([pos, blockIndices]) => (
                <div
                    key={pos}
                    className={`fixed ${pos === 'bottom-left' ? 'left-6' : 'right-6'} bottom-6 z-[51] flex flex-col-reverse items-end gap-3`}
                >
                    {[...blockIndices]
                        // GH-1412: launcher widgets (WhatsApp/social/cart) stay closest to the
                        // corner; a floating-sticky CTA stacks ABOVE them. flex-col-reverse puts
                        // the first DOM child at the bottom (corner), so CTA must render last.
                        .sort((a, b) => (blocks[a].blockType === 'cta' ? 1 : 0) - (blocks[b].blockType === 'cta' ? 1 : 0))
                        .map(blockIndex => {
                        const floatingBlock = blocks[blockIndex]
                        const FloatingComponent = blockRegistry.getComponent(floatingBlock.blockType)
                        if (!FloatingComponent) return null
                        const editorIdx = typeof floatingBlock.__editorBlockIndex === 'number' && floatingBlock.__editorBlockIndex >= 0
                            ? floatingBlock.__editorBlockIndex : blockIndex
                        const floatingCallback = onBlockFieldChange
                            ? { blockIndex: editorIdx, onFieldChange: (field: string, value: unknown) => onBlockFieldChange(editorIdx, field, value) }
                            : null
                        const floatingContent = (
                            <FloatingContainerProvider value={true}>
                                <BlockEditCallbackProvider value={floatingCallback}>
                                    <BlockErrorBoundary blockType={floatingBlock.blockType}>
                                        <FloatingComponent block={floatingBlock} theme={theme} site={site} page={page} />
                                    </BlockErrorBoundary>
                                </BlockEditCallbackProvider>
                            </FloatingContainerProvider>
                        )
                        if (isEditor) {
                            // Preserve __editorBlockIndex as data attribute when set (e.g. -1 for global injected blocks).
                            const dataBlockIndex = typeof floatingBlock.__editorBlockIndex === 'number'
                                ? floatingBlock.__editorBlockIndex
                                : editorIdx
                            return (
                                <div
                                    key={blockIndex}
                                    data-block-index={dataBlockIndex}
                                    data-block-type={floatingBlock.blockType}
                                    className="group/block relative"
                                >
                                    {floatingContent}
                                </div>
                            )
                        }
                        return <div key={blockIndex}>{floatingContent}</div>
                    })}
                </div>
            ))}
        </OwnerProvider>
        </HiddenSlugsProvider>
    )
}
