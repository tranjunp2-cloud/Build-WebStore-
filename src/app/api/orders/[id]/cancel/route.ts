import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCancelSchema } from '@/lib/validations/orders'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'
import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { restockItem, type RestockResult } from '../../lib/stock-utils'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/cancel
 *
 * Cancel an order with a required reason.
 * Auto-restocks inventory for each item in the order.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, orderCancelSchema)
        if (errorResponse) return errorResponse

        const { reason } = data!
        const payload = await getPayload({ config })

        // Get current order
        const orderId = Number.isFinite(Number(id)) ? Number(id) : id
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

        // Sequential retry: already cancelled (first request completed before second arrived)
        if ((order.status as string) === 'cancelled') {
            return NextResponse.json({ success: true, data: order, restock: [] })
        }

        // Validate that cancellation is allowed from current status
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

        // Atomic status transition — prevents concurrent double-restock.
        // Two concurrent cancel requests both pass the validation above, but only the
        // one whose CAS succeeds (RETURNING non-empty) proceeds to restock.
        // The loser sees 0 rows → rechecks order → returns idempotent success without restocking.
        const db = (payload.db.drizzle as any)
        const casResult = await db.execute(sql`
            UPDATE orders
            SET status = 'cancelled', cancel_reason = ${reason}, updated_at = NOW()
            WHERE id = ${orderId} AND status = ${currentStatus}
            RETURNING id
        `)

        if (!casResult.rows?.length) {
            // CAS missed — status changed between our validation read and this write.
            // Two sub-cases: already cancelled (concurrent cancel WON) or advanced to
            // a non-cancellable state (e.g. ready_to_ship/shipped by seller).
            const recheck = await payload.findByID({
                collection: 'orders',
                id: orderId,
                overrideAccess: true,
                depth: 0,
            })
            if ((recheck as any)?.status === 'cancelled') {
                return NextResponse.json({ success: true, data: recheck, restock: [] })
            }
            // Status advanced to a non-cancellable state between validation and CAS
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_TRANSITION', message: 'Order status changed — cancellation no longer valid' } },
                { status: 422 }
            )
        }

        // CAS only wrote status + cancel_reason; all other order fields are unchanged.
        // Construct updated from the pre-fetched order to avoid an extra DB round trip.
        const updated = { ...(order as any), status: 'cancelled', cancelReason: reason }

        // Release the redeemed discount slot (F33) — runs only on the CAS winner so a concurrent
        // cancel can't double-release. No-op when the order never redeemed (e.g. Stripe still pending).
        await releaseDiscountRedemption(payload, Number(orderId))

        // Auto-restock inventory (variant-aware).
        const restockResults: RestockResult[] = []
        const items = (order as any).items || []

        // All payment methods decrement stock at checkout — always restock on cancel.
        // bank_transfer: stock decremented at checkout (not at approval) since 2026-06-03.
        // Migration note: BT orders created before that date had stock decremented at approval.
        // If any such orders were in-flight at deploy time, cancelling them now phantom-increments
        // their variant stock. Resolve in-flight BT orders before deploying to avoid this.
        const shouldRestock = true
        if (shouldRestock) {
            for (const item of items) {
                const rawProductId = typeof item.product === 'object' ? item.product?.id : item.product
                if (!rawProductId) {
                    restockResults.push({ productId: 'unknown', restocked: 0, skipped: true, reason: 'product_not_found' })
                    continue
                }
                const productId = Number.isFinite(Number(rawProductId)) ? Number(rawProductId) : rawProductId
                const result = await restockItem(payload, productId, item.variant, item.quantity)
                restockResults.push(result)
            }
        }

        // Alert ops if any restock item failed — requires manual inventory reconciliation.
        // write_failed: DB I/O error. product_not_found / variant_not_found: stock was decremented
        // at checkout/approve but the product/variant no longer exists — data integrity loss.
        const alertableRestocks = restockResults.filter(r =>
            r.skipped && (r.reason === 'write_failed' || r.reason === 'product_not_found' || r.reason === 'variant_not_found')
        )
        if (alertableRestocks.length > 0) {
            payload.logger.error(
                { orderId, failedProducts: alertableRestocks.map(r => ({ id: r.productId, reason: r.reason })) },
                '[Order Cancel] Restock failed — manual inventory reconciliation required'
            )
        }

        // Send cancellation email to customer
        const customerEmail = (updated as any).customerEmail
        if (customerEmail) {
            try {
                const tenantId = typeof (updated as any).tenant === 'object'
                    ? (updated as any).tenant.id
                    : (updated as any).tenant
                const siteLocale: 'en' | 'ms' = typeof (updated as any).site === 'object'
                    ? ((updated as any).site?.locale ?? 'ms')
                    : 'ms'
                const [tenant, cmsConfig] = await Promise.all([
                    tenantId
                        ? payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
                        : Promise.resolve(null),
                    tenantId
                        ? getTemplateConfig(tenantId, 'order-cancelled', 'buyer', siteLocale)
                        : Promise.resolve(null),
                ])

                if (cmsConfig?.enabled === false) {
                    console.log('[Email] suppressed (disabled): order-cancelled (cancel route)')
                } else {
                    const shopName = (tenant as any)?.name ?? ''
                    const shopSlug = (tenant as any)?.slug ?? String(tenantId ?? '')
                    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
                    const shopUrl = `${baseUrl}/sites/${shopSlug}`

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
                    }, cmsConfig ?? undefined)
                    payload.sendEmail({ to: customerEmail, subject: cancelEmail.subject, html: cancelEmail.html })
                        .catch((err: unknown) => console.warn('[Order Cancel] Failed to send email:', err))
                }
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
}))
