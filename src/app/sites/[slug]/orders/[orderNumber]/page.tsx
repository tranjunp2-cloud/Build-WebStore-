import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { verifyOrderToken } from '@/lib/auth/order-token'
import { generateUploadToken } from '@/lib/orders/upload-token'
import OrderTrackingClient from './OrderTrackingClient'
import { OT_CSS } from './order-tracking-styles'
import ResendUploadLinkForm from './ResendUploadLinkForm'
import BankTransferUploadClient from './BankTransferUploadClient'

const UPLOAD_STATUSES = new Set(['awaiting_payment', 'pending_verification'])

export default async function OrderTrackingPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string; orderNumber: string }>
    searchParams: Promise<{ token?: string }>
}) {
    const [{ slug, orderNumber }, sp] = await Promise.all([params, searchParams])
    const token = sp.token ?? ''
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
        overrideAccess: true,
        depth: 1,
    })
    const site = siteResult.docs[0] as any
    if (!site) notFound()

    let order: any = null
    try {
        const result = await payload.find({
            collection: 'orders',
            where: { orderNumber: { equals: orderNumber }, site: { equals: site.id } },
            limit: 1,
            overrideAccess: true,
            depth: 2,
        })
        order = result.docs[0] ?? null
    } catch { /* order stays null */ }
    if (!order) notFound()

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

    const fontLinks = (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href={googleFontsHref} />
            {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
        </>
    )

    // Bank transfer pending payment — show upload interface or resend form
    const isBtPending =
        order.paymentMethod === 'bank_transfer' &&
        UPLOAD_STATUSES.has(order.paymentStatus ?? '')

    if (isBtPending) {
        // When arriving with a magic link token and payment still awaiting, validate and show upload UI
        if (token && order.paymentStatus === 'awaiting_payment' && order.magicLinkSecret) {
            const verified = await verifyOrderToken({ token, secret: order.magicLinkSecret })
            if (verified.ok) {
                const uploadToken = generateUploadToken(order.id)
                const pc = (tenant as any).payments ?? {}
                const qrImage = pc.qr_image
                const merchantQrUrl: string = (qrImage && typeof qrImage === 'object') ? (qrImage.url ?? '') : ''
                return (
                    <>
                        {fontLinks}
                        <style dangerouslySetInnerHTML={{ __html: OT_CSS }} />
                        <BankTransferUploadClient
                            orderId={order.id}
                            orderNumber={order.orderNumber}
                            total={order.total ?? 0}
                            currency={order.currency ?? 'MYR'}
                            paymentExpiresAt={order.paymentExpiresAt ?? null}
                            bankName={pc.bank_name ?? ''}
                            bankAccountNo={pc.account_number ?? ''}
                            bankAccountHolder={pc.account_holder_name ?? ''}
                            merchantQrUrl={merchantQrUrl}
                            uploadToken={uploadToken}
                            shopName={(tenant as any).name ?? ''}
                        />
                    </>
                )
            }
        }
        // No token, invalid token, or already pending_verification → resend form
        return (
            <>
                {fontLinks}
                <style dangerouslySetInnerHTML={{ __html: OT_CSS }} />
                <ResendUploadLinkForm orderNumber={orderNumber} />
            </>
        )
    }

    const sanitizedOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status ?? 'pending',
        paymentStatus: order.paymentStatus ?? 'unpaid',
        paymentMethod: order.paymentMethod ?? null,
        total: order.total ?? 0,
        subtotal: order.subtotal ?? 0,
        shippingFee: order.shippingFee ?? 0,
        tax: order.tax ?? 0,
        currency: order.currency ?? 'MYR',
        customerName: order.customerName ?? '',
        customerPhone: order.customerPhone ?? null,
        trackingNumber: order.trackingNumber ?? null,
        createdAt: order.createdAt,
        items: (order.items ?? []).map((item: any) => ({
            productName: item.productName ?? '',
            variant: item.variant ?? null,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0,
            imageUrl: item.product?.images?.[0]?.image?.url ?? null,
        })),
        shippingAddress: {
            line1: order.shippingAddress?.line1 ?? null,
            line2: order.shippingAddress?.line2 ?? null,
            city: order.shippingAddress?.city ?? null,
            state: order.shippingAddress?.state ?? null,
            postcode: order.shippingAddress?.postcode ?? null,
            country: order.shippingAddress?.country ?? 'Malaysia',
        },
    }

    return (
        <>
            {fontLinks}
            <style dangerouslySetInnerHTML={{ __html: OT_CSS }} />
            <OrderTrackingClient order={sanitizedOrder} slug={slug} />
        </>
    )
}
