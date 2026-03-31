import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'

// Prevent static prerender — SiteRenderer imports block registry which
// pulls in isomorphic-dompurify/jsdom that fails in Docker standalone builds.
export const dynamic = 'force-dynamic'

export default function TestBlocksPage() {
    const site = {
        theme: {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            backgroundColor: '#09090b',
            fontHeading: 'Outfit',
            fontBody: 'Inter',
            colorMode: 'dark' as const,
        }
    }

    const page = {
        layout: [
            {
                blockType: 'custom-html',
                html: '<h2 style="text-align:center">Custom HTML Block</h2><p style="text-align:center">This is rendered safely with DOMPurify.</p>'
            },
            {
                blockType: 'products-grid',
                headline: 'Products Grid (grid-3)',
                variant: 'grid-3',
                limit: 3
            },
            {
                blockType: 'products-featured',
                headline: 'Featured Product (hero-product)',
                variant: 'hero-product'
            },
            {
                blockType: 'blog-list',
                headline: 'Blog List (cards)',
                variant: 'cards',
                limit: 3
            }
        ]
    }

    return (
        <div className="bg-black text-white min-h-screen">
            <SiteRenderer site={site} page={page} />
        </div>
    )
}
