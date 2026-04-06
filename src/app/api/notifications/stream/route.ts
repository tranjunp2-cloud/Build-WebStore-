import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Keep SSE connections open — prevent Next.js from closing the response
export const maxDuration = 300

/**
 * GET /api/notifications/stream
 *
 * Server-Sent Events (SSE) endpoint.
 * Connects to PostgreSQL LISTEN on 'notification_channel'.
 * Filters events for the authenticated user's ID and tenant.
 * Sends a heartbeat every 30s to keep the connection alive.
 *
 * Client connects once: new EventSource('/api/notifications/stream')
 * Each notification INSERT triggers a pg NOTIFY → this endpoint receives it
 * → filters by userId → pushes SSE event to the matching client.
 */
export async function GET(request: Request): Promise<Response> {
    // Auth check
    const user = await getCurrentUser(request)
    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    const userId = String(user.id)

    // Resolve tenant ID for this user
    const userWithTenants = user as unknown as {
        tenants?: Array<{ tenant: string | { id: string } }>
    }
    const firstTenant = userWithTenants.tenants?.[0]?.tenant
    const tenantId = typeof firstTenant === 'object' ? firstTenant?.id : (firstTenant ?? null)

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            let pgClient: import('pg').Client | null = null
            let heartbeatTimer: ReturnType<typeof setInterval> | null = null
            let closed = false

            const cleanup = () => {
                if (closed) return
                closed = true
                if (heartbeatTimer) clearInterval(heartbeatTimer)
                if (pgClient) {
                    pgClient.query('UNLISTEN *').catch(() => {})
                    pgClient.end().catch(() => {})
                }
            }

            // Abort when client disconnects
            request.signal.addEventListener('abort', () => {
                cleanup()
                try { controller.close() } catch { /* already closed */ }
            })

            try {
                const { Client } = await import('pg')
                const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL

                if (!connStr) {
                    controller.enqueue(encoder.encode('event: error\ndata: {"message":"No DB connection"}\n\n'))
                    controller.close()
                    return
                }

                // Dedicated pg connection for LISTEN (cannot share pool connection)
                pgClient = new Client({
                    connectionString: connStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, ''),
                    ssl: connStr.includes('localhost') ? undefined : { rejectUnauthorized: false },
                })
                await pgClient.connect()
                await pgClient.query('LISTEN notification_channel')

                // Heartbeat every 30s to keep connection alive (prevents proxy/DO timeouts)
                heartbeatTimer = setInterval(() => {
                    if (closed) return
                    try {
                        controller.enqueue(encoder.encode(': heartbeat\n\n'))
                    } catch {
                        cleanup()
                    }
                }, 30_000)

                // Send initial connected event
                controller.enqueue(encoder.encode('event: connected\ndata: {"status":"ok"}\n\n'))

                // Listen for pg NOTIFY events
                pgClient.on('notification', (msg) => {
                    if (closed) return
                    try {
                        const payload = JSON.parse(msg.payload ?? '{}') as {
                            userId?: string | number
                            tenantId?: string | number
                            id?: string | number
                        }

                        // Only send to the matching user
                        if (String(payload.userId) !== userId) return
                        // Optionally check tenant too for extra isolation
                        if (tenantId && String(payload.tenantId) !== tenantId) return

                        const data = JSON.stringify({
                            id: payload.id,
                            userId: payload.userId,
                            tenantId: payload.tenantId,
                        })
                        controller.enqueue(encoder.encode(`event: notification\ndata: ${data}\n\n`))
                    } catch {
                        // Malformed payload — ignore silently
                    }
                })

                pgClient.on('error', () => {
                    cleanup()
                    try { controller.close() } catch { /* already closed */ }
                })
            } catch (err) {
                console.error('[SSE Stream Error]', err)
                cleanup()
                try { controller.close() } catch { /* already closed */ }
            }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
    })
}
