import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import { filterNavigationLinksByVisibility } from '@/lib/navigation'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { GoogleFontsLoader } from './GoogleFontsLoader'
import { generatePageSchemas } from '@/lib/seo/json-ld'
import { HeadingProvider, getBlockHeadingLevel } from '@/lib/seo/heading-context'

// ── SiteRenderer — renders all blocks for a page using block registry ────────

export type NavPage = { id: string | number; slug: string; isVisible?: boolean; deletedAt?: string | null }

export type NavLinkItem = { label: string; url: string; newTab?: boolean; isReference?: boolean; reference?: { relationTo: string; value: string | number } | null };

export type SiteRendererProps = {
    site: {
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
}

export function SiteRenderer({ site, page, pages = [] }: SiteRendererProps) {
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

    type PreviewBlock = { blockType: string; links?: NavLinkItem[]; [key: string]: unknown }
    const blocks: PreviewBlock[] = (page?.layout as PreviewBlock[]) || []

    // JSON-LD schemas — auto-detect from blocks present
    const isHomepage = blocks.some(b => b.blockType === 'hero') && blocks[0]?.blockType === 'navigation'
    const jsonLdSchemas = generatePageSchemas({ blocks, site, page, isHomepage })

    // Heading hierarchy — compute levels for all blocks
    const allBlockTypes = blocks.map(b => b.blockType).filter(Boolean)

    return (
        <>
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
          /* Print — show all content, no animations */
          @media print {
            * { opacity: 1 !important; transform: none !important; animation: none !important; }
          }
        `}</style>

            {/* No-JS fallback — Framer Motion initial="hidden" sets opacity:0 */}
            <noscript>
                <style>{`[style*="opacity: 0"], [style*="opacity:0"] { opacity: 1 !important; transform: none !important; }`}</style>
            </noscript>

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

                const headingLevel = getBlockHeadingLevel(block.blockType, allBlockTypes)

                return (
                    <BlockErrorBoundary key={`${block.blockType}-${index}`} blockType={block.blockType}>
                        <HeadingProvider level={headingLevel}>
                            <BlockComponent block={normalizedBlock} theme={theme} site={site} page={page} />
                        </HeadingProvider>
                    </BlockErrorBoundary>
                )
            })}
        </>
    )
}
