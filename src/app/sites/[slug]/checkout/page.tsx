import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { CheckoutClient } from './CheckoutClient'

// Force dynamic — reads request headers (custom domain) and DB at runtime
export const dynamic = 'force-dynamic'

type ShippingConfig = {
    westRate: number | null
    eastRate: number | null
    freeAbove: number | null
}

type InitialSiteData = {
    siteId: string
    tenantId: string
    merchantQrCodeUrl: string | null
    enableCod: boolean
    enableQrBanking: boolean
    bankName: string | null
    bankAccountNo: string | null
    bankAccountHolder: string | null
    shippingConfig: ShippingConfig | null
    cardEnabled: boolean
    fpxEnabled: boolean
    stripeConnected: boolean
    stripeEnabled: boolean
    hasPaymentMethods: boolean
}

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params

    let initialThemeCSS = ''
    let initialFontHeading = 'Outfit'
    let initialFontBody = 'Inter'
    let initialSiteData: InitialSiteData | null = null

    try {
        const reqHeaders = await headers()
        const payload = await getPayload({ config })

        // Resolve tenant (handles both subdomain slugs and custom domains)
        let tenant
        if (slug === 'custom') {
            const hostname = reqHeaders.get('x-tenant-hostname')
            if (hostname) {
                const r = await payload.find({
                    collection: 'tenants',
                    where: { 'customDomains.domain': { equals: hostname } },
                    limit: 1, depth: 0, select: { id: true }, overrideAccess: true,
                })
                tenant = r.docs[0]
            }
        } else {
            const r = await payload.find({
                collection: 'tenants',
                where: { slug: { equals: slug } },
                limit: 1, depth: 0, select: { id: true }, overrideAccess: true,
            })
            tenant = r.docs[0]
        }

        if (tenant) {
            const tenantFull = await payload.findByID({
                collection: 'tenants',
                id: tenant.id,
                depth: 0,
                overrideAccess: true,
            })

            const siteResult = await payload.find({
                collection: 'sites',
                where: { tenant: { equals: tenant.id } },
                limit: 1, depth: 1, select: { id: true, paymentConfig: true, shippingConfig: true, theme: true }, overrideAccess: true,
            })
            const site = siteResult.docs[0]

            if (site) {
                const theme = (site as any).theme
                if (theme) {
                    if (theme.fontHeading) initialFontHeading = theme.fontHeading
                    if (theme.fontBody) initialFontBody = theme.fontBody
                    const resolved = resolveTheme({
                        primaryColor: theme.primaryColor,
                        secondaryColor: theme.secondaryColor,
                        accentColor: theme.accentColor,
                        surfaceColor: theme.surfaceColor,
                        textColor: theme.textColor,
                        mutedColor: theme.mutedColor,
                        fontPairingId: theme.fontPairingId,
                        fontHeading: theme.fontHeading,
                        fontBody: theme.fontBody,
                        colorMode: theme.colorMode,
                        backgroundColor: theme.backgroundColor,
                    })
                    initialThemeCSS = generateThemeCSS(resolved)
                }

                const paymentConfig = (site as any).paymentConfig
                const merchantQrCode = paymentConfig?.merchantQrCode
                const tenantPayments = (tenantFull as any)?.payments ?? {}

                // Layer 1 — tenant master flags (default false: must be explicitly enabled)
                const tenantCardEnabled = tenantPayments.payment_card === true
                const tenantFpxEnabled = tenantPayments.payment_fpx === true
                const tenantCodEnabled = tenantPayments.payment_cod === true
                const tenantQrEnabled = tenantPayments.payment_qr === true

                // Layer 2 — site-level guard (default true: permissive opt-out)
                const siteCardEnabled = paymentConfig?.cardEnabled !== false
                const siteFpxEnabled = paymentConfig?.fpxEnabled !== false

                const codEnabled = tenantCodEnabled && (paymentConfig?.enableCod ?? true)
                const qrEnabled = tenantQrEnabled && (paymentConfig?.enableQrBanking ?? true)

                initialSiteData = {
                    siteId: String(site.id),
                    tenantId: String(tenant.id),
                    merchantQrCodeUrl: merchantQrCode && typeof merchantQrCode === 'object'
                        ? (merchantQrCode.url ?? null)
                        : null,
                    enableCod: codEnabled,
                    enableQrBanking: qrEnabled,
                    bankName: paymentConfig?.bankName ?? null,
                    bankAccountNo: paymentConfig?.bankAccountNo ?? null,
                    bankAccountHolder: paymentConfig?.bankAccountHolder ?? null,
                    shippingConfig: (site as any).shippingConfig ?? null,
                    cardEnabled: tenantCardEnabled && siteCardEnabled,
                    fpxEnabled: tenantFpxEnabled && siteFpxEnabled,
                    stripeConnected: !!((tenantFull as any)?.stripeAccountId),
                    stripeEnabled: (tenantFull as any)?.stripeOnboardingComplete === true && (tenantCardEnabled || tenantFpxEnabled),
                    hasPaymentMethods: !!(
                        codEnabled ||
                        qrEnabled ||
                        // Only count Stripe if it can actually accept payments
                        ((tenantFull as any)?.stripeOnboardingComplete === true && (tenantCardEnabled || tenantFpxEnabled))
                    ),
                }
            }
        }
    } catch {
        // Fail silently — CheckoutClient falls back to client-side fetch
    }

    return (
        <>
            {/* Runs during HTML parse — before checkout paints — so Browser Back from Stripe
                redirects to the confirm page (Pay Now) with no flash of the checkout form.
                Covers the no-store fresh-load path; bfcache restores are handled by a pageshow
                listener in CheckoutClient. The flag is set right before redirecting to Stripe. */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `(function(){try{var r=sessionStorage.getItem('pw_stripe_pending');if(r){sessionStorage.removeItem('pw_stripe_pending');var d=JSON.parse(r);if(d&&d.orderId&&d.slug){location.replace('/sites/'+encodeURIComponent(d.slug)+'/order/'+encodeURIComponent(d.orderId)+'/confirm?cancelled=1');}}}catch(e){}})();`,
                }}
            />
            <CheckoutClient
                slug={slug}
                initialThemeCSS={initialThemeCSS}
                initialFontHeading={initialFontHeading}
                initialFontBody={initialFontBody}
                initialSiteData={initialSiteData}
            />
        </>
    )
}
