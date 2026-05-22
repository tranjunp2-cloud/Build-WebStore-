import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { orderStatusUpdateSchema } from '@/lib/validations/orders'
import { ORDER_STATUS_TRANSITIONS } from '@/collections/Orders'
import { orderStatusEmail } from '@/lib/email/templates/order-status'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'
import { orderShippedEmail } from '@/lib/email/templates/order-shipped'

// Statuses that trigger a buyer notification email
const BUYER_EMAIL_STATUSES = new Set(['confirmed', 'shipped', 'completed', 'cancelled', 'refunded'])

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/orders/[id]
 *
 * Update order status with workflow validation.
 * Only allows transitions defined in ORDER_STATUS_TRANSITIONS.
 */
export const PATCH = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, orderStatusUpdateSchema)
        if (errorResponse) return errorResponse

        const { status: newStatus, trackingNumber, notes } = data!

        const payload = await getPayload({ config })

        // Get current order (access-controlled by collection)
        const order = await payload.findByID({
            collection: 'orders',
            id,
            user,
            overrideAccess: false,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }

        // Validate status transition
        const currentStatus = order.status as string
        const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || []
        if (!allowedTransitions.includes(newStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_TRANSITION',
                        message: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowedTransitions.join(', ') || 'none'}`,
                    },
                },
                { status: 422 }
            )
        }

        // Tracking number required when transitioning to shipped
        if (newStatus === 'shipped' && !trackingNumber) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Tracking number is required when shipping' } },
                { status: 422 }
            )
        }

        // Build update data
        const updateData: any = { status: newStatus }
        if (trackingNumber) updateData.trackingNumber = trackingNumber
        if (notes) updateData.notes = notes
        if (newStatus === 'cancelled' && notes) updateData.cancelReason = notes



        const updated = await payload.update({
            collection: 'orders',
            id,
            data: updateData,
            user,
            overrideAccess: false,
        })

        // Send buyer notification for relevant status changes — isolated so email failure never fails the update response
        if (BUYER_EMAIL_STATUSES.has(newStatus) && (order as any).customerEmail) {
            try {
                const customerEmail = (order as any).customerEmail
                const orderNumber = (order as any).orderNumber ?? id

                if (newStatus === 'cancelled' || newStatus === 'shipped' || newStatus === 'confirmed') {
                    const tenantId = typeof (order as any).tenant === 'object'
                        ? (order as any).tenant.id
                        : (order as any).tenant
                    const tenant = tenantId
                        ? await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
                        : null
                    const shopName = (tenant as any)?.name ?? ''
                    const shopSlug = (tenant as any)?.slug ?? String(tenantId ?? '')
                    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
                    const siteLocale = typeof (order as any).site === 'object'
                        ? ((order as any).site?.locale ?? 'ms')
                        : 'ms'

                    const orderItems = ((order as any).items ?? []).map((item: any) => ({
                        name: item.productName,
                        variant: item.variant || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        lineTotal: item.quantity * item.unitPrice,
                    }))

                    if (newStatus === 'confirmed') {
                        const confirmedEmail = orderConfirmationEmail({
                            shopName,
                            orderNumber,
                            customerName: (order as any).customerName ?? '',
                            customerEmail,
                            customerPhone: (order as any).customerPhone ?? null,
                            customerAddress: (order as any).shippingAddress ?? null,
                            items: orderItems,
                            subtotal: (order as any).subtotal ?? 0,
                            shippingFee: (order as any).shippingFee ?? 0,
                            total: (order as any).total ?? 0,
                            paymentMethod: (order as any).paymentMethod === 'cod' ? 'cod' : 'stripe',
                            orderDate: (order as any).createdAt,
                            orderPageUrl: `${baseUrl}/sites/${shopSlug}/orders/${orderNumber}`,
                            currency: (order as any).currency ?? 'MYR',
                            locale: siteLocale,
                            event: 'confirmed',
                        })
                        payload.sendEmail({ to: customerEmail, subject: confirmedEmail.subject, html: confirmedEmail.html })
                            .catch((err: unknown) => console.error('[Email confirmed notify]', err))
                    } else if (newStatus === 'cancelled') {
                        const cancelEmail = orderCancelledEmail({
                            shopName,
                            orderNumber,
                            customerName: (order as any).customerName ?? '',
                            customerEmail,
                            customerPhone: (order as any).customerPhone ?? null,
                            customerAddress: (order as any).shippingAddress ?? null,
                            items: orderItems,
                            subtotal: (order as any).subtotal ?? 0,
                            shippingFee: (order as any).shippingFee ?? 0,
                            total: (order as any).total ?? 0,
                            paymentMethod: (order as any).paymentMethod ?? 'cod',
                            orderDate: (order as any).createdAt,
                            cancellationDate: new Date().toISOString(),
                            cancellationNote: notes ?? (order as any).cancelReason ?? null,
                            shopUrl: `${baseUrl}/sites/${shopSlug}`,
                            currency: (order as any).currency ?? 'MYR',
                            locale: siteLocale,
                        })
                        payload.sendEmail({ to: customerEmail, subject: cancelEmail.subject, html: cancelEmail.html })
                            .catch((err: unknown) => console.error('[Email cancel notify]', err))
                    } else {
                        // newStatus === 'shipped'
                        const shippedEmail = orderShippedEmail({
                            shopName,
                            orderNumber,
                            customerName: (order as any).customerName ?? '',
                            customerEmail,
                            customerPhone: (order as any).customerPhone ?? null,
                            customerAddress: (order as any).shippingAddress ?? null,
                            items: orderItems,
                            subtotal: (order as any).subtotal ?? 0,
                            shippingFee: (order as any).shippingFee ?? 0,
                            total: (order as any).total ?? 0,
                            paymentMethod: (order as any).paymentMethod ?? 'cod',
                            shippingProvider: (order as any).shippingProvider ?? null,
                            orderDate: (order as any).createdAt,
                            shippedDate: new Date().toISOString(),
                            orderPageUrl: `${baseUrl}/sites/${shopSlug}/orders/${orderNumber}`,
                            currency: (order as any).currency ?? 'MYR',
                            locale: siteLocale,
                        })
                        payload.sendEmail({ to: customerEmail, subject: shippedEmail.subject, html: shippedEmail.html })
                            .catch((err: unknown) => console.error('[Email shipped notify]', err))
                    }
                } else {
                    const statusEmailData = orderStatusEmail({
                        customerName: (order as any).customerName ?? '',
                        orderNumber,
                        status: newStatus as any,
                        trackingNumber: trackingNumber ?? (order as any).trackingNumber ?? undefined,
                    })
                    payload.sendEmail({ to: customerEmail, subject: statusEmailData.subject, html: statusEmailData.html })
                        .catch((err: unknown) => console.error('[Email status notify]', err))
                }
            } catch (emailErr) {
                payload.logger.error({ emailErr, orderId: id, status: newStatus }, '[order-update] email construction failed')
            }
        }

        return NextResponse.json({
            success: true,
            data: updated,
        })
    } catch (error: any) {
        if (error?.status === 404 || error?.name === 'NotFound') {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }
        console.error('[Order Update Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Order operation failed' } },
            { status: 500 }
        )
    }
})

/**
 * GET /api/orders/[id]
 *
 * Get single order details.
 */
export const GET = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        const order = await payload.findByID({
            collection: 'orders',
            id,
            depth: 2,
            user,
            overrideAccess: false,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, data: order })
    } catch (error: any) {
        if (error?.status === 404 || error?.name === 'NotFound') {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 }
            )
        }
        console.error('[Order Detail Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Order operation failed' } },
            { status: 500 }
        )
    }
})
