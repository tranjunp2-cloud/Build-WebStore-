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
    stripeEnabled: boolean
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
                select: { id: true, stripeOnboardingComplete: true } as any,
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
                initialSiteData = {
                    siteId: String(site.id),
                    tenantId: String(tenant.id),
                    merchantQrCodeUrl: merchantQrCode && typeof merchantQrCode === 'object'
                        ? (merchantQrCode.url ?? null)
                        : null,
                    enableCod: paymentConfig?.enableCod ?? true,
                    enableQrBanking: paymentConfig?.enableQrBanking ?? true,
                    bankName: paymentConfig?.bankName ?? null,
                    bankAccountNo: paymentConfig?.bankAccountNo ?? null,
                    bankAccountHolder: paymentConfig?.bankAccountHolder ?? null,
                    shippingConfig: (site as any).shippingConfig ?? null,
                    cardEnabled: paymentConfig?.cardEnabled !== false,
                    fpxEnabled: paymentConfig?.fpxEnabled !== false,
                    stripeEnabled: Boolean((tenantFull as any)?.stripeOnboardingComplete),
                }
            }
        }
    } catch {
        // Fail silently — CheckoutClient falls back to client-side fetch
    }

    return (
        <CheckoutClient
            slug={slug}
            initialThemeCSS={initialThemeCSS}
            initialFontHeading={initialFontHeading}
            initialFontBody={initialFontBody}
            initialSiteData={initialSiteData}
        />
    )
}
