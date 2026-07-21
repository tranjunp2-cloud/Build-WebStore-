import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { I18nProvider } from '@/i18n'

// Prevent static prerender — SiteRenderer imports block registry which
// pulls in isomorphic-dompurify/jsdom that fails in Docker standalone builds.
export const dynamic = 'force-dynamic'

export default function TestBlocksPage() {
    const site = {
        id: 1,
        name: 'Test Blocks',
        tenantSlug: 'test-blocks',
        siteBasePath: '/test-blocks',
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
                blockType: 'products-grid',
                headline: 'Products Grid Filters Harness',
                variant: 'grid-3',
                limit: 6,
                showCategoryFilter: true,
            }
        ]
    }

    return (
        <I18nProvider>
            <div className="bg-black text-white min-h-screen">
                <SiteRenderer site={site} page={page} />
            </div>
        </I18nProvider>
    )
}
