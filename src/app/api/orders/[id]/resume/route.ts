import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyUploadToken, generateConfirmToken } from '@/lib/orders/upload-token'

/** Minimal shape of an order document for the resume-upload flow. */
interface OrderDoc {
    id: string | number
    orderNumber: string
    tenant?: string | number | { id: string | number }
}

/** Minimal shape of a tenant document for the resume-upload flow. */
interface TenantDoc {
    id: string | number
    slug?: string
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

/**
 * GET /api/orders/[id]/resume?ut=<uploadToken>
 *
 * Validates the upload token, sets the confirm page cookie, then redirects
 * the buyer to their confirm page — enabling cross-device proof upload via email link.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    const orderId = isNaN(Number(id)) ? id : Number(id)
    const { searchParams } = new URL(req.url)
    const uploadToken = searchParams.get('ut') ?? ''

    const fallbackUrl = `${BASE_URL}`

    if (!uploadToken || !verifyUploadToken(uploadToken, orderId)) {
        return NextResponse.redirect(`${fallbackUrl}?error=invalid-link`)
    }

    try {
        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'orders',
            where: { id: { equals: orderId } },
            limit: 1,
            overrideAccess: true,
            depth: 1,
        })
        const order = result.docs[0] as unknown as OrderDoc | undefined
        if (!order) return NextResponse.redirect(`${fallbackUrl}?error=not-found`)

        // Resolve shop slug for confirm page URL
        const tenantId = typeof order.tenant === 'object' ? (order.tenant as { id: string | number }).id : order.tenant
        const tenant = tenantId
            ? await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
            : null
        const slug = (tenant as unknown as TenantDoc | null)?.slug ?? ''
        if (!slug) return NextResponse.redirect(`${fallbackUrl}?error=not-found`)

        const confirmPageUrl = `${BASE_URL}/sites/${slug}/order/${orderId}/confirm`

        // Set the HttpOnly confirm cookie so the confirm page lets the buyer in
        const confirmToken = generateConfirmToken(orderId, order.orderNumber)
        const response = NextResponse.redirect(confirmPageUrl)
        response.cookies.set(`ct_${orderId}`, confirmToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        })
        return response
    } catch (err) {
        console.error('[resume-upload]', err)
        return NextResponse.redirect(`${fallbackUrl}?error=server-error`)
    }
}
