import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/orders/[id]/label?format=A6|A4
 *
 * Same-origin proxy for the EP label PDF. EP has no API returning the file itself —
 * submit_orders only returns per-format URLs (awb_urls_by_format), and those can 400
 * ("Failed to get label") when EP's renderer lacks that format. Proxying lets us:
 *   - validate the response IS a PDF (an EP error JSON becomes a clean 502 here,
 *     so the modal can disable the format instead of iframing raw JSON),
 *   - keep preview/download same-origin (real filenames, no cross-origin quirks),
 *   - auth-gate label access like every other order endpoint.
 */
export const GET = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const orderId = Number.isFinite(Number(id)) ? Number(id) : id
        const format = new URL(request.url).searchParams.get('format') ?? 'A6'
        if (format !== 'A6' && format !== 'A4') {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'format must be A6 or A4' } },
                { status: 422 },
            )
        }

        const payload = await getPayload({ config })
        const order = await payload.findByID({ collection: 'orders', id: orderId, user, overrideAccess: false, depth: 0 })
        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 },
            )
        }

        const labelUrls = (order as { labelUrls?: { A4?: string | null; A6?: string | null } | null }).labelUrls
        const legacyUrl = (order as { labelUrl?: string | null }).labelUrl
        // Legacy orders (pre-labelUrls) only have the generic awb_url — treated as A6
        const url = format === 'A4' ? labelUrls?.A4 : labelUrls?.A6 ?? legacyUrl
        if (!url) {
            return NextResponse.json(
                { success: false, error: { code: 'LABEL_UNAVAILABLE', message: `No ${format} label for this order` } },
                { status: 404 },
            )
        }

        const upstream = await fetch(url)
        const contentType = upstream.headers.get('content-type') ?? ''
        if (!upstream.ok || !contentType.includes('pdf')) {
            // e.g. EP renderer: 400 {"message":"Failed to get label"} — surface as unavailable
            return NextResponse.json(
                { success: false, error: { code: 'LABEL_UNAVAILABLE', message: `EasyParcel did not return a ${format} PDF` } },
                { status: 502 },
            )
        }

        const awbNo = (order as { awbNo?: string | null }).awbNo ?? 'label'
        return new NextResponse(upstream.body, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="label-${awbNo}-${format}.pdf"`,
                'Cache-Control': 'private, max-age=300',
            },
        })
    } catch (error: unknown) {
        console.error('[Label Proxy Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load label' } },
            { status: 500 },
        )
    }
}))
