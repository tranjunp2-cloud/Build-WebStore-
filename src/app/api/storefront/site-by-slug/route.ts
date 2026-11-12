import { NextResponse } from 'next/server'
import { isTenantUnavailable } from '@/lib/storefront/store-availability'
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
            select: { id: true, status: true },
            overrideAccess: true,
        })

        const tenant = tenantResult.docs[0]
        // #2179: banned or expired store answers like an unknown one (no reason given)
        if (!tenant || await isTenantUnavailable(payload, tenant)) {
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
        // COD/QR: tenant master flag (false = explicitly disabled by seller in dashboard)
        const tenantCodEnabled = tenantPayments.payment_cod === true
        const tenantQrEnabled = tenantPayments.payment_qr === true

        // Layer 2 — site-level guard (default true: permissive opt-out) for card/FPX/COD.
        // Bank transfer (QR) has no site-level gate: tenant payment_qr alone decides (GH-2477;
        // site.paymentConfig.enableQrBanking is deprecated — PW1 migration hardcoded it false).
        const siteCardEnabled = paymentConfig.cardEnabled !== false
        const siteFpxEnabled = paymentConfig.fpxEnabled !== false

        return NextResponse.json({
            siteId: site.id,
            tenantId: tenant.id,
            merchantQrCodeUrl,
            enableCod: tenantCodEnabled && (paymentConfig?.enableCod ?? true),
            enableQrBanking: tenantQrEnabled,
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

            stripeConnected: !!((tenantFull as any)?.stripeAccountId),
            stripeEnabled: (tenantFull as any)?.stripeOnboardingComplete === true && (tenantCardEnabled || tenantFpxEnabled),
            hasPaymentMethods: !!(
                (tenantCodEnabled && (paymentConfig?.enableCod ?? true)) ||
                tenantQrEnabled ||
                ((tenantFull as any)?.stripeOnboardingComplete === true && (tenantCardEnabled || tenantFpxEnabled))
            ),
        })
    } catch (error) {
        console.error('[Storefront site-by-slug]', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
