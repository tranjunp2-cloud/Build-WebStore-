import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * GET /api/storefront/site-by-slug?slug=xxx
 * Public endpoint — resolves tenant slug to siteId + tenantId + payment config.
 * Returns both layers of payment config so the storefront can render the correct UI.
 */
export async function GET(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')?.trim()
            || 'unknown'
        const rateCheck = await checkRateLimit(`storefront-site:${ip}`, 30, 60_000)
        if (!rateCheck.allowed) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
            })
        }

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

        const tenantFull = await payload.findByID({
            collection: 'tenants',
            id: tenant.id,
            depth: 0,
            overrideAccess: true,
        })

        const siteResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenant.id } },
            limit: 1,
            depth: 1,
            select: { id: true, paymentConfig: true, shippingConfig: true, theme: true },
            overrideAccess: true,
        })

        const site = siteResult.docs[0]
        if (!site) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const paymentConfig = (site as any)?.paymentConfig ?? {}
        const tenantPayments = (tenantFull as any)?.payments ?? {}

        const merchantQrCode = paymentConfig?.merchantQrCode
        const merchantQrCodeUrl = merchantQrCode && typeof merchantQrCode === 'object'
            ? (merchantQrCode.url ?? null)
            : null

        // Layer 1 — tenant master flags (default false: must be explicitly enabled)
        const tenantCardEnabled = tenantPayments.payment_card === true
        const tenantFpxEnabled = tenantPayments.payment_fpx === true

        // Layer 2 — site-level guard (default true: permissive opt-out)
        const siteCardEnabled = paymentConfig.cardEnabled !== false
        const siteFpxEnabled = paymentConfig.fpxEnabled !== false

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

            // Layer 1 — tenant master flags
            tenant_payment_card: tenantCardEnabled,
            tenant_payment_fpx: tenantFpxEnabled,

            // Layer 2 — site-level guard
            site_card_enabled: siteCardEnabled,
            site_fpx_enabled: siteFpxEnabled,

            // Derived — what the storefront should render
            cardEnabled: tenantCardEnabled && siteCardEnabled,
            fpxEnabled: tenantFpxEnabled && siteFpxEnabled,

            stripeEnabled: (tenantFull as any)?.stripeOnboardingComplete === true,
        })
    } catch (error) {
        console.error('[Storefront site-by-slug]', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
