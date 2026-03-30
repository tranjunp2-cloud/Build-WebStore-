import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'
import { filterNavigationLinksByVisibility } from '@/lib/navigation'

// ── SiteRenderer — renders all blocks for a page using block registry ────────

type NavPage = { id: string | number; slug: string; isVisible?: boolean; deletedAt?: string | null }

type SiteRendererProps = {
    site: Record<string, any>
    page: Record<string, any>
    pages?: NavPage[]
}

export function SiteRenderer({ site, page, pages = [] }: SiteRendererProps) {
    const theme: ThemeConfig = {
        primaryColor: site.theme?.primaryColor || '#0ea5e9',
        secondaryColor: site.theme?.secondaryColor || '#d946ef',
        backgroundColor: site.theme?.backgroundColor || '#09090b',
        fontHeading: site.theme?.fontHeading || 'Outfit',
        fontBody: site.theme?.fontBody || 'Inter',
        colorMode: site.theme?.colorMode || 'dark',
    }

    type PreviewBlock = { blockType: string; links?: any; [key: string]: any }
    const blocks: PreviewBlock[] = page?.layout || []

    return (
        <>
            <style>{`
          :root {
            --brand-primary: ${theme.primaryColor};
            --brand-secondary: ${theme.secondaryColor};
            --font-heading: '${theme.fontHeading}', sans-serif;
            --font-body: '${theme.fontBody}', sans-serif;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html { scroll-behavior: smooth; }
          body {
            font-family: var(--font-body);
            background: ${theme.colorMode === 'dark' ? '#09090b' : '#ffffff'};
            color: ${theme.colorMode === 'dark' ? '#fafafa' : '#09090b'};
          }
          h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
          .container { max-width: 1200px; margin: 0 auto; }
          img { max-width: 100%; height: auto; }
          a { color: inherit; text-decoration: none; }
        `}</style>
            
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

                return (
                    <BlockErrorBoundary key={`${block.blockType}-${index}`} blockType={block.blockType}>
                        <BlockComponent block={normalizedBlock} theme={theme} site={site} page={page} />
                    </BlockErrorBoundary>
                )
            })}
        </>
    )
}
