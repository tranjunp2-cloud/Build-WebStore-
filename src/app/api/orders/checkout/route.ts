import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parseRequest } from '@/lib/validations/helpers'
import { orderCreateSchema } from '@/lib/validations/orders'
import { getShippingRate } from '@/lib/shipping'
import { applyDiscount } from '@/lib/discounts/apply-discount'
import { recordDiscountRedemption } from '@/lib/discounts/record-discount-redemption'
import { releaseDiscountRedemption } from '@/lib/discounts/release-discount-redemption'
import { discountReserveErrorResponse } from '@/lib/discounts/messages'
import { computeOrderTotal, effectiveSubtotalSen } from '@/lib/orders/order-total'
import { generatePaymentReference } from '@/lib/payment/reference'
import { signOrderToken } from '@/lib/auth/order-token'
import { generateConfirmToken } from '@/lib/orders/upload-token'
import { bankTransferInstructionsEmail } from '@/lib/email/templates/bank-transfer-instructions'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { newOrderSellerEmail } from '@/lib/email/templates/new-order-seller'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { decrementVariantStock, restockItem } from '../lib/stock-utils'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { buildStorefrontUrl } from '@/lib/utils/storefront-url'

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

        const checkoutSub = await getActivePlanSubscription(payload, tenantId)
        if (checkoutSub && !await canUse(payload, checkoutSub.plan as PlanCode, 'allowing_buyer_making_order')) {
            return NextResponse.json(
                { success: false, error: { code: 'STORE_UNAVAILABLE', message: 'Checkout is currently unavailable' } },
                { status: 403 }
            )
        }
        const canSendBuyerEmail = !checkoutSub || await canUse(payload, checkoutSub.plan as PlanCode, 'email_confirmation')

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
        const hasVariantsMap = new Map<string, boolean>()
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
            hasVariantsMap.set(String(productLookupId), !!p.hasVariants)

            // Variant-aware availability: per-variant stock for variant products, aggregate otherwise.
            // NULL stock = tracking disabled (unlimited). Mirror non-variant ?? Infinity pattern.
            const stockAvail = (p.hasVariants && variant)
                ? (variant.stock != null ? variant.stock : Infinity)
                : (p.inventory ?? Infinity)

            if (stockAvail < item.quantity) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'OUT_OF_STOCK',
                            message: p.hasVariants
                                ? `"${p.name}" (${item.variant}) has only ${stockAvail} left`
                                : `"${p.name}" has only ${p.inventory ?? 0} left in stock`,
                            product: p.name,
                            ...(p.hasVariants ? { variant: item.variant } : {}),
                            available: stockAvail,
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

        // PR note: subtotal is RM-float (p.price * qty); shippingConfig rates are in sen (800 = RM 8)
        const subtotalSen = Math.round(subtotal * 100)

        // Discount: re-validate server-side from code — client amount is never trusted.
        // Resolved BEFORE shipping so the free-ship gate sees the discounted subtotal (F33 phase-07).
        let discountSen = 0
        let discountRow: any = null
        if (data.discountCode) {
            const code = String(data.discountCode).trim().toUpperCase()
            const discountResult = await payload.find({
                collection: 'discounts',
                // Site scoping (PRD §9): a discount with no `site` applies to every site of the tenant;
                // a site-scoped discount only resolves on its own site. Mismatch → not found → silent reject.
                where: {
                    and: [
                        { tenant: { equals: tenantId } },
                        { code: { equals: code } },
                        { or: [{ site: { exists: false } }, { site: { equals: siteLookupId } }] },
                    ],
                },
                limit: 1,
                depth: 0,
                overrideAccess: true,
            })
            discountRow = discountResult.docs[0] ?? null
            const applied = applyDiscount(discountRow as any, { subtotalSen, tenantId, now: new Date() })
            if (applied.ok) {
                discountSen = applied.discountSen
            } else if (applied.reason === 'at-limit') {
                // #10: the buyer applied this code (valid at Apply) but its last slot was taken by another
                // buyer before they placed the order. BLOCK + warn here — never silently charge full price.
                // No order is created yet, so nothing to roll back. (The post-create reserve below still
                // guards the tighter race where two buyers both pass this stale check concurrently.)
                const e = discountReserveErrorResponse('at-limit')
                return NextResponse.json(
                    { success: false, error: { code: e.code, message: e.message } },
                    { status: e.httpStatus },
                )
            } else {
                discountRow = null // other reasons (not-found/expired/inactive): silent reject — full price
            }
        }
        const discountRM = discountSen / 100

        // Shipping: rates stored in sen, subtotal is RM-float → convert for calc, result back to RM.
        // Free-ship gates on the POST-discount subtotal (F33 phase-07): a discount that drops the cart
        // below `freeAbove` now charges shipping. Discount amount itself stays on the original subtotal.
        const effSubtotalSen = effectiveSubtotalSen(subtotalSen, discountSen)
        const shippingFeeSen = getShippingRate(customer.address.state, (site as any).shippingConfig, effSubtotalSen)
        const shippingFee = shippingFeeSen / 100

        // SST tax removed at checkout (F33 phase-06) — kept as 0 so the column stays populated;
        // historical orders retain their real tax value, new orders carry none.
        const tax = 0

        // Shared gateway-agnostic total (F33): total = max(0, subtotal − discount) + shipping, sen-exact.
        const { total } = computeOrderTotal({ subtotalSen, discountSen, shippingFeeSen })

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
                ...(discountRow ? {
                    discount: discountRow.id,
                    discountCode: discountRow.code,
                    discountAmount: discountSen,
                } : {}),
                locale: (site as any).locale ?? 'en',
            } as any,
        })

        // Reserve the discount slot at PLACE ORDER (#10/#11) — like inventory, for every gateway. If the
        // last slot was just taken by a concurrent buyer, HARD-BLOCK here: no stock is decremented yet, so
        // just delete the order and 409 so the storefront can warn the buyer instead of letting them place
        // the order at full price unknowingly. The slot is released on cancel / refund / 24h payment-expiry.
        if (discountRow && discountSen > 0) {
            const reserve = await recordDiscountRedemption(payload, {
                tenantId: Number(tenantId),
                discountId: Number(discountRow.id),
                orderId: Number((order as any).id),
                amountApplied: discountSen,
                discountCode: discountRow.code,
                discountType: discountRow.type,
                discountValue: Number(discountRow.value),
                customerEmail: customer.email,
            })
            if (!reserve.recorded) {
                await payload.delete({ collection: 'orders', id: (order as any).id, overrideAccess: true }).catch(() => null)
                const e = discountReserveErrorResponse(reserve.status)
                return NextResponse.json(
                    { success: false, error: { code: e.code, message: e.message } },
                    { status: e.httpStatus },
                )
            }
        }

        // Decrement inventory for COD and bank_transfer at checkout time.
        // bank_transfer: stock is reserved immediately; restock only on cancel or refund.
        // Seller reject does NOT restock — customer is expected to resubmit proof.
        // CAS-style: UPDATE WHERE inventory >= qty prevents oversell under concurrent requests.
        // Compensation: if any item fails the CAS, re-increment all already-decremented items
        // and delete the order so the buyer sees a clear out-of-stock error.
        if (paymentMethod === 'cod' || paymentMethod === 'bank_transfer') {
            const decremented: Array<{ productId: number | string; quantity: number; variantName?: string; kind: 'variant' | 'aggregate' }> = []
            let failedItem: string | undefined
            let failedVariant: string | undefined
            let failedReason: 'insufficient_stock' | 'product_not_found' | 'write_failed' | undefined

            for (const item of aggregatedItems) {
                const productId = typeof item.productId === 'string' && !isNaN(Number(item.productId))
                    ? Number(item.productId) : item.productId
                const isVariant = !!(hasVariantsMap.get(String(productId)) && item.variant)

                if (isVariant) {
                    const res = await decrementVariantStock(payload, productId, item.variant!, item.quantity)
                    if (!res.ok) {
                        failedItem = String(item.productId)
                        failedVariant = item.variant
                        if (res.reason === 'variant_not_found') {
                            // ORM/DB inconsistency: variant passed validation but missing from products_variants
                            console.error('[Stock Decrement] variant_not_found — data integrity issue', {
                                productId: String(productId),
                                variant: item.variant,
                            })
                        }
                        switch (res.reason) {
                            case 'insufficient_stock': failedReason = 'insufficient_stock'; break
                            case 'null_inventory':      failedReason = 'insufficient_stock'; break
                            case 'product_not_found':   failedReason = 'product_not_found'; break
                            case 'variant_not_found':   failedReason = 'product_not_found'; break
                            default:                    failedReason = 'write_failed'
                        }
                        break
                    }
                    decremented.push({ productId, quantity: item.quantity, variantName: item.variant, kind: 'variant' })
                } else {
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
                            decremented.push({ productId, quantity: item.quantity, kind: 'aggregate' })
                        } else {
                            failedItem = String(item.productId)
                            // Distinguish deleted product from genuine OOS — mirrors decrementVariantStock behaviour
                            const exists = await (payload.db.drizzle as any).execute(sql`
                                SELECT id FROM products WHERE id = ${productId} LIMIT 1
                            `)
                            failedReason = exists.rows?.length ? 'insufficient_stock' : 'product_not_found'
                            break
                        }
                    } catch (err) {
                        console.warn(`[Stock Decrement] CAS failed for product ${item.productId}:`, err)
                        failedItem = String(item.productId)
                        failedReason = 'write_failed'
                        break
                    }
                }
            }

            if (failedReason) {
                // Compensate: re-increment all previously decremented items
                for (const d of decremented) {
                    if (d.kind === 'variant' && d.variantName) {
                        const comp = await restockItem(payload, d.productId, d.variantName, d.quantity)
                        if (comp.skipped) {
                            console.error('[Stock Compensation] Variant re-increment failed — manual inventory reconciliation required', {
                                orderId: order.id,
                                productId: d.productId,
                                variantName: d.variantName,
                                reason: comp.reason,
                            })
                        }
                    } else {
                        try {
                            const compResult = await (payload.db.drizzle as any).execute(sql`
                                UPDATE products SET inventory = inventory + ${d.quantity}
                                WHERE id = ${d.productId} AND inventory IS NOT NULL
                                RETURNING id
                            `)
                            if (!compResult.rows?.length) {
                                console.error(`[Stock Decrement] Compensation re-increment returned 0 rows for product ${d.productId} — manual inventory reconciliation required`, {
                                    orderId: order.id,
                                    productId: d.productId,
                                })
                            }
                        } catch (e) {
                            console.error(`[Stock Decrement] Compensation re-increment failed for product ${d.productId}:`, e)
                        }
                    }
                }
                // Release the discount slot reserved above — this order is about to be deleted, so it must
                // not keep holding a slot (idempotent + non-throwing).
                await releaseDiscountRedemption(payload, Number(order.id))
                // Sentinel: mark cancelled before delete so any concurrent/future cancel call
                // returns idempotent success (shouldRestock=false) rather than re-incrementing
                // already-compensated stock when delete fails (FK constraint, transient error).
                await payload.update({
                    collection: 'orders',
                    id: order.id,
                    data: { status: 'cancelled' } as any,
                    overrideAccess: true,
                }).catch((e: unknown) => console.error(
                    `[Stock Decrement] Failed to mark orphaned order ${order.id} cancelled before delete:`, e
                ))
                // Delete the just-created order to keep DB consistent
                await payload.delete({ collection: 'orders', id: order.id, overrideAccess: true })
                    .catch((e: unknown) => console.error(`[Stock Decrement] Failed to delete orphaned order ${order.id} after CAS failure — manual cleanup required:`, e))
                const failedMessages: Record<NonNullable<typeof failedReason>, string> = {
                    insufficient_stock: `Product ${failedItem} ran out of stock — please reduce quantity and try again`,
                    product_not_found:  `Product ${failedItem} is no longer available — please remove it from your cart and try again`,
                    write_failed:       `Stock update failed for product ${failedItem} — please try again`,
                }
                const errorCode = failedReason === 'write_failed'
                    ? 'STOCK_UPDATE_FAILED'
                    : failedReason === 'product_not_found'
                    ? 'PRODUCT_NOT_FOUND'
                    : 'OUT_OF_STOCK'
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: errorCode,
                            message: failedMessages[failedReason],
                            ...(failedVariant ? { variant: failedVariant } : {}),
                        },
                    },
                    { status: 422 },
                )
            }
        }

        // Resolve tenant slug + name — tenantForSlug already fetched above for payment validation
        const shopName = (tenantForSlug as any)?.name ?? ''
        const ownerEmails = await getTenantOwnerEmails(payload, tenantId)
        const supportEmail = ownerEmails[0] ?? ''
        const siteSlug = (tenantForSlug as any)?.slug ?? String(siteId)
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? ''
        const orderPageUrl = buildStorefrontUrl(siteSlug, `/orders/${orderNumber}`)
        const dashboardOrderUrl = `${baseUrl}/orders`
        const siteLocale = (site as any).locale ?? 'en'

        // COD: confirmation to buyer + new-order notification to seller(s)
        if (paymentMethod === 'cod') {
            const [codCmsConfig, sellerCmsConfig] = await Promise.all([
                getTemplateConfig(tenantId, 'order-confirmation', 'buyer', siteLocale),
                getTemplateConfig(tenantId, 'new-order-seller', 'seller', siteLocale),
            ])

            if (codCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): order-confirmation (COD)')
            } else {
                const codEmail = orderConfirmationEmail({
                    shopName,
                    supportEmail,
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
                    // Discount line — amount in RM (template formats with the same fp() as subtotal)
                    discountCode: discountRow?.code ?? null,
                    discountAmount: discountRM || null,
                    paymentMethod: 'cod',
                    orderDate: new Date().toISOString(),
                    orderPageUrl,
                    currency,
                    buyerNote: (order as any).notes ?? null,
                    locale: siteLocale,
                }, codCmsConfig ?? undefined)
                if (canSendBuyerEmail) {
                    payload.sendEmail({ to: customer.email, subject: codEmail.subject, html: codEmail.html })
                        .catch((err: unknown) => console.error('[Email COD confirmation]', err))
                }
            }

            if (sellerCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): new-order-seller (COD)')
            } else {
                const seller = newOrderSellerEmail({ shopName, orderNumber, customerName: customer.name, orderPageUrl: dashboardOrderUrl, items: orderItems.map((i) => ({ name: i.productName, variant: i.variant || undefined, quantity: i.quantity, lineTotal: i.unitPrice * i.quantity })), orderTotal: order.total, shippingFee, currency: order.currency ?? 'MYR', locale: siteLocale }, sellerCmsConfig ?? undefined)
                ownerEmails.forEach((to) => payload.sendEmail({ to, subject: seller.subject, html: seller.html })
                    .catch((err: unknown) => console.error('[Email seller notify COD]', err)))
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
                getTemplateConfig(tenantId, 'bank-transfer-instructions', 'buyer', siteLocale),
                getTemplateConfig(tenantId, 'new-order-seller', 'seller', siteLocale),
            ])

            if (btCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): bank-transfer-instructions')
            } else {
                const btEmail = bankTransferInstructionsEmail({
                    shopName,
                    supportEmail,
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
                    // Discount line — amount in RM (template formats with the same fp() as subtotal)
                    discountCode: discountRow?.code ?? null,
                    discountAmount: discountRM || null,
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
                if (canSendBuyerEmail) {
                    payload.sendEmail({ to: customer.email, subject: btEmail.subject, html: btEmail.html })
                        .catch((err: unknown) => console.error('[Email BT instructions]', err))
                }
            }

            if (btSellerCmsConfig?.enabled === false) {
                console.log('[Email] suppressed (disabled): new-order-seller (BT)')
            } else {
                const seller = newOrderSellerEmail({ shopName, orderNumber, customerName: customer.name, orderPageUrl: dashboardOrderUrl, items: orderItems.map((i) => ({ name: i.productName, variant: i.variant || undefined, quantity: i.quantity, lineTotal: i.unitPrice * i.quantity })), orderTotal: order.total, shippingFee, currency: order.currency ?? 'MYR', locale: siteLocale }, btSellerCmsConfig ?? undefined)
                ownerEmails.forEach((to) => payload.sendEmail({ to, subject: seller.subject, html: seller.html })
                    .catch((err: unknown) => console.error('[Email seller notify BT]', err)))
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
