import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimit'
import { resolveProductLine, type ProductLineProduct } from '@/lib/products/resolve-product-line'

const MAX_CART_ITEMS = 50
const MAX_QUANTITY = 100
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
const SERVER_DOMAIN = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/^https?:\/\//, '').split(':')[0]

const cartResolveBodySchema = z.object({
    siteId: z.coerce.number().int().positive(),
    // Required for local direct URLs where the Host header is localhost rather than a tenant domain.
    siteSlug: z.string().trim().min(1).max(63).regex(/^[a-z0-9-]+$/),
    items: z.array(z.object({
        productId: z.coerce.number().int().positive(),
        variant: z.string().trim().min(1).max(120).optional(),
        quantity: z.number().int().positive().max(MAX_QUANTITY),
        snapshot: z.object({
            name: z.string().optional(),
            price: z.number().optional(),
            compareAtPrice: z.number().nullable().optional(),
            imageUrl: z.string().nullable().optional(),
            inventory: z.number().nullable().optional(),
        }).optional(),
    })).min(1).max(MAX_CART_ITEMS),
})

type CartResolveBody = z.infer<typeof cartResolveBodySchema>
type TenantSelector = { slug?: string; domain?: string }

function requestIp(req: Request): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')?.trim()
        || 'unknown'
}

function requestHostname(req: Request): string {
    return (req.headers.get('host') || '').split(':')[0].trim().toLowerCase()
}

/**
 * API routes bypass the storefront middleware rewrite, so resolve a tenant from Host directly.
 * The body slug is only a local/direct-URL fallback and is still bound to the requested site.
 */
function tenantSelectorForRequest(req: Request, siteSlug: string): TenantSelector {
    const hostname = requestHostname(req)
    const platformSuffix = `.${PLATFORM_DOMAIN}`
    const adminDomain = process.env.NEXT_PUBLIC_ADMIN_DOMAIN || `admin.${PLATFORM_DOMAIN}`

    if (
        hostname.endsWith(platformSuffix)
        && hostname !== `www.${PLATFORM_DOMAIN}`
        && hostname !== adminDomain
    ) {
        return { slug: hostname.slice(0, -platformSuffix.length) }
    }

    const isLocalOrPlatformHost = !hostname
        || hostname === PLATFORM_DOMAIN
        || hostname === `www.${PLATFORM_DOMAIN}`
        || hostname === SERVER_DOMAIN
        || hostname.includes('localhost')
        || hostname.includes('127.0.0.1')
        || hostname.endsWith('.vercel.app')

    return isLocalOrPlatformHost ? { slug: siteSlug } : { domain: hostname }
}

function changedFields(
    snapshot: CartResolveBody['items'][number]['snapshot'],
    canonical: { name: string; price: number; compareAtPrice?: number; imageUrl?: string; inventory: number | null; quantity: number },
) {
    if (!snapshot) return [] as string[]
    const changed: string[] = []
    if (snapshot.name !== undefined && snapshot.name !== canonical.name) changed.push('name')
    if (snapshot.price !== undefined && snapshot.price !== canonical.price) changed.push('price')
    if ((snapshot.compareAtPrice ?? null) !== (canonical.compareAtPrice ?? null)) changed.push('compareAtPrice')
    if ((snapshot.imageUrl ?? null) !== (canonical.imageUrl ?? null)) changed.push('imageUrl')
    if ((snapshot.inventory ?? null) !== canonical.inventory) changed.push('inventory')
    return changed
}

/**
 * POST /api/storefront/cart/resolve
 *
 * Advisory cart refresh. It returns only current storefront-safe Product fields; order creation
 * still recalculates product prices and stock authoritatively on the server.
 */
export async function POST(req: Request) {
    const rateCheck = await checkRateLimit(`storefront-cart-resolve:${requestIp(req)}`, 30, 60_000)
    if (!rateCheck.allowed) {
        return NextResponse.json({ lines: [] }, {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
        })
    }

    let body: CartResolveBody
    try {
        body = cartResolveBodySchema.parse(await req.json())
    } catch {
        return NextResponse.json({ error: 'Invalid cart request' }, { status: 400 })
    }

    try {
        const payload = await getPayload({ config })
        const tenantSelector = tenantSelectorForRequest(req, body.siteSlug)
        const tenantResult = await payload.find({
            collection: 'tenants',
            where: tenantSelector.slug
                ? { slug: { equals: tenantSelector.slug } }
                : { 'customDomains.domain': { equals: tenantSelector.domain } },
            limit: 1,
            depth: 0,
            select: { id: true, customDomains: true },
            overrideAccess: true,
        })
        const tenant = tenantResult.docs[0]
        if (!tenant) return NextResponse.json({ lines: [] })
        if (tenantSelector.domain) {
            const customDomains = Array.isArray(tenant.customDomains) ? tenant.customDomains : []
            const activeDomain = customDomains.some(domain =>
                domain?.domain === tenantSelector.domain && domain?.status === 'active'
            )
            if (!activeDomain) return NextResponse.json({ lines: [] })
        }

        const siteResult = await payload.find({
            collection: 'sites',
            where: {
                and: [
                    { id: { equals: body.siteId } },
                    { tenant: { equals: tenant.id } },
                    { status: { equals: 'published' } },
                ],
            },
            limit: 1,
            depth: 0,
            select: { id: true },
            overrideAccess: true,
        })
        if (!siteResult.docs[0]) return NextResponse.json({ lines: [] })

        const productIds = [...new Set(body.items.map(item => item.productId))]
        const where: Where = {
            and: [
                { id: { in: productIds } },
                { site: { equals: body.siteId } },
                { tenant: { equals: tenant.id } },
                { status: { equals: 'active' } },
                { deletedAt: { exists: false } },
            ],
        }
        const products = await payload.find({
            collection: 'products',
            where,
            limit: productIds.length,
            depth: 1,
            overrideAccess: true,
        })
        const productsById = new Map(products.docs.map(product => [String(product.id), product as unknown as ProductLineProduct]))

        const lines = body.items.map(item => {
            const product = productsById.get(String(item.productId))
            if (!product) {
                return { productId: item.productId, variant: item.variant ?? null, available: false, reason: 'unavailable' as const }
            }

            const resolved = resolveProductLine(product, item, { stockPolicy: 'clamp' })
            if (!resolved.ok) {
                return { productId: item.productId, variant: item.variant ?? null, available: false, reason: 'unavailable' as const }
            }

            const canonical = {
                name: product.name,
                slug: product.slug ?? '',
                price: resolved.unitPrice,
                compareAtPrice: resolved.compareAtPrice,
                currency: product.currency || 'MYR',
                imageUrl: resolved.imageUrl,
                inventory: resolved.stock,
                quantity: resolved.quantity,
            }
            return {
                productId: item.productId,
                variant: item.variant ?? null,
                available: true,
                product: canonical,
                changed: changedFields(item.snapshot, canonical),
            }
        })

        return NextResponse.json({ lines })
    } catch (error) {
        console.error('[POST /api/storefront/cart/resolve]', error)
        return NextResponse.json({ error: 'Unable to refresh cart' }, { status: 500 })
    }
}
