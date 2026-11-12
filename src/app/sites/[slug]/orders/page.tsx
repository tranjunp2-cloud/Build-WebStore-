import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { STOREFRONT_POPULATE } from '@/lib/cache/tenant'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { OT_CSS } from './[orderNumber]/order-tracking-styles'
import OrderLookupClient from './OrderLookupClient'

// Private order-lookup page — keep out of the search index.
export const metadata = { robots: { index: false, follow: false } }

export default async function OrderLookupPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const payload = await getPayload({ config })

    const tenantResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
        depth: 0,
    })
    const tenant = tenantResult.docs[0] as any
    if (!tenant) notFound()

    const siteResult = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
        populate: STOREFRONT_POPULATE,
        overrideAccess: true,
        depth: 1,
    })
    const site = siteResult.docs[0] as any
    if (!site) notFound()

    const siteTheme = site.theme ?? null
    const themeCSS = siteTheme
        ? generateThemeCSS(resolveTheme({
            primaryColor: siteTheme.primaryColor,
            secondaryColor: siteTheme.secondaryColor,
            accentColor: siteTheme.accentColor,
            surfaceColor: siteTheme.surfaceColor,
            textColor: siteTheme.textColor,
            mutedColor: siteTheme.mutedColor,
            fontPairingId: siteTheme.fontPairingId,
            fontHeading: siteTheme.fontHeading,
            fontBody: siteTheme.fontBody,
            colorMode: siteTheme.colorMode,
            backgroundColor: siteTheme.backgroundColor,
        }))
        : ''

    const thFontHeading = siteTheme?.fontHeading ?? 'Outfit'
    const thFontBody = siteTheme?.fontBody ?? 'Inter'
    const sanitizeFont = (f: string) => f.replace(/[^a-zA-Z0-9 -]/g, '')
    const fonts = [thFontHeading, thFontBody]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(sanitizeFont)
    const googleFontsHref = `https://fonts.googleapis.com/css2?${fonts.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;500;600;700;800;900`).join('&')}&subset=latin,vietnamese&display=swap`

    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href={googleFontsHref} />
            {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
            <style dangerouslySetInnerHTML={{ __html: OT_CSS }} />
            <OrderLookupClient slug={slug} siteName={site.name ?? ''} />
        </>
    )
}
