import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { generateUploadToken, verifyConfirmToken } from '@/lib/orders/upload-token'
import ConfirmClient, { type ConfirmOrder } from './ConfirmClient'
import { signOrderToken } from '@/lib/auth/order-token'
import { orderWaitingEmail } from '@/lib/email/templates/order-waiting'
import { sendEmail } from '@/lib/email/send'

export default async function OrderConfirmPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string; orderId: string }>
    searchParams: Promise<{ cancelled?: string }>
}) {
    const { slug, orderId: rawId } = await params
    const { cancelled } = await searchParams
    const payload = await getPayload({ config })
    const orderId = isNaN(Number(rawId)) ? rawId : Number(rawId)

    // Resolve tenant slug → tenant → site (sites collection has no slug field)
    const tenantResult = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
        depth: 1,
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

    const pc = tenant.payments ?? {}
    const bankName: string = pc.bank_name ?? ''
    const bankAccountNo: string = pc.account_number ?? ''
    const bankAccountHolder: string = pc.account_holder_name ?? ''
    const _qr = pc.qr_image
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
                discountCode: raw.discountCode ?? null,
                discountAmount: raw.discountAmount ?? 0, // sen — client divides by 100 for RM
                total: raw.total,
                currency: raw.currency,
                paymentMethod: raw.paymentMethod,
                paymentStatus: raw.paymentStatus,
                paymentReference: raw.paymentReference,
                paymentExpiresAt: raw.paymentExpiresAt,
                stripePaymentIntentId: raw.stripePaymentIntentId,
                cardBrand: raw.cardBrand,
                cardLast4: raw.cardLast4,
                xenditPaymentRequestId: raw.xenditPaymentRequestId,
                xenditChannelCode: raw.xenditChannelCode,
                customerName: raw.customerName,
                customerEmail: raw.customerEmail,
                shippingAddress: raw.shippingAddress,
            }

            // One-time order-waiting reminder email for Stripe/Xendit awaiting_payment orders.
            // Uses after() so Vercel keeps the function alive until the callback completes.
            const shouldSendReminder =
                raw.paymentStatus === 'awaiting_payment' &&
                (raw.paymentProvider === 'stripe' || raw.paymentProvider === 'xendit') &&
                !raw.paymentReminderSentAt &&
                raw.customerEmail &&
                raw.magicLinkSecret

            if (shouldSendReminder) {
                after(async () => {
                    try {
                        const expSec = raw.paymentExpiresAt
                            ? Math.floor(new Date(raw.paymentExpiresAt).getTime() / 1000)
                            : Math.floor(Date.now() / 1000 + 24 * 3600)
                        const token = await signOrderToken({
                            orderId: raw.id,
                            secret: raw.magicLinkSecret,
                            expSec,
                        })
                        // Build direct link to confirm-redirect API (validates token → sets ct_ cookie → confirm page)
                        // Cannot use buildStorefrontUrl here — that prepends /sites/{slug} for local (API routes don't use that prefix)
                        const srvUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
                        const isLocal = srvUrl.includes('localhost') || srvUrl.includes('127.0.0.1')
                        const platDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
                        const proto = srvUrl.startsWith('https') ? 'https' : 'http'
                        const apiOrigin = (!isLocal && platDomain) ? `${proto}://${slug}.${platDomain}` : srvUrl
                        const payUrl = `${apiOrigin}/api/orders/${raw.id}/confirm-redirect?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}&cancelled=1`
                        // Set flag first to prevent duplicate sends on concurrent page loads (TOCTOU guard)
                        await payload.update({
                            collection: 'orders',
                            id: raw.id,
                            data: { paymentReminderSentAt: new Date().toISOString() },
                            overrideAccess: true,
                        })
                        const shopName = tenant.name ?? slug
                        const template = orderWaitingEmail({
                            shopName,
                            orderNumber: raw.orderNumber,
                            orderDate: raw.createdAt ?? new Date().toISOString(),
                            customerName: raw.customerName ?? '',
                            customerEmail: raw.customerEmail ?? '',
                            customerPhone: raw.customerPhone ?? null,
                            customerAddress: raw.shippingAddress ?? null,
                            items: (raw.items ?? []).map((item: any) => ({
                                name: item.productName ?? '',
                                variant: item.variant ?? null,
                                quantity: item.quantity ?? 1,
                                unitPrice: (item.unitPrice ?? 0) / 100,
                                lineTotal: ((item.unitPrice ?? 0) * (item.quantity ?? 1)) / 100,
                            })),
                            subtotal: (raw.subtotal ?? 0) / 100,
                            shippingFee: (raw.shippingFee ?? 0) / 100,
                            discountAmount: raw.discountAmount ? raw.discountAmount / 100 : null,
                            discountCode: raw.discountCode ?? null,
                            total: (raw.total ?? 0) / 100,
                            currency: raw.currency ?? 'MYR',
                            paymentMethod: raw.paymentMethod ?? '',
                            buyerNote: raw.notes ?? null,
                            payUrl,
                            paymentExpiresAt: raw.paymentExpiresAt ?? null,
                            locale: 'en',
                        })
                        await sendEmail({
                            to: raw.customerEmail,
                            subject: template.subject,
                            html: template.html,
                            templateType: 'order-waiting',
                            recipient: 'buyer',
                            tenantId: tenant.id,
                        })
                    } catch (err) {
                        console.error('[order-waiting] email send failed:', err)
                    }
                })
            }
        }
    } catch { }
    if (!order) notFound()

    // Guard: require a valid confirm token (HttpOnly cookie) to prevent unauthorised order viewing
    const cookieStore = await cookies()
    const token = cookieStore.get(`ct_${order.id}`)?.value
    if (!token || !verifyConfirmToken(token, order.id, order.orderNumber)) notFound()

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
                cancelled={cancelled === '1'}
            />
        </>
    )
}
