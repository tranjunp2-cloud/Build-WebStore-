/**
 * GET /api/orders/[id]/confirm-redirect?slug=...&token=...
 *
 * Validates a bank-transfer magic-link JWT, then sets the HttpOnly confirm
 * cookie and redirects the buyer to the existing order confirm page.
 *
 * This is the entry-point for all "upload receipt" links — both the initial
 * bank-transfer email and the seller-reject re-upload email.
 *
 * Security:
 * - JWT is verified against the per-order magicLinkSecret (rotated on reject)
 * - Confirm cookie is short-lived (1 h) and HttpOnly/SameSite=Lax
 * - Expired or invalid tokens redirect back to the tracking page (no cookie set)
 */

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyOrderToken } from '@/lib/auth/order-token'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

export const dynamic = 'force-dynamic'

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    const orderId = isNaN(Number(id)) ? id : Number(id)
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug') ?? ''
    const token = url.searchParams.get('token') ?? ''

    const fallback = slug
        ? buildStorefrontUrl(slug, '/orders')
        : (process.env.NEXT_PUBLIC_SERVER_URL ?? '/')

    if (!token || !slug) {
        return NextResponse.redirect(fallback)
    }

    try {
        const payload = await getPayload({ config })

        const result = await payload.find({
            collection: 'orders',
            where: { id: { equals: orderId } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        const order = result.docs[0] as any

        if (!order || !order.magicLinkSecret) {
            return NextResponse.redirect(fallback)
        }

        const verified = await verifyOrderToken({ token, secret: order.magicLinkSecret })
        if (!verified.ok) {
            // Expired or invalid — send to tracking page so they can request a new link
            return NextResponse.redirect(buildStorefrontUrl(slug, `/orders/${order.orderNumber}`))
        }

        // Token valid — set confirm cookie and redirect to confirm page
        const confirmToken = generateConfirmToken(order.id, order.orderNumber)
        const response = NextResponse.redirect(buildStorefrontUrl(slug, `/order/${order.id}/confirm`))
        // TTL = remaining time until payment expires (max 24h), minimum 1h as fallback.
        // Avoids cutting the buyer's upload window shorter than the payment deadline.
        const ttl = order.paymentExpiresAt
            ? Math.max(Math.floor((new Date(order.paymentExpiresAt).getTime() - Date.now()) / 1000), 3600)
            : 86400
        response.cookies.set(`ct_${order.id}`, confirmToken, {
            httpOnly: true,
            path: '/',
            maxAge: ttl,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        })
        return response
    } catch {
        return NextResponse.redirect(fallback)
    }
}
