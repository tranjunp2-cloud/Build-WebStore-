import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { generateUploadToken } from '@/lib/orders/upload-token'
import ConfirmClient, { type ConfirmOrder } from './ConfirmClient'

export default async function OrderConfirmPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>
}) {
    const { slug, id } = await params
    const payload = await getPayload({ config })
    const orderId = isNaN(Number(id)) ? id : Number(id)

    // Resolve tenant slug → tenant → site (sites collection has no slug field)
    const tenantResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
        depth: 0,
    })
    const tenant = tenantResult.docs[0]
    if (!tenant) notFound()

    const siteResult = await payload.find({
        collection: 'sites',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
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

    const thFontHeading = siteTheme?.fontHeading || 'Outfit'
    const thFontBody = siteTheme?.fontBody || 'Inter'
    const sanitizeFont = (f: string) => f.replace(/[^a-zA-Z0-9 -]/g, '')
    const fonts = [thFontHeading, thFontBody].filter((v, i, a) => a.indexOf(v) === i).map(sanitizeFont)
    const googleFontsHref = `https://fonts.googleapis.com/css2?${fonts.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;500;600;700;800;900`).join('&')}&subset=latin,vietnamese&display=swap`

    const pc = site.paymentConfig ?? {}
    const bankName: string = pc.bankName ?? ''
    const bankAccountNo: string = pc.bankAccountNo ?? ''
    const bankAccountHolder: string = pc.bankAccountHolder ?? ''
    const _qr = pc.merchantQrCode
    const merchantQrUrl: string = (_qr && typeof _qr === 'object') ? (_qr.url ?? '') : ''

    let order: ConfirmOrder | null = null
    try {
        const result = await payload.find({
            collection: 'orders',
            where: { id: { equals: orderId }, site: { equals: site.id } },
            limit: 1,
            overrideAccess: true,
            depth: 2, // depth:2 to resolve items[].product.images[].image.url
        })
        const raw = result.docs[0] as any
        if (raw) {
            order = {
                id: raw.id,
                orderNumber: raw.orderNumber,
                items: (raw.items ?? []).map((item: any) => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    variant: item.variant,
                    imageUrl: item.product?.images?.[0]?.image?.url ?? undefined,
                })),
                subtotal: raw.subtotal,
                shippingFee: raw.shippingFee,
                tax: raw.tax,
                total: raw.total,
                currency: raw.currency,
                paymentMethod: raw.paymentMethod,
                stripePaymentIntentId: raw.stripePaymentIntentId,
                customerName: raw.customerName,
                customerEmail: raw.customerEmail,
                shippingAddress: raw.shippingAddress,
            }
        }
    } catch { }
    if (!order) notFound()

    const uploadToken = generateUploadToken(order.id)

    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href={googleFontsHref} />
            {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
            <ConfirmClient
                order={order}
                slug={slug}
                bankName={bankName}
                bankAccountNo={bankAccountNo}
                bankAccountHolder={bankAccountHolder}
                merchantQrUrl={merchantQrUrl}
                uploadToken={uploadToken}
            />
        </>
    )
}
