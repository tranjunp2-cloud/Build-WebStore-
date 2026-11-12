/**
 * The hot merchant/visitor requests scripts/perf/measure-hot-requests.ts measures. Ids default to the demo tenant
 * (tenant 1, user 3) of the staging-host copy; override with env NPLUS1_* when measuring another shop.
 */
import type { Payload } from 'payload'
import type { Scenario } from './measure-hot-requests'
import { renderTree } from './render-tree'

const env = (name: string, fallback: string) => process.env[name] ?? fallback
const SITE_ID = env('NPLUS1_SITE_ID', '1')
const SITE_SLUG = env('NPLUS1_SITE_SLUG', 'luma-botanics-demo')
const ORDER_ID = env('NPLUS1_ORDER_ID', '13')
const CUSTOMER_ID = Number(env('NPLUS1_CUSTOMER_ID', '3'))
const PRODUCT_ID = env('NPLUS1_PRODUCT_ID', '1')
const PRODUCT_SLUG = env('NPLUS1_PRODUCT_SLUG', 'avocado-toast')
const BLOG_ID = env('NPLUS1_BLOG_ID', '18')

const params = <T extends Record<string, unknown>>(value: T) => ({ params: Promise.resolve(value) })

export function scenarios(_payload: Payload): Scenario[] {
    return [
        {
            name: 'dashboard (layout+page)',
            reset: async () => {
                const m = await import('@/lib/dashboard/sidebar-badge-counts-cached')
                ;(m as { __resetSidebarBadgeCache?: () => void }).__resetSidebarBadgeCache?.()
            },
            run: async () => {
                const Layout = (await import('@/app/(dashboard)/layout')).default
                const Page = (await import('@/app/(dashboard)/dashboard/page')).default
                await Promise.all([
                    renderTree(Layout({ children: null })),
                    renderTree(Page({ searchParams: Promise.resolve({}) })),
                ])
            },
        },
        {
            name: 'products list (action)',
            run: async () => {
                const { getProductsPageAction } = await import('@/app/(dashboard)/products/actions')
                const r = await getProductsPageAction({ page: 1, limit: 25, status: 'all', search: '' })
                if ((r as { success?: boolean }).success === false) throw new Error(JSON.stringify(r).slice(0, 200))
                return r
            },
        },
        {
            name: 'products search (action)',
            run: async () => {
                const { getProductsPageAction } = await import('@/app/(dashboard)/products/actions')
                return getProductsPageAction({ page: 1, limit: 25, status: 'all', search: 'shirt' })
            },
        },
        {
            name: 'products categories (action)',
            run: async () => {
                const { getCategoriesAction } = await import('@/app/(dashboard)/products/categories/actions').catch(
                    () => import('@/app/(dashboard)/products/actions') as never,
                )
                return (getCategoriesAction as () => Promise<unknown>)()
            },
        },
        {
            name: 'product edit load (action)',
            run: async () => {
                const { getProductAction } = await import('@/app/(dashboard)/products/actions')
                return getProductAction(PRODUCT_ID)
            },
        },
        {
            name: 'GET /api/orders',
            run: async (ctx) => {
                const { GET } = await import('@/app/api/orders/route')
                return GET(ctx.request('/api/orders?page=1&limit=20&sort=-createdAt'), undefined as never)
            },
        },
        {
            name: 'GET /api/orders (awaiting chip)',
            run: async (ctx) => {
                const { GET } = await import('@/app/api/orders/route')
                return GET(ctx.request('/api/orders?paymentStatus=pending_verification&paymentMethod=bank_transfer&limit=0'), undefined as never)
            },
        },
        {
            name: 'GET /api/orders/metrics',
            run: async (ctx) => {
                const { GET } = await import('@/app/api/orders/metrics/route')
                return (GET as (r: Request) => Promise<Response>)(ctx.request('/api/orders/metrics'))
            },
        },
        {
            name: 'GET /api/orders/:id',
            run: async (ctx) => {
                const { GET } = await import('@/app/api/orders/[id]/route')
                return GET(ctx.request(`/api/orders/${ORDER_ID}?depth=2`), params({ id: ORDER_ID }) as never)
            },
        },
        {
            name: 'customers list (action)',
            run: async () => {
                const { getShopCustomersAction } = await import('@/app/(dashboard)/customers/actions')
                return getShopCustomersAction({})
            },
        },
        {
            name: 'customer detail (action)',
            run: async () => {
                const { getShopCustomerDetailAction, getCustomerOrdersAction } = await import('@/app/(dashboard)/customers/actions')
                return Promise.all([getShopCustomerDetailAction(CUSTOMER_ID), getCustomerOrdersAction(CUSTOMER_ID, 1)])
            },
        },
        {
            name: 'GET /api/v1/discounts',
            run: async (ctx) => {
                const { GET } = await import('@/app/api/v1/discounts/route')
                return GET(ctx.request('/api/v1/discounts?page=1&limit=20'), undefined as never)
            },
        },
        {
            name: 'blog list (action)',
            run: async () => {
                const { listBlogsAction } = await import('@/app/(dashboard)/blog/actions')
                return listBlogsAction({ page: 1, limit: 20 } as never)
            },
        },
        {
            name: 'blog editor load (page)',
            run: async () => {
                const Page = (await import('@/app/(dashboard)/blog/[id]/page')).default
                await renderTree((Page as (p: unknown) => unknown)({ params: Promise.resolve({ id: BLOG_ID }) }))
            },
        },
        {
            name: 'GET /api/sites/:id/editor-data',
            run: async (ctx) => {
                const { GET } = await import('@/app/api/sites/[siteId]/editor-data/route')
                return GET(ctx.request(`/api/sites/${SITE_ID}/editor-data`), params({ siteId: SITE_ID }))
            },
        },
        {
            name: 'GET /api/notifications',
            run: async (ctx) => {
                const { GET } = await import('@/app/api/notifications/route')
                return GET(ctx.request('/api/notifications?limit=20'), undefined as never)
            },
        },
        {
            name: 'GET /api/auth/session-check',
            run: async (ctx) => {
                const { GET } = await import('@/app/api/auth/session-check/route')
                return (GET as (r: Request) => Promise<Response>)(ctx.request('/api/auth/session-check'))
            },
        },
        {
            name: 'storefront home',
            anonymous: true,
            run: async () => {
                const Page = (await import('@/app/sites/[slug]/[[...path]]/page')).default
                await renderTree((Page as (p: unknown) => unknown)({ params: Promise.resolve({ slug: SITE_SLUG }), searchParams: Promise.resolve({}) }))
            },
        },
        {
            name: 'storefront product',
            anonymous: true,
            run: async () => {
                const Page = (await import('@/app/sites/[slug]/products/[productSlug]/page')).default
                await renderTree((Page as (p: unknown) => unknown)({
                    params: Promise.resolve({ slug: SITE_SLUG, productSlug: PRODUCT_SLUG }),
                    searchParams: Promise.resolve({}),
                }))
            },
        },
        {
            name: 'storefront sitemap.xml',
            anonymous: true,
            run: async (ctx) => {
                const { GET } = await import('@/app/sites/[slug]/sitemap.xml/route')
                return (GET as (r: Request, c: unknown) => Promise<Response>)(ctx.request(`/sites/${SITE_SLUG}/sitemap.xml`), params({ slug: SITE_SLUG }))
            },
        },
    ]
}
