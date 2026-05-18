import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'
import { verifyOrderToken } from '@/lib/auth/order-token'
import UploadClient from './UploadClient'
import {
    pageStyle, headerStyle, h1Style, shellStyle, stateCardStyle,
    stateIconStyle, sectionTitleStyle,
} from './order-upload-styles'

type PageState =
    | 'invalid_token' | 'expired' | 'cancelled'
    | 'awaiting_payment' | 'pending_verification' | 'paid'

export default async function OrderUploadPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string; id: string }>
    searchParams: Promise<{ token?: string }>
}) {
    const { slug, id } = await params
    const { token } = await searchParams
    const payload = await getPayload({ config })

    const siteResult = await payload.find({
        collection: 'sites',
        where: { slug: { equals: slug } },
        limit: 1,
        overrideAccess: true,
        depth: 1,
    })
    const site = siteResult.docs[0] as any
    if (!site) notFound()

    const orderId = isNaN(Number(id)) ? id : Number(id)
    let order: any = null
    try {
        const result = await payload.find({
            collection: 'orders',
            where: { id: { equals: orderId }, site: { equals: site.id } },
            limit: 1,
            overrideAccess: true,
            depth: 1,
        })
        order = result.docs[0] ?? null
    } catch { /* order stays null */ }
    if (!order) notFound()

    let state: PageState
    if (!token) {
        state = 'invalid_token'
    } else {
        const v = await verifyOrderToken({ token, secret: order.magicLinkSecret ?? '' })
        if (!v.ok) {
            state = v.error === 'expired' ? 'expired' : 'invalid_token'
        } else if (order.paymentStatus === 'cancelled') {
            state = 'cancelled'
        } else {
            state = order.paymentStatus as PageState
        }
    }

    const sanitizedOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        currency: order.currency ?? 'MYR',
        paymentReference: order.paymentReference ?? '',
        paymentExpiresAt: order.paymentExpiresAt ?? null,
        paymentStatus: order.paymentStatus,
        paymentRejectionReason: order.paymentRejectionReason ?? null,
        paymentRejectionDetail: order.paymentRejectionDetail ?? null,
    }

    const pc = site.paymentConfig ?? {}
    const paymentInfo = {
        bankName: pc.bankName ?? '',
        bankAccountNo: pc.bankAccountNo ?? '',
        bankAccountHolder: pc.bankAccountHolder ?? '',
        qrUrl: pc.merchantQrCode?.url ?? pc.merchantQrCode?.filename
            ? `/api/media/file/${pc.merchantQrCode.filename}` : undefined,
    }

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

            <div style={pageStyle}>
                <header style={headerStyle}>
                    <h1 style={h1Style}>Payment Upload</h1>
                </header>

                <div style={shellStyle}>
                    {state === 'invalid_token' && (
                        <div style={stateCardStyle}>
                            <div style={{ ...stateIconStyle, background: '#fee2e2' }}>
                                <span style={{ fontSize: 28 }}>⛔</span>
                            </div>
                            <h2 style={{ ...sectionTitleStyle, textTransform: 'none', fontSize: 20 }}>
                                Payment Link Invalid
                            </h2>
                            <p style={{ fontSize: 14, color: '#7b8390', margin: 0, lineHeight: 1.6 }}>
                                This link is invalid or has already been used. Please contact the seller for assistance.
                            </p>
                        </div>
                    )}

                    {state === 'expired' && (
                        <div style={stateCardStyle}>
                            <div style={{ ...stateIconStyle, background: '#fff4dc' }}>
                                <span style={{ fontSize: 28 }}>⏰</span>
                            </div>
                            <h2 style={{ ...sectionTitleStyle, textTransform: 'none', fontSize: 20 }}>
                                Payment Link Expired
                            </h2>
                            <p style={{ fontSize: 14, color: '#7b8390', margin: 0, lineHeight: 1.6 }}>
                                This link has expired. Please contact the seller to receive a new link.
                            </p>
                        </div>
                    )}

                    {state === 'cancelled' && (
                        <div style={stateCardStyle}>
                            <div style={{ ...stateIconStyle, background: '#f3f4f6' }}>
                                <span style={{ fontSize: 28 }}>🚫</span>
                            </div>
                            <h2 style={{ ...sectionTitleStyle, textTransform: 'none', fontSize: 20 }}>
                                Order Cancelled
                            </h2>
                            {sanitizedOrder.paymentRejectionReason && (
                                <p style={{ fontSize: 13, color: '#7b8390', marginTop: 8, lineHeight: 1.6 }}>
                                    Reason: {sanitizedOrder.paymentRejectionReason}
                                    {sanitizedOrder.paymentRejectionDetail
                                        ? ` — ${sanitizedOrder.paymentRejectionDetail}` : ''}
                                </p>
                            )}
                        </div>
                    )}

                    {state === 'paid' && (
                        <div style={stateCardStyle}>
                            <div style={{ ...stateIconStyle, background: 'rgba(14,117,86,.1)' }}>
                                <span style={{ fontSize: 28 }}>✅</span>
                            </div>
                            <h2 style={{ ...sectionTitleStyle, textTransform: 'none', fontSize: 20, color: '#0e7556' }}>
                                Payment Confirmed ✓
                            </h2>
                            <p style={{ fontSize: 14, color: '#7b8390', margin: '0 0 18px', lineHeight: 1.6 }}>
                                Your payment has been verified. Your order is being processed.
                            </p>
                            <a
                                href={`/sites/${slug}/products`}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    background: '#0e7556', color: '#fff', borderRadius: 10,
                                    padding: '10px 22px', fontSize: 13.5, fontWeight: 700,
                                    textDecoration: 'none',
                                }}
                            >
                                Continue Shopping
                            </a>
                        </div>
                    )}

                    {state === 'pending_verification' && (
                        <>
                            <div style={stateCardStyle}>
                                <div style={{ ...stateIconStyle, background: '#fff4dc' }}>
                                    <span style={{ fontSize: 28 }}>🔍</span>
                                </div>
                                <h2 style={{ ...sectionTitleStyle, textTransform: 'none', fontSize: 20 }}>
                                    Proof Received
                                </h2>
                                <p style={{ fontSize: 14, color: '#7b8390', margin: 0, lineHeight: 1.6 }}>
                                    Your payment proof is under review. We will notify you once verified.
                                </p>
                            </div>
                            <UploadClient
                                orderId={sanitizedOrder.id}
                                slug={slug}
                                token={token!}
                                status="pending_verification"
                                paymentReference={sanitizedOrder.paymentReference}
                                total={sanitizedOrder.total}
                                currency={sanitizedOrder.currency}
                                expiresAtIso={sanitizedOrder.paymentExpiresAt ?? new Date(0).toISOString()}
                                bankName={paymentInfo.bankName}
                                bankAccountNo={paymentInfo.bankAccountNo}
                                bankAccountHolder={paymentInfo.bankAccountHolder}
                                qrUrl={paymentInfo.qrUrl}
                            />
                        </>
                    )}

                    {state === 'awaiting_payment' && (
                        <UploadClient
                            orderId={sanitizedOrder.id}
                            slug={slug}
                            token={token!}
                            status="awaiting_payment"
                            paymentReference={sanitizedOrder.paymentReference}
                            total={sanitizedOrder.total}
                            currency={sanitizedOrder.currency}
                            expiresAtIso={sanitizedOrder.paymentExpiresAt ?? new Date(0).toISOString()}
                            bankName={paymentInfo.bankName}
                            bankAccountNo={paymentInfo.bankAccountNo}
                            bankAccountHolder={paymentInfo.bankAccountHolder}
                            qrUrl={paymentInfo.qrUrl}
                        />
                    )}
                </div>
            </div>
        </>
    )
}
