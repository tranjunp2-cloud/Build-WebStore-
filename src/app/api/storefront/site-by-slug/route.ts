import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/storefront/site-by-slug?slug=xxx
 * Public endpoint — resolves tenant slug to siteId + tenantId.
 * Uses local Payload API (overrideAccess) to bypass restricted read access on Tenants collection.
 * Returns only the minimum fields needed; never exposes billing, subdomain, or other tenant data.
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url)
        const slug = url.searchParams.get('slug')?.trim()

        if (!slug || slug.length > 63) {
            return NextResponse.json({ error: 'slug is required' }, { status: 400 })
        }

        const payload = await getPayload({ config })

        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
            depth: 0,
            select: { id: true },
            overrideAccess: true,
        })

        const tenant = tenantResult.docs[0]
        if (!tenant) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const siteResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenant.id } },
            limit: 1,
            depth: 1,
            select: { id: true, paymentConfig: true, theme: true },
            overrideAccess: true,
        })

        const site = siteResult.docs[0]
        if (!site) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const paymentConfig = (site as any).paymentConfig
        const merchantQrCode = paymentConfig?.merchantQrCode
        const merchantQrCodeUrl = merchantQrCode && typeof merchantQrCode === 'object'
            ? (merchantQrCode.url ?? null)
            : null

        return NextResponse.json({
            siteId: site.id,
            tenantId: tenant.id,
            merchantQrCodeUrl,
            enableCod: paymentConfig?.enableCod ?? true,
            enableQrBanking: paymentConfig?.enableQrBanking ?? true,
            bankName: paymentConfig?.bankName ?? null,
            bankAccountNo: paymentConfig?.bankAccountNo ?? null,
            bankAccountHolder: paymentConfig?.bankAccountHolder ?? null,
            shippingConfig: (site as any).shippingConfig ?? null,
            theme: (site as any).theme ?? null,
        })
    } catch (error) {
        console.error('[Storefront site-by-slug]', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
