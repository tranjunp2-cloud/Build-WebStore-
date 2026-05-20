import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCreateSchema } from '@/lib/validations/orders'
import { getShippingRate } from '@/lib/shipping'
import { generatePaymentReference } from '@/lib/payment/reference'
import { signOrderToken } from '@/lib/auth/order-token'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { bankTransferInstructionsEmail } from '@/lib/email/templates/bank-transfer-instructions'

export const maxDuration = 60

/**
 * POST /api/orders/checkout
 *
 * Create order via manual payment methods (COD or QR Banking).
 * Does NOT go through Stripe — creates order directly.
 * Public endpoint (guest checkout allowed).
 */
export async function POST(request: Request) {
    try {
        const { data, errorResponse } = await parseRequest(request, orderCreateSchema)
        if (errorResponse) return errorResponse

        const { siteId, items, customer, paymentMethod, paymentProofImage } = data!

        // Aggregate duplicate (productId, variant) pairs before validation (prevents stock bypass via split quantities)
        const itemMap: Record<string, { productId: string | number; quantity: number; variant?: string }> = {}
        for (const item of items) {
            const key = `${String(item.productId)}:${item.variant ?? ''}`
            if (itemMap[key]) {
                itemMap[key].quantity += item.quantity
            } else {
                itemMap[key] = { ...item }
            }
        }
        const aggregatedItems = Object.values(itemMap)

        const payload = await getPayload({ config })

        // Get site to find tenant
        const siteLookupId = typeof siteId === 'string' && !isNaN(Number(siteId)) ? Number(siteId) : siteId
        const site = await payload.findByID({ collection: 'sites', id: siteLookupId })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        const tenantId = typeof site.tenant === 'object' ? (site.tenant as any).id : site.tenant

        // Enforce per-site payment method configuration
        const pc = (site as any).paymentConfig
        if (paymentMethod === 'cod' && pc?.enableCod === false) {
            return NextResponse.json(
                { success: false, error: { code: 'PAYMENT_METHOD_DISABLED', message: 'COD is not available for this store' } },
                { status: 422 }
            )
        }
        if (paymentMethod === 'bank_transfer' && pc?.enableQrBanking === false) {
            return NextResponse.json(
                { success: false, error: { code: 'PAYMENT_METHOD_DISABLED', message: 'Bank Transfer is not available for this store' } },
                { status: 422 }
            )
        }

        // Validate products, check stock, and calculate totals
        const orderItems = []
        let subtotal = 0
        let currency = 'MYR'

        for (const item of aggregatedItems) {
            const productLookupId = typeof item.productId === 'string' && !isNaN(Number(item.productId)) ? Number(item.productId) : item.productId
            // RF-01: filter by site, active status, and non-deleted — overrideAccess so the explicit where clause is the sole gate
            const productResult = await payload.find({
                collection: 'products',
                where: {
                    and: [
                        { id: { equals: productLookupId } },
                        { site: { equals: siteLookupId } },
                        { status: { equals: 'active' } },
                        { deletedAt: { exists: false } },
                    ],
                },
                limit: 1,
                depth: 0,
                overrideAccess: true,
            })

            const product = productResult.docs[0]
            if (!product) {
                return NextResponse.json(
                    { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${item.productId} not found` } },
                    { status: 404 }
                )
            }

            const p = product as any

            // Check stock — top-level field in Products collection is `inventory` (variants have per-variant `stock`)
            if (p.inventory !== undefined && p.inventory !== null && p.inventory < item.quantity) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'OUT_OF_STOCK',
                            message: `"${p.name}" has only ${p.inventory} left in stock`,
                            product: p.name,
                            available: p.inventory,
                            requested: item.quantity,
                        },
                    },
                    { status: 422 }
                )
            }

            currency = p.currency || 'MYR'
            const lineTotal = p.price * item.quantity
            subtotal += lineTotal

            orderItems.push({
                product: productLookupId,
                productName: p.name,
                variant: item.variant || '',
                quantity: item.quantity,
                unitPrice: p.price,
            })
        }

        if (orderItems.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid products' } },
                { status: 422 }
            )
        }

        // State is required for shipping calculation — Zod enum already blocks invalid/empty values, this guards undefined
        if (!customer.address?.state) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Please select a valid state' } },
                { status: 422 }
            )
        }

        // Generate order number
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`

        // Shipping: rates stored in sen, subtotal is RM-float → convert for calc, result back to RM
        // PR note: subtotal is RM-float (p.price * qty); shippingConfig rates are in sen (800 = RM 8)
        const subtotalSen = Math.round(subtotal * 100)
        const shippingFeeSen = getShippingRate(customer.address.state, (site as any).shippingConfig, subtotalSen)
        const shippingFee = shippingFeeSen / 100

        // Tax (SST 6% on subtotal only — BR-05)
        const tax = Math.round(subtotal * 0.06 * 100) / 100
        const total = subtotal + shippingFee + tax

        // Compute bank_transfer-specific fields (before create)
        let paymentReference: string | undefined
        let magicLinkSecret: string | undefined
        let paymentExpiresAt: Date | undefined

        if (paymentMethod === 'bank_transfer') {
            paymentReference = await generatePaymentReference(payload, tenantId)
            magicLinkSecret = crypto.randomBytes(32).toString('hex')
            paymentExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        }

        // Create order
        const order = await payload.create({
            collection: 'orders',
            data: {
                tenant: tenantId,
                site: siteLookupId,
                orderNumber,
                items: orderItems,
                subtotal,
                shippingFee,
                tax,
                total,
                currency,
                status: 'pending',
                paymentMethod,
                paymentStatus: paymentMethod === 'bank_transfer' ? 'awaiting_payment' : 'unpaid',
                // bank_transfer: no proof at checkout
                ...(paymentMethod !== 'bank_transfer' && paymentProofImage ? { paymentProofImage } : {}),
                paymentReference: paymentReference ?? null,
                magicLinkSecret: magicLinkSecret ?? null,
                paymentExpiresAt: paymentExpiresAt ?? null,
                customerEmail: customer.email,
                customerName: customer.name,
                customerPhone: customer.phone || '',
                shippingAddress: customer.address ? {
                    line1: customer.address.line1 || '',
                    line2: customer.address.line2 || '',
                    city: customer.address.city || '',
                    state: customer.address.state || '',
                    postcode: customer.address.postcode || '',
                    country: customer.address.country || 'Malaysia',
                } : undefined,
            } as any,
        })

        // Decrement inventory for COD only — bank_transfer reserves stock without decrement
        // (decrement happens at Approve step in P06)
        if (paymentMethod === 'cod') {
            for (const item of aggregatedItems) {
                try {
                    const product = await payload.findByID({
                        collection: 'products',
                        id: item.productId,
                        depth: 0,
                        overrideAccess: true,
                    })
                    const p = product as any
                    if (p.inventory !== undefined && p.inventory !== null) {
                        await payload.update({
                            collection: 'products',
                            id: item.productId,
                            data: { inventory: Math.max(0, p.inventory - item.quantity) } as any,
                        })
                    }
                } catch (err) {
                    console.warn(`[Stock Decrement] Failed for product ${item.productId}:`, err)
                }
            }
        }

        // Fire-and-forget email + build redirectUrl for bank_transfer
        let redirectUrl: string | undefined

        if (paymentMethod === 'bank_transfer' && magicLinkSecret && paymentExpiresAt) {
            const expSec = Math.floor(paymentExpiresAt.getTime() / 1000)
            const token = await signOrderToken({
                orderId: order.id,
                secret: magicLinkSecret,
                expSec,
            })
            // Slug lives on the tenant, not the site — sites collection has no slug field
            const tenantForSlug = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
            const siteSlug = (tenantForSlug as any)?.slug ?? String(siteId)
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
            redirectUrl = `${baseUrl}/sites/${siteSlug}/orders/${orderNumber}?token=${token}`
            const plainUploadUrl = `${baseUrl}/sites/${siteSlug}/orders/${orderNumber}`

            const pcConfig = (site as any).paymentConfig
            payload.sendEmail(bankTransferInstructionsEmail({
                orderNumber: order.orderNumber,
                customerName: customer.name,
                total: order.total,
                currency: order.currency ?? 'MYR',
                paymentReference: paymentReference!,
                magicLinkUrl: redirectUrl,
                plainUploadUrl,
                expiresAtIso: paymentExpiresAt.toISOString(),
                bankName: pcConfig?.bankName ?? null,
                bankAccountNo: pcConfig?.bankAccountNo ?? null,
                bankAccountHolder: pcConfig?.bankAccountHolder ?? null,
                merchantQrUrl: pcConfig?.merchantQrCode?.url ?? null,
            })).catch((err: unknown) => console.error('[Email BT instructions]', err))
        }

        const confirmToken = generateConfirmToken(order.id, orderNumber)
        const res = NextResponse.json({
            success: true,
            data: {
                orderId: order.id,
                orderNumber,
                total,
                currency,
                paymentMethod,
                ...(redirectUrl ? { redirectUrl } : {}),
            },
        })
        // HttpOnly cookie so the confirm page can verify access without exposing token in URL
        res.cookies.set(`ct_${order.id}`, confirmToken, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60, // 30 days
            path: '/',
        })
        return res
    } catch (error: any) {
        console.error('[Order Checkout Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Checkout failed' } },
            { status: 500 }
        )
    }
}
