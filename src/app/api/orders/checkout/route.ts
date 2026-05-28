import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCreateSchema } from '@/lib/validations/orders'
import { getShippingRate } from '@/lib/shipping'
import { generatePaymentReference } from '@/lib/payment/reference'
import { signOrderToken } from '@/lib/auth/order-token'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { bankTransferInstructionsEmail } from '@/lib/email/templates/bank-transfer-instructions'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { newOrderSellerEmail } from '@/lib/email/templates/new-order-seller'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import { getTemplateConfig } from '@/lib/email/get-template-config'

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

        // Fetch tenant early — needed for both payment validation and email generation below
        const tenantForSlug = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
        const tenantPayments = (tenantForSlug as any)?.payments ?? {}

        // Enforce payment method availability: tenant master flag (dashboard toggle) AND site-level guard
        // site.paymentConfig.enableCod/enableQrBanking is a site-level opt-out (default true)
        // tenant.payments.payment_cod/payment_qr is the seller's explicit enable in Payment Settings (default false)
        const pc = (site as any).paymentConfig
        if (paymentMethod === 'cod' && (tenantPayments.payment_cod !== true || pc?.enableCod === false)) {
            return NextResponse.json(
                { success: false, error: { code: 'PAYMENT_METHOD_DISABLED', message: 'COD is not available for this store' } },
                { status: 422 }
            )
        }
        if (paymentMethod === 'bank_transfer' && (tenantPayments.payment_qr !== true || pc?.enableQrBanking === false)) {
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

            // Guard: hasVariants products require an explicit variant selection
            if (p.hasVariants && !item.variant) {
                return NextResponse.json(
                    { success: false, error: { code: 'VARIANT_REQUIRED', message: `A variant must be selected for "${p.name}"` } },
                    { status: 422 }
                )
            }

            // Variant resolution — depth:0 is safe: variants is an array field, present on the doc
            const variant = (p.hasVariants && item.variant && Array.isArray(p.variants))
                ? (p.variants as Array<{ name: string; price: number; stock?: number }>).find(v => v.name === item.variant) ?? null
                : null

            // Stale or unknown variant → reject; prevents silent base-price fallback exploit
            if (p.hasVariants && item.variant && !variant) {
                return NextResponse.json(
                    { success: false, error: { code: 'VARIANT_NOT_FOUND', message: `Variant "${item.variant}" not found for "${p.name}"` } },
                    { status: 422 }
                )
            }

            const unitPrice = variant ? variant.price : p.price
            // Advisory OOS guard: use aggregate p.inventory (decremented by COD CAS in stock-cas.ts).
            // Per-variant stock decrement (products_variants.stock) is a follow-up task — variant.stock
            // is never decremented today, so reading it would give a permanently stale value.
            const stockAvail = p.inventory ?? Infinity

            if (stockAvail < item.quantity) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'OUT_OF_STOCK',
                            message: `"${p.name}" has only ${p.inventory ?? 0} left in stock`,
                            product: p.name,
                            available: p.inventory ?? 0,
                            requested: item.quantity,
                        },
                    },
                    { status: 422 }
                )
            }

            currency = p.currency || 'MYR'
            subtotal += unitPrice * item.quantity

            orderItems.push({
                product: productLookupId,
                productName: p.name,
                variant: item.variant || '',
                quantity: item.quantity,
                unitPrice,
            })
        }

        if (orderItems.length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid products' } },
                { status: 422 }
            )
        }

        if (!customer.phone?.trim()) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Phone number is required' } },
                { status: 422 }
            )
        }

        if (!customer.address?.line1?.trim()) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Address line 1 is required' } },
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
        // CAS-style: UPDATE WHERE inventory >= qty prevents oversell under concurrent requests.
        // Compensation: if any item fails the CAS, re-increment all already-decremented items
        // and delete the order so the buyer sees a clear out-of-stock error.
        if (paymentMethod === 'cod') {
            const decremented: Array<{ productId: number | string; quantity: number }> = []
            let failedItem: string | undefined

            for (const item of aggregatedItems) {
                const productId = typeof item.productId === 'string' && !isNaN(Number(item.productId))
                    ? Number(item.productId) : item.productId
                try {
                    const result = await (payload.db.drizzle as any).execute(sql`
                        UPDATE products
                        SET inventory = inventory - ${item.quantity}
                        WHERE id = ${productId}
                        AND inventory IS NOT NULL
                        AND inventory >= ${item.quantity}
                        RETURNING id
                    `)
                    if (result.rows?.length) {
                        decremented.push({ productId, quantity: item.quantity })
                    } else {
                        failedItem = String(item.productId)
                        break
                    }
                } catch (err) {
                    console.warn(`[Stock Decrement] CAS failed for product ${item.productId}:`, err)
                    failedItem = String(item.productId)
                    break
                }
            }

            if (failedItem) {
                // Compensate: re-increment all previously decremented items
                for (const p of decremented) {
                    try {
                        await (payload.db.drizzle as any).execute(sql`
                            UPDATE products SET inventory = inventory + ${p.quantity}
                            WHERE id = ${p.productId} AND inventory IS NOT NULL
                        `)
                    } catch (e) {
                        console.error(`[Stock Decrement] Compensation re-increment failed for product ${p.productId}:`, e)
                    }
                }
                // Delete the just-created order to keep DB consistent
                await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true })
                    .catch((e: unknown) => console.error(`[Stock Decrement] Failed to delete orphaned order ${order.id} after CAS failure — manual cleanup required:`, e))
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'OUT_OF_STOCK',
                            message: `Product ${failedItem} ran out of stock — please reduce quantity and try again`,
                        },
                    },
                    { status: 422 },
                )
            }
        }

        // Resolve tenant slug + name — tenantForSlug already fetched above for payment validation
        const shopName = (tenantForSlug as any)?.name ?? ''
        const siteSlug = (tenantForSlug as any)?.slug ?? String(siteId)
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
        const orderPageUrl = `${baseUrl}/sites/${siteSlug}/orders/${orderNumber}`
        const dashboardOrderUrl = `${baseUrl}/orders`
        const siteLocale = (site as any).locale ?? 'ms'

        // COD: confirmation to buyer + new-order notification to seller(s)
        if (paymentMethod === 'cod') {
            const [codCmsConfig, sellerCmsConfig] = await Promise.all([
                getTemplateConfig(tenantId, 'order-confirmation', 'buyer'),
                getTemplateConfig(tenantId, 'new-order-seller', 'seller'),
            ])

            if (codCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): order-confirmation (COD)')
            } else {
                const codEmail = orderConfirmationEmail({
                    shopName,
                    orderNumber: orderNumber,
                    customerName: customer.name,
                    customerEmail: customer.email,
                    customerPhone: customer.phone ?? null,
                    customerAddress: customer.address ?? null,
                    items: orderItems.map((item) => ({
                        name: item.productName,
                        variant: item.variant || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        lineTotal: item.quantity * item.unitPrice,
                    })),
                    subtotal,
                    shippingFee,
                    total,
                    paymentMethod: 'cod',
                    orderDate: new Date().toISOString(),
                    orderPageUrl,
                    currency,
                    buyerNote: (order as any).notes ?? null,
                    locale: siteLocale,
                }, codCmsConfig ?? undefined)
                payload.sendEmail({ to: customer.email, subject: codEmail.subject, html: codEmail.html })
                    .catch((err: unknown) => console.error('[Email COD confirmation]', err))
            }

            if (sellerCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): new-order-seller (COD)')
            } else {
                getTenantOwnerEmails(payload, tenantId).then((emails) => {
                    const seller = newOrderSellerEmail({ shopName, orderNumber, customerName: customer.name, orderPageUrl: dashboardOrderUrl }, sellerCmsConfig ?? undefined)
                    emails.forEach((to) => payload.sendEmail({ to, subject: seller.subject, html: seller.html })
                        .catch((err: unknown) => console.error('[Email seller notify COD]', err)))
                }).catch(() => {})
            }
        }

        // bank_transfer: instructions to buyer + new-order notification to seller(s) + magic link for proof upload
        let redirectUrl: string | undefined

        if (paymentMethod === 'bank_transfer' && magicLinkSecret && paymentExpiresAt) {
            const expSec = Math.floor(paymentExpiresAt.getTime() / 1000)
            const token = await signOrderToken({
                orderId: order.id,
                secret: magicLinkSecret,
                expSec,
            })
            redirectUrl = `${baseUrl}/api/orders/${order.id}/confirm-redirect?slug=${siteSlug}&token=${token}`
            const plainUploadUrl = redirectUrl

            const pcConfig = (site as any).paymentConfig
            const [btCmsConfig, btSellerCmsConfig] = await Promise.all([
                getTemplateConfig(tenantId, 'bank-transfer-instructions', 'buyer'),
                getTemplateConfig(tenantId, 'new-order-seller', 'seller'),
            ])

            if (btCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): bank-transfer-instructions')
            } else {
                const btEmail = bankTransferInstructionsEmail({
                    shopName,
                    orderNumber: order.orderNumber,
                    customerName: customer.name,
                    customerEmail: customer.email,
                    customerPhone: customer.phone ?? null,
                    customerAddress: customer.address ?? null,
                    items: orderItems.map((item) => ({
                        name: item.productName,
                        variant: item.variant || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        lineTotal: item.quantity * item.unitPrice,
                    })),
                    subtotal,
                    shippingFee,
                    total: order.total,
                    currency: order.currency ?? 'MYR',
                    buyerNote: (order as any).notes ?? null,
                    orderDate: new Date().toISOString(),
                    paymentReference: paymentReference!,
                    magicLinkUrl: redirectUrl,
                    plainUploadUrl,
                    expiresAtIso: paymentExpiresAt.toISOString(),
                    bankName: pcConfig?.bankName ?? null,
                    bankAccountNo: pcConfig?.bankAccountNo ?? null,
                    bankAccountHolder: pcConfig?.bankAccountHolder ?? null,
                    merchantQrUrl: pcConfig?.merchantQrCode?.url ?? null,
                    locale: siteLocale,
                }, btCmsConfig ?? undefined)
                payload.sendEmail({ to: customer.email, subject: btEmail.subject, html: btEmail.html })
                    .catch((err: unknown) => console.error('[Email BT instructions]', err))
            }

            if (btSellerCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): new-order-seller (BT)')
            } else {
                getTenantOwnerEmails(payload, tenantId).then((emails) => {
                    const seller = newOrderSellerEmail({ shopName, orderNumber, customerName: customer.name, orderPageUrl: dashboardOrderUrl }, btSellerCmsConfig ?? undefined)
                    emails.forEach((to) => payload.sendEmail({ to, subject: seller.subject, html: seller.html })
                        .catch((err: unknown) => console.error('[Email seller notify BT]', err)))
                }).catch(() => {})
            }
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
            secure: process.env.NODE_ENV === 'production',
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
