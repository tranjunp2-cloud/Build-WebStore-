import 'server-only'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { submitOrder } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { EasyParcelError } from '@/lib/shipping/easyparcel/types'
import { getDefaultWarehouse, isWarehouseComplete } from '@/lib/shipping/easyparcel/warehouse'
import { clampCollectionDate } from '@/lib/shipping/easyparcel/pickup-schedule'
import { buildSubmitParams } from './build-submit-params'
import { verifyCodEligibilityLive } from './verify-cod-eligibility'
import { resolveServiceForMethod, type CollectionMethod } from './resolve-collection-method'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/create-label
 *
 * Idempotent: if awbNo already set, returns existing label without charging.
 * Single-step submit (New EP API): submitOrder returns awb + tracking_number in one call.
 */
export const POST = withFeatureGuard('order_management')(withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const orderId = Number.isFinite(Number(id)) ? Number(id) : id
        const payload = await getPayload({ config })

        // Parse optional body (parcel weight override, collection date, collection method)
        let parcelWeightGrams: number | undefined
        let collectionDate: string | undefined
        let method: CollectionMethod | undefined
        try {
            const body = await request.json()
            if (typeof body?.parcelWeightGrams === 'number') parcelWeightGrams = body.parcelWeightGrams
            if (typeof body?.collectionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.collectionDate)) {
                collectionDate = body.collectionDate
            }
            // Absent method = legacy client → skip resolution, submit the stored service as-is
            if (body?.method === 'pickup' || body?.method === 'dropoff') method = body.method
        } catch { /* empty body is fine */ }

        // Load order with depth=2 to resolve tenant
        const order = await payload.findByID({
            collection: 'orders',
            id: orderId,
            user,
            overrideAccess: false,
            depth: 2,
        })

        if (!order) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
                { status: 404 },
            )
        }

        // Idempotency guard: key on shipment_number (easyParcelOrderNo), which is ALWAYS present on a
        // successful submit — awb_number may be null (async AWB), so keying on it would let a pending
        // shipment be re-submitted and double-charge the wallet.
        const existingShipmentNo = (order as any).easyParcelOrderNo as string | null | undefined
        const existingAwbNo = (order as any).awbNo as string | null | undefined
        const existingLabelUrl = (order as any).labelUrl as string | null | undefined
        // A "CLAIM:" sentinel is an in-progress claim (see the CAS below), NOT a created
        // shipment — treat it as not-yet-created so it falls through to the CAS (which returns
        // 409 for an active claim, or reclaims a stale one). Only a real shipment_number counts.
        if (existingShipmentNo && !existingShipmentNo.startsWith('CLAIM:')) {
            // Crash-remnant self-heal (review #1582 round 3): the shipment write and the
            // ready_to_ship flip below are two separate updates — a crash/DB hiccup between
            // them leaves a pre-ship order holding a REAL shipment, which the label guards
            // (claim CAS status filter + /cancel label guard) would otherwise strand. Flip
            // it on the retry the merchant inevitably makes; the CAS keeps it race-safe
            // (matches the exact shipment read above, never touches cancelled/shipped).
            if (['confirmed', 'paid', 'processing'].includes((order as any).status)) {
                await (payload.db.drizzle as any).execute(sql`
                    UPDATE orders SET status = 'ready_to_ship', updated_at = NOW()
                    WHERE id = ${orderId}
                      AND status IN ('confirmed', 'paid', 'processing')
                      AND easy_parcel_order_no = ${existingShipmentNo}
                `).catch((err: unknown) => {
                    // Non-fatal: the next retry heals it — but leave a trace for ops.
                    payload.logger.warn(
                        { orderId, err: err instanceof Error ? err.message : String(err) },
                        '[create-label] crash-remnant status heal failed',
                    )
                })
            }
            return NextResponse.json({ success: true, data: { alreadyCreated: true, awbNo: existingAwbNo, labelUrl: existingLabelUrl } })
        }

        // Fetch tenant with secrets (overrideAccess for token fields)
        const tenantRawId = typeof (order as any).tenant === 'object' ? (order as any).tenant?.id : (order as any).tenant
        const tenantWithKeys = await payload.findByID({
            collection: 'tenants',
            id: tenantRawId,
            depth: 0,
            overrideAccess: true,
        })

        const tenantEp = (tenantWithKeys as any)?.easyParcelIntegration
        if (!tenantEp?.enabled) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NOT_CONFIGURED', message: 'EasyParcel integration is not enabled for this store' } },
                { status: 422 },
            )
        }

        if (!tenantEp.accessToken) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NOT_CONFIGURED', message: 'EasyParcel not connected. Please connect via OAuth.' } },
                { status: 422 },
            )
        }

        let token: string
        try {
            token = await getValidToken(tenantEp, tenantRawId, payload)
        } catch (err) {
            if (err instanceof EasyParcelError && err.code === 'AUTH_EXPIRED') {
                return NextResponse.json(
                    { success: false, error: { code: 'EASYPARCEL_AUTH_ERROR', message: 'EasyParcel session expired. Please reconnect.' } },
                    { status: 422 },
                )
            }
            throw err
        }

        // Use the default pickup address (multi-warehouse aware, legacy single fallback) as the sender.
        // Must be complete (incl. phone) — EP submit_orders rejects an incomplete sender.
        const warehouse = getDefaultWarehouse(tenantEp)

        if (!isWarehouseComplete(warehouse)) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NOT_READY', message: 'Pickup address is incomplete in EasyParcel settings (name, phone, address, state, postcode required)' } },
                { status: 422 },
            )
        }

        const shippingAddress = (order as any).shippingAddress as {
            line1?: string; line2?: string; city?: string; state?: string; postcode?: string; country?: string
        } | undefined

        if (!shippingAddress?.postcode) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_ADDRESS', message: 'Order is missing recipient postcode' } },
                { status: 422 },
            )
        }

        const shippingServiceId = (order as any).shippingServiceId as string | undefined
        if (!shippingServiceId) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_SERVICE_ID', message: 'Order is missing shipping service ID' } },
                { status: 422 },
            )
        }

        const courier = (order as any).shippingCourier as string | undefined
        const weightGrams = parcelWeightGrams ?? ((order as any).parcelWeight as number | undefined) ?? 500

        // Read COD amount server-side — never trust client body. (Read here, above the
        // method resolver, because variant selection must prefer COD-capable services.)
        const codAmountSen = (order as any).codAmount as number | null | undefined

        // US-F36-07 correction: honor the merchant's pickup/drop-off choice. EP has no method
        // flag on submit — the service_id variant decides collection, and checkout stored the
        // cheapest variant (often drop-off). Resolve BEFORE the CAS claim (read-only quote, no
        // claim to release) and use the effective service for the COD gate + submit below.
        let effectiveServiceId = shippingServiceId
        let serviceSwitched: { serviceName: string; priceRm: number | null } | null = null
        // false only when method was requested but the verification quote failed (fail-open):
        // the label still books, but the collection method could not be confirmed.
        let methodResolved = true
        if (method) {
            const resolved = await resolveServiceForMethod({
                token,
                senderPostcode: warehouse.postcode ?? '',
                senderState: warehouse.state ?? '',
                receiverPostcode: shippingAddress.postcode,
                receiverState: shippingAddress.state ?? '',
                weightGrams,
                parcelValueRm: (order as any).total ?? 0,
                serviceId: shippingServiceId,
                method,
                codRequired: codAmountSen != null && codAmountSen > 0,
            })
            if (!resolved.ok) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'METHOD_NOT_SUPPORTED',
                            message: `This courier does not support ${method} on this route`,
                            supported: resolved.supported,
                        },
                    },
                    { status: 422 },
                )
            }
            if (resolved.changed) {
                effectiveServiceId = resolved.serviceId
                serviceSwitched = { serviceName: resolved.serviceName, priceRm: resolved.priceRm }
                payload.logger.info(
                    { orderId, from: shippingServiceId, to: resolved.serviceId, method },
                    '[create-label] service switched to match collection method',
                )
            }
            methodResolved = resolved.verified
        }

        // US-F36-07 AC-3b: never trust the client's collection date — re-compute the
        // earliest (cut-off aware, MYT) at request time and clamp past/weekend dates.
        // The shifted flag is returned so the UI can tell the merchant the date moved.
        const collection = clampCollectionDate(courier ?? '', collectionDate)

        const codAmountRm = (codAmountSen != null && codAmountSen > 0) ? codAmountSen / 100 : undefined

        // COD live re-check (PD-021 mirror gate): limits/cod.available may have changed since
        // checkout, and EP submit accepts ineligible COD silently (cash never collected).
        if (codAmountSen != null && codAmountSen > 0) {
            const codCheck = await verifyCodEligibilityLive({
                token,
                senderPostcode: warehouse.postcode ?? '',
                senderState: warehouse.state ?? '',
                receiverPostcode: shippingAddress.postcode,
                receiverState: shippingAddress.state ?? '',
                weightGrams,
                parcelValueRm: (order as any).total ?? 0,
                codAmountSen,
                serviceId: effectiveServiceId,
            })
            if (!codCheck.ok) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'COD_NOT_ELIGIBLE',
                            message: 'The selected courier can no longer collect COD for this order (per current route limits)',
                            reason: codCheck.reason,
                        },
                    },
                    { status: 422 },
                )
            }
        }

        // Single-step submit (New EP API auto-deducts wallet)
        const submitParams = buildSubmitParams({
            warehouse,
            shippingAddress,
            customerName: (order as any).customerName ?? '',
            customerPhone: (order as any).customerPhone ?? '',
            total: (order as any).total ?? 0,
            shippingServiceId: effectiveServiceId,
            shippingCourier: courier,
            weightGrams,
            collectionDate: collection.date,
            codAmountRm,
        })

        // F2: atomic claim guard against the double-charge race. Two concurrent requests could
        // both pass the `existingShipmentNo` idempotency check above (both read null), then both
        // call submitOrder → EP wallet charged twice. Claim the row here with a conditional
        // UPDATE (only succeeds while easy_parcel_order_no IS NULL) so only ONE request proceeds
        // to submitOrder; the loser gets 409. This reuses the existing idempotency column rather
        // than adding a new lock table/field (KISS) — release back to NULL on any failure path so
        // release-on-failure resets it to NULL. Self-healing on crash: the token embeds a
        // timestamp, and a claim older than CLAIM_TTL_MS is reclaimable — a real in-flight submit
        // finishes well within the TTL (epFetch timeout is 10s), so reclaiming a stale claim can
        // never double-charge an active submit. No permanent stuck state, no distributed lock.
        const CLAIM_TTL_MS = 120_000
        const claimToken = `CLAIM:${Date.now()}:${Math.random().toString(36).slice(2)}`
        const staleBefore = Date.now() - CLAIM_TTL_MS
        // Status guard INSIDE the claim CAS (review #1582): a /cancel racing this request
        // (both exits are open after mark-shipment-cancelled) could refund the buyer and
        // cancel the order between our read above and the submit below — without the guard
        // the claim would still win, charge the EP wallet, then resurrect the cancelled
        // order to ready_to_ship. 'paid'/'processing' kept for legacy Stripe orders whose
        // transitions still allow shipping.
        const claimResult = await (payload.db.drizzle as any).execute(sql`
            UPDATE orders SET easy_parcel_order_no = ${claimToken}
            WHERE id = ${orderId}
              AND status IN ('confirmed', 'paid', 'processing')
              AND (easy_parcel_order_no IS NULL
                   OR (easy_parcel_order_no LIKE 'CLAIM:%'
                       AND (split_part(easy_parcel_order_no, ':', 2))::bigint < ${staleBefore}))
            RETURNING id
        `)
        if (!claimResult.rows?.length) {
            // Distinguish "another request holds the claim" (409, retryable) from "the
            // order left a shippable status" (422, e.g. cancelled by a concurrent /cancel).
            const recheck = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 }).catch(() => null)
            const currentStatus = (recheck as any)?.status as string | undefined
            if (currentStatus && !['confirmed', 'paid', 'processing'].includes(currentStatus)) {
                return NextResponse.json(
                    { success: false, error: { code: 'INVALID_TRANSITION', message: `Cannot create a label for an order in "${currentStatus}" status` } },
                    { status: 422 },
                )
            }
            return NextResponse.json(
                { success: false, error: { code: 'LABEL_IN_PROGRESS', message: 'Label creation is already in progress for this order' } },
                { status: 409 },
            )
        }
        const releaseClaim = () => (payload.db.drizzle as any).execute(sql`
            UPDATE orders SET easy_parcel_order_no = NULL
            WHERE id = ${orderId} AND easy_parcel_order_no = ${claimToken}
        `).catch(() => {})

        let submitRes: Awaited<ReturnType<typeof submitOrder>>
        try {
            submitRes = await submitOrder(token, submitParams)
        } catch (err) {
            await releaseClaim()
            throw err
        }
        // Envelope: data[] (orders) → shipments[] (per order). We submit one parcel → one shipment.
        const firstShipment = submitRes.data?.[0]?.shipments?.[0]

        // status:'success' = shipment created + wallet charged. awb_number/label may still be null
        // (courier generates the AWB asynchronously) — that is NOT a failure.
        if (!firstShipment || firstShipment.status !== 'success' || !firstShipment.shipment_number) {
            await releaseClaim()
            // EP submit errors are NOT the documented string[] — verified sandbox 2026-07-09:
            // a nested array of objects, e.g. errors = [[{message:"Insufficient Credit Balance",
            // code:"InsufficientCreditBalance", data:{...}}]]. Flatten recursively to the first
            // human message; anything non-string passed through crashed the client ("Objects are
            // not valid as a React child") or degraded to the generic fallback.
            const flattenEpError = (v: unknown): { message: string; code: string } | null => {
                if (typeof v === 'string' && v.trim()) return { message: v, code: '' }
                if (Array.isArray(v)) {
                    for (const item of v) {
                        const found = flattenEpError(item)
                        if (found) return found
                    }
                    return null
                }
                if (v && typeof v === 'object') {
                    const o = v as { message?: unknown; code?: unknown }
                    if (typeof o.message === 'string' && o.message.trim()) {
                        return { message: o.message, code: typeof o.code === 'string' ? o.code : '' }
                    }
                    return flattenEpError(o.message)
                }
                return null
            }
            const epErr = flattenEpError(firstShipment?.errors)
            const errMsg = epErr?.message ?? 'EasyParcel failed to create shipment'
            const errCode = epErr?.code ?? ''
            // Raw errors logged whenever extraction misses — calibrates future unknown EP shapes.
            if (!epErr && firstShipment?.errors) {
                payload.logger.warn({ epErrors: firstShipment.errors }, '[create-label] unparsed EP error shape')
            }
            // Per-shipment "InsufficientCreditBalance" arrives as HTTP 200 + status:'error'
            // (unlike the thrown wallet errors handled in the catch below) — route it to the
            // same wallet-low code so the UI shows the Top Up panel instead of a generic error.
            if (errCode === 'InsufficientCreditBalance' || errMsg.toLowerCase().includes('insufficient credit')) {
                return NextResponse.json(
                    { success: false, error: { code: 'EASYPARCEL_WALLET_LOW', message: 'Insufficient EasyParcel wallet balance. Please top up and try again.' } },
                    { status: 402 },
                )
            }
            return NextResponse.json(
                { success: false, error: { code: 'EASYPARCEL_ERROR', message: errMsg } },
                { status: 502 },
            )
        }

        const awbNo = firstShipment.awb_number ?? null
        const labelUrl = firstShipment.awb_url || firstShipment.awb_urls_by_format?.A6 || firstShipment.awb_urls_by_format?.A4 || null
        // Per-format URLs power the print-modal A6/A4 toggle; formats EP didn't return stay absent
        const byFormat = firstShipment.awb_urls_by_format
        const labelUrls = byFormat && (byFormat.A4 || byFormat.A6)
            ? { ...(byFormat.A4 ? { A4: byFormat.A4 } : {}), ...(byFormat.A6 ? { A6: byFormat.A6 } : {}) }
            : null

        // Persist shipment_number (idempotency key), AWB (nullable), label + tracking urls.
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                easyParcelOrderNo: firstShipment.shipment_number,
                awbNo,
                trackingNumber: awbNo,
                labelUrl,
                labelUrls,
                shippingTrackingStatus: 'pending_pickup',
                // Seed the sync cursor so the cron's oldest-first (shippingTrackingLastUpdated ASC)
                // ordering includes this order instead of parking it at NULLS-LAST and starving it.
                shippingTrackingLastUpdated: new Date().toISOString(),
                // Collection date the label was actually bought with (post-clamp) —
                // shown as the locked "Pickup · DD/MM" line on the order detail.
                pickupScheduledAt: collection.date,
                ...(codAmountSen != null && codAmountSen > 0 ? { codStatus: 'pending' } : {}),
                // Method resolution booked a different service variant — keep the order's
                // service in sync with what EP actually charged/booked.
                ...(effectiveServiceId !== shippingServiceId ? { shippingServiceId: effectiveServiceId } : {}),
            } as any,
        })

        // Flip status to ready_to_ship only after successful submit
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: { status: 'ready_to_ship' } as any,
        })

        return NextResponse.json({
            success: true,
            data: {
                awbNo,
                trackingNumber: awbNo,
                labelUrl,
                collectionDate: collection.date,
                collectionDateShifted: collection.shifted,
                // Non-null when the stored service couldn't do the requested method and a
                // same-courier variant was booked instead (wallet charged that variant's price)
                serviceSwitched,
                // false = method verification quote failed (fail-open): label booked with the
                // stored service, collection method NOT confirmed against EP
                ...(method ? { methodResolved } : {}),
            },
        })
    } catch (error: unknown) {
        if (error instanceof EasyParcelError) {
            const isWalletLow = error.code === 'WALLET_LOW' || error.message.toLowerCase().includes('insufficient') || error.message.toLowerCase().includes('wallet')
            if (isWalletLow) {
                return NextResponse.json(
                    { success: false, error: { code: 'EASYPARCEL_WALLET_LOW', message: 'Insufficient EasyParcel wallet balance. Please top up and try again.' } },
                    { status: 402 },
                )
            }
            if (error.code === 'AUTH_EXPIRED') {
                return NextResponse.json(
                    { success: false, error: { code: 'EASYPARCEL_AUTH_ERROR', message: 'EasyParcel session expired. Please reconnect.' } },
                    { status: 422 },
                )
            }
            return NextResponse.json(
                { success: false, error: { code: 'EASYPARCEL_ERROR', message: error.message } },
                { status: 502 },
            )
        }
        console.error('[Create Label Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create shipping label' } },
            { status: 500 },
        )
    }
}))
