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

export async function GET(
    request: Request,
    { params }: { params: Promise<{ orderNumber: string }> },
) {
    const { orderNumber } = await params
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    try {
        const payload = await getPayload({ config })

        const where: Where = { orderNumber: { equals: orderNumber } }

        if (slug) {
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

            where['site'] = { equals: site.id }
        }

        const initial = await payload.find({ collection: 'orders', where, limit: 1, overrideAccess: true, depth: 0 })
        const initialOrder = initial.docs[0] as any
        if (!initialOrder) return new Response('not_found', { status: 404 })

        let lastStatus: string = initialOrder.status
        let lastPaymentStatus: string = initialOrder.paymentStatus
        let lastTrackingNumber: string | null = initialOrder.trackingNumber ?? null

        const encoder = new TextEncoder()

        const stream = new ReadableStream({
            start(controller) {
                let closed = false

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
                    clearInterval(pollId)
                    clearInterval(heartbeatId)
                    clearTimeout(maxTimer)
                    try { controller.close() } catch {}
                }

                // Immediately send current state
                send({
                    status: lastStatus,
                    paymentStatus: lastPaymentStatus,
                    trackingNumber: lastTrackingNumber,
                    terminal: TERMINAL_STATUSES.has(lastStatus),
                })

                if (TERMINAL_STATUSES.has(lastStatus)) { close(); return }

                // Poll DB every 5s for status changes
                const pollId = setInterval(async () => {
                    if (closed) return
                    try {
                        const r = await payload.find({ collection: 'orders', where, limit: 1, overrideAccess: true, depth: 0 })
                        const o = r.docs[0] as any
                        if (!o) return

                        const newTracking = o.trackingNumber ?? null
                        if (
                            o.status !== lastStatus ||
                            o.paymentStatus !== lastPaymentStatus ||
                            newTracking !== lastTrackingNumber
                        ) {
                            lastStatus = o.status
                            lastPaymentStatus = o.paymentStatus
                            lastTrackingNumber = newTracking
                            send({ status: lastStatus, paymentStatus: lastPaymentStatus, trackingNumber: lastTrackingNumber, terminal: TERMINAL_STATUSES.has(lastStatus) })
                            if (TERMINAL_STATUSES.has(lastStatus)) close()
                        }
                    } catch {
                        // retry on next tick
                    }
                }, DB_POLL_MS)

                // Heartbeat to keep connection alive through proxies
                const heartbeatId = setInterval(() => {
                    if (closed) return
                    try { controller.enqueue(encoder.encode(': heartbeat\n\n')) } catch { close() }
                }, HEARTBEAT_MS)

                // Graceful close before Vercel timeout — EventSource auto-reconnects
                const maxTimer = setTimeout(close, MAX_STREAM_MS)

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
