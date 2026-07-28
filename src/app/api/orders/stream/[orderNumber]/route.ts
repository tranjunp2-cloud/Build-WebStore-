import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Close stream at 50s so EventSource reconnects cleanly before Vercel's 60s function limit
export const maxDuration = 55

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'refunded', 'payment_failed'])
const DB_POLL_MS = 5_000
const HEARTBEAT_MS = 20_000
const MAX_STREAM_MS = 50_000

interface BuyerTrackingOrder {
    status: string
    paymentStatus: string
    trackingNumber?: string | null
    awbNo?: string | null
    shippingCourier?: string | null
    shippingCourierName?: string | null
    shippingCourierLogo?: string | null
    collectionMethod?: 'pickup' | 'dropoff' | null
    shippingTrackingStatus?: string | null
    shippingTrackingHistory?: Array<{
        status?: string | null
        description?: string | null
        eventTime?: string | null
    }> | null
}

function buyerTrackingState(order: BuyerTrackingOrder) {
    return {
        status: order.status,
        paymentStatus: order.paymentStatus,
        trackingNumber: order.trackingNumber ?? null,
        awbNo: order.awbNo ?? null,
        shippingCourier: order.shippingCourier ?? null,
        shippingCourierName: order.shippingCourierName ?? null,
        shippingCourierLogo: order.shippingCourierLogo ?? null,
        collectionMethod: order.collectionMethod ?? null,
        shippingTrackingStatus: order.shippingTrackingStatus ?? null,
        shippingTrackingHistory: (order.shippingTrackingHistory ?? []).map((entry) => ({
            status: entry.status ?? null,
            description: entry.description ?? '',
            eventTime: entry.eventTime ?? '',
        })),
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ orderNumber: string }> },
) {
    const { orderNumber } = await params
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
        return new Response('missing_slug', { status: 400 })
    }

    try {
        const payload = await getPayload({ config })

        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: slug } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        const tenant = tenantResult.docs[0] as any
        if (!tenant) return new Response('not_found', { status: 404 })

        const siteResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenant.id } },
            limit: 1,
            overrideAccess: true,
            depth: 0,
        })
        const site = siteResult.docs[0] as any
        if (!site) return new Response('not_found', { status: 404 })

        const where: Where = {
            orderNumber: { equals: orderNumber },
            site: { equals: site.id },
        }

        const initial = await payload.find({ collection: 'orders', where, limit: 1, overrideAccess: true, depth: 0 })
        const initialOrder = initial.docs[0] as unknown as BuyerTrackingOrder
        if (!initialOrder) return new Response('not_found', { status: 404 })

        let lastState = buyerTrackingState(initialOrder)
        let lastStateJson = JSON.stringify(lastState)

        const encoder = new TextEncoder()

        const stream = new ReadableStream({
            start(controller) {
                let closed = false
                let pollId: ReturnType<typeof setInterval> | undefined
                let heartbeatId: ReturnType<typeof setInterval> | undefined
                let maxTimer: ReturnType<typeof setTimeout> | undefined

                function send(data: object) {
                    if (closed) return
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
                    } catch {
                        closed = true
                    }
                }

                function close() {
                    if (closed) return
                    closed = true
                    if (pollId) clearInterval(pollId)
                    if (heartbeatId) clearInterval(heartbeatId)
                    if (maxTimer) clearTimeout(maxTimer)
                    try { controller.close() } catch {}
                }

                // Immediately send current state
                send({
                    ...lastState,
                    terminal: TERMINAL_STATUSES.has(lastState.status),
                })

                if (TERMINAL_STATUSES.has(lastState.status)) { close(); return }

                // Poll DB every 5s for order and courier-tracking changes.
                pollId = setInterval(async () => {
                    if (closed) return
                    try {
                        const r = await payload.find({ collection: 'orders', where, limit: 1, overrideAccess: true, depth: 0 })
                        const o = r.docs[0] as unknown as BuyerTrackingOrder
                        if (!o) return

                        const nextState = buyerTrackingState(o)
                        const nextStateJson = JSON.stringify(nextState)
                        if (nextStateJson !== lastStateJson) {
                            lastState = nextState
                            lastStateJson = nextStateJson
                            send({
                                ...lastState,
                                terminal: TERMINAL_STATUSES.has(lastState.status),
                            })
                            if (TERMINAL_STATUSES.has(lastState.status)) close()
                        }
                    } catch {
                        // retry on next tick
                    }
                }, DB_POLL_MS)

                // Heartbeat to keep connection alive through proxies
                heartbeatId = setInterval(() => {
                    if (closed) return
                    try { controller.enqueue(encoder.encode(': heartbeat\n\n')) } catch { close() }
                }, HEARTBEAT_MS)

                // Graceful close before Vercel timeout — EventSource auto-reconnects
                maxTimer = setTimeout(close, MAX_STREAM_MS)

                // Clean up on client disconnect
                request.signal.addEventListener('abort', close)
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-store',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        })
    } catch {
        return new Response('server_error', { status: 500 })
    }
}
