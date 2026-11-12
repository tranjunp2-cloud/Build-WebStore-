import type { Payload } from 'payload'
import { normalizeDashboardBlocks } from '@/lib/dashboard-utils'

export const DASHBOARD_FIXTURE_CAPABILITY = 'dashboard-fixture-v2'

const DASHBOARD_SITE_NAME = 'E2E Dashboard Fixture'
const DASHBOARD_ORDER_PREFIX = 'E2E-DASHBOARD-PENDING'
const DASHBOARD_ORDER_TOTAL = 107.8

export type DashboardFixtureTenant = {
    id: string | number
    slug?: string
    settings?: unknown
}

function dashboardPreferencesWithOrders(raw: unknown) {
    const savedPreferences = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === 'string')
        : undefined
    const preferences = normalizeDashboardBlocks(savedPreferences)
    return preferences.includes('orders') ? preferences : [...preferences, 'orders' as const]
}

export async function ensureDashboardFixture(
    payload: Payload,
    tenant: DashboardFixtureTenant,
) {
    const tenantId = tenant.id
    const orderNumber = `${DASHBOARD_ORDER_PREFIX}-${String(tenantId)}`
    const settings = tenant.settings && typeof tenant.settings === 'object' && !Array.isArray(tenant.settings)
        ? tenant.settings as Record<string, unknown>
        : {}
    await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: {
            settings: {
                ...settings,
                dashboardPreferences: dashboardPreferencesWithOrders(settings.dashboardPreferences),
            },
        },
        overrideAccess: true,
    })

    const sitesResult = await payload.find({
        collection: 'sites',
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { name: { equals: DASHBOARD_SITE_NAME } },
            ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })

    let siteId: string | number
    if (sitesResult.docs.length > 0) {
        siteId = sitesResult.docs[0].id
        await payload.update({
            collection: 'sites',
            id: siteId,
            data: { generationStatus: 'completed' },
            overrideAccess: true,
        })
    } else {
        const site = await payload.create({
            collection: 'sites',
            data: {
                tenant: tenantId,
                name: DASHBOARD_SITE_NAME,
                status: 'published',
                siteType: 'ecommerce',
                generationStatus: 'completed',
            },
            overrideAccess: true,
        })
        siteId = site.id
    }

    const productToken = String(tenantId)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
    const productData = {
        tenant: tenantId,
        site: siteId,
        name: 'E2E Dashboard Product',
        slug: `e2e-dashboard-product-${productToken}`,
        price: 49.9,
        sku: `E2E-DASHBOARD-PRODUCT-${productToken}`.toUpperCase(),
        inventory: 10,
        weight: 0.5,
        hasVariants: false,
        seo: {
            title: 'E2E Dashboard Product',
            description: 'Deterministic product fixture for dashboard E2E tests.',
        },
        status: 'active' as const,
    }
    const productsResult = await payload.find({
        collection: 'products',
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { slug: { equals: productData.slug } },
            ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })

    let productId: string | number
    if (productsResult.docs.length > 0) {
        productId = productsResult.docs[0].id
        await payload.update({
            collection: 'products',
            id: productId,
            data: productData,
            overrideAccess: true,
        })
    } else {
        const product = await payload.create({
            collection: 'products',
            data: productData,
            overrideAccess: true,
        })
        productId = product.id
    }

    // Recreate the dedicated fixture so createdAt always belongs to the current
    // dashboard period and a failed prior run cannot leak status into this one.
    const previousOrders = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { tenant: { equals: tenantId } },
                { orderNumber: { equals: orderNumber } },
            ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })
    for (const order of previousOrders.docs) {
        await payload.delete({
            collection: 'orders',
            id: order.id,
            overrideAccess: true,
        })
    }

    const order = await payload.create({
        collection: 'orders',
        data: {
            tenant: tenantId,
            site: siteId,
            orderNumber,
            items: [{
                product: productId,
                productName: 'E2E Dashboard Product',
                quantity: 2,
                unitPrice: 49.9,
            }],
            subtotal: 99.8,
            shippingFee: 8,
            tax: 0,
            total: DASHBOARD_ORDER_TOTAL,
            currency: 'MYR',
            status: 'pending',
            paymentMethod: 'cod',
            paymentStatus: 'unpaid',
            customerName: 'E2E Dashboard Buyer',
            customerEmail: 'dashboard-fixture@example.invalid',
        },
        overrideAccess: true,
    })

    return {
        orderId: order.id,
        orderNumber,
        orderTotal: DASHBOARD_ORDER_TOTAL,
    }
}
