import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/i18n'

// Prevent static prerender — SiteRenderer imports block registry which
// pulls in isomorphic-dompurify/jsdom that fails in Docker standalone builds.
export const dynamic = 'force-dynamic'

export default async function TestBlocksPage({ searchParams }: { searchParams: Promise<{ quickView?: string }> }) {
    const quickView = (await searchParams).quickView === '1'
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
                blockType: quickView ? 'product-quick-view' : 'products-grid',
                headline: quickView ? 'Product Quick View Harness' : 'Products Grid Filters Harness',
                variant: quickView ? 'grid' : 'grid-3',
                limit: 6,
                showCategoryFilter: true,
            }
        ]
    }

    return (
        <AppShell>
            <I18nProvider>
                <div className="min-h-screen bg-black text-white">
                    <SiteRenderer site={site} page={page} />
                </div>
            </I18nProvider>
        </AppShell>
    )
}
