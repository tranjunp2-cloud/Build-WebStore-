import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCancelSchema } from '@/lib/validations/orders'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'
import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/cancel
 *
 * Cancel an order with a required reason.
 * Auto-restocks inventory for each item in the order.
 */
export const POST = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, orderCancelSchema)
        if (errorResponse) return errorResponse

        const { reason } = data!
        const payload = await getPayload({ config })

        // Get current order
        const orderId = isNaN(Number(id)) ? id : Number(id)
        const order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            user,
            overrideAccess: false,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }

        // Idempotency: already cancelled → treat as success (prevents double restock on concurrent requests)
        if ((order.status as string) === 'cancelled') {
            return NextResponse.json({ success: true, data: order, restock: [] })
        }

        // Validate that cancellation is allowed
        const currentStatus = order.status as string
        const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] || []
        if (!allowed.includes('cancelled')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_TRANSITION',
                        message: `Cannot cancel order in "${currentStatus}" status. Cancellation is only allowed for: ${Object.entries(ORDER_STATUS_TRANSITIONS)
                            .filter(([, v]) => v.includes('cancelled'))
                            .map(([k]) => k)
                            .join(', ')}`,
                    },
                },
                { status: 422 }
            )
        }

        // Cancel the order
        const updated = await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                status: 'cancelled',
                cancelReason: reason,
            } as any,
            user,
            overrideAccess: false,
        })

        // Auto-restock inventory
        const restockResults: Array<{ productId: string; restocked: number; skipped?: boolean }> = []
        const items = (order as any).items || []

        for (const item of items) {
            const rawProductId = typeof item.product === 'object' ? item.product?.id : item.product
            if (!rawProductId) {
                restockResults.push({ productId: 'unknown', restocked: 0, skipped: true })
                continue
            }
            const productId = isNaN(Number(rawProductId)) ? rawProductId : Number(rawProductId)

            try {
                const product = await payload.findByID({
                    collection: 'products',
                    id: productId,
                    depth: 0,
                })

                if (!product) {
                    // Product deleted — skip safely (per AC-2 of US-F10-03)
                    restockResults.push({ productId: String(productId), restocked: item.quantity, skipped: true })
                    continue
                }

                const currentStock = (product as any).stock ?? 0
                await payload.update({
                    collection: 'products',
                    id: productId,
                    data: { stock: currentStock + item.quantity } as any,
                })

                restockResults.push({ productId: String(productId), restocked: item.quantity })
            } catch (err) {
                // If product was deleted between check and update, skip
                console.warn(`[Restock] Failed for product ${productId}:`, err)
                restockResults.push({ productId, restocked: 0, skipped: true })
            }
        }

        // Send cancellation email to customer
        const customerEmail = (updated as any).customerEmail
        if (customerEmail) {
            try {
                const tenantId = typeof (updated as any).tenant === 'object'
                    ? (updated as any).tenant.id
                    : (updated as any).tenant
                const tenant = tenantId
                    ? await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
                    : null
                const shopName = (tenant as any)?.name ?? ''
                const shopSlug = (tenant as any)?.slug ?? String(tenantId ?? '')
                const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
                const shopUrl = `${baseUrl}/sites/${shopSlug}`
                const siteLocale = typeof (updated as any).site === 'object'
                    ? ((updated as any).site?.locale ?? 'ms')
                    : 'ms'

                const cancelEmail = orderCancelledEmail({
                    shopName,
                    orderNumber: (updated as any).orderNumber ?? String(updated.id),
                    customerName: (updated as any).customerName ?? '',
                    customerEmail,
                    customerPhone: (updated as any).customerPhone ?? null,
                    customerAddress: (updated as any).shippingAddress ?? null,
                    items: ((updated as any).items ?? []).map((item: any) => ({
                        name: item.productName,
                        variant: item.variant || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        lineTotal: item.quantity * item.unitPrice,
                    })),
                    subtotal: (updated as any).subtotal ?? 0,
                    shippingFee: (updated as any).shippingFee ?? 0,
                    total: (updated as any).total ?? 0,
                    paymentMethod: (updated as any).paymentMethod ?? 'cod',
                    orderDate: (updated as any).createdAt,
                    cancellationDate: new Date().toISOString(),
                    cancellationNote: reason ?? null,
                    shopUrl,
                    currency: (updated as any).currency ?? 'MYR',
                    locale: siteLocale,
                })
                payload.sendEmail({ to: customerEmail, subject: cancelEmail.subject, html: cancelEmail.html })
                    .catch((err: unknown) => console.warn('[Order Cancel] Failed to send email:', err))
            } catch (emailErr) {
                console.warn('[Order Cancel] Failed to build email:', emailErr)
            }
        }

        return NextResponse.json({
            success: true,
            data: updated,
            restock: restockResults,
        })
    } catch (error: any) {
        console.error('[Order Cancel Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Order cancellation failed' } },
            { status: 500 }
        )
    }
})
