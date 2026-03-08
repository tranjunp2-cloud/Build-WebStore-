import { blockRegistry } from '@/blocks/registry'
import { BlockErrorBoundary } from '@/blocks/ErrorBoundary'
import type { ThemeConfig } from '@/blocks/types'

// ── SiteRenderer — renders all blocks for a page using block registry ────────

type SiteRendererProps = {
    site: any
    page: any
}

export function SiteRenderer({ site, page }: SiteRendererProps) {
    const theme: ThemeConfig = {
        primaryColor: site.theme?.primaryColor || '#0ea5e9',
        secondaryColor: site.theme?.secondaryColor || '#d946ef',
        backgroundColor: site.theme?.backgroundColor || '#09090b',
        fontHeading: site.theme?.fontHeading || 'Outfit',
        fontBody: site.theme?.fontBody || 'Inter',
        colorMode: site.theme?.colorMode || 'dark',
    }

    const blocks: any[] = page.layout || []

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href={`https://fonts.googleapis.com/css2?family=${theme.fontHeading.replace(/ /g, '+')}:wght@400;600;700;900&family=${theme.fontBody.replace(/ /g, '+')}:wght@400;500;600&display=swap`}
                    rel="stylesheet"
                />
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
            </head>
            <body>
                {blocks.map((block, index) => {
                    if (!block.blockType) return null

                    const BlockComponent = blockRegistry.getComponent(block.blockType)
                    if (!BlockComponent) {
                        // Unknown block type — skip silently (AC-6)
                        return null
                    }

                    return (
                        <BlockErrorBoundary key={`${block.blockType}-${index}`} blockType={block.blockType}>
                            <BlockComponent block={block} theme={theme} />
                        </BlockErrorBoundary>
                    )
                })}
            </body>
        </html>
    )
}

