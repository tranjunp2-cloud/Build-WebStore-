import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { submitOrder } from '@/lib/shipping/easyparcel/client'
import { getValidToken } from '@/lib/shipping/easyparcel/token-manager'
import { EasyParcelError } from '@/lib/shipping/easyparcel/types'
import { buildSubmitParams } from './build-submit-params'

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

        // Parse optional body (parcel weight override, collection date)
        let parcelWeightGrams: number | undefined
        let collectionDate: string | undefined
        try {
            const body = await request.json()
            if (typeof body?.parcelWeightGrams === 'number') parcelWeightGrams = body.parcelWeightGrams
            if (typeof body?.collectionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.collectionDate)) {
                collectionDate = body.collectionDate
            }
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

        // Idempotency guard: already labelled — return existing without re-submitting
        const existingAwbNo = (order as any).awbNo as string | null | undefined
        const existingLabelUrl = (order as any).labelUrl as string | null | undefined
        if (existingAwbNo) {
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

        const warehouse = tenantEp.warehouse as {
            name?: string; phone?: string; address1?: string; address2?: string
            city?: string; state?: string; postcode?: string; country?: string
        } | undefined

        if (!warehouse?.address1) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NO_WAREHOUSE', message: 'Warehouse address not configured in EasyParcel settings' } },
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

        // Read COD amount server-side — never trust client body
        const codAmountSen = (order as any).codAmount as number | null | undefined
        const codAmountRm = (codAmountSen != null && codAmountSen > 0) ? codAmountSen / 100 : undefined

        // Single-step submit (New EP API auto-deducts wallet)
        const submitParams = buildSubmitParams({
            warehouse,
            shippingAddress,
            customerName: (order as any).customerName ?? '',
            customerPhone: (order as any).customerPhone ?? '',
            total: (order as any).total ?? 0,
            shippingServiceId,
            shippingCourier: courier,
            weightGrams,
            collectionDate,
            codAmountRm,
        })

        const submitRes = await submitOrder(token, submitParams)
        const firstShipment = submitRes.data?.shipment?.[0]

        if (!firstShipment || firstShipment.status === 'error' || !firstShipment.awb) {
            const errMsg = firstShipment?.errors?.[0] ?? 'EasyParcel failed to create shipment'
            return NextResponse.json(
                { success: false, error: { code: 'EASYPARCEL_ERROR', message: errMsg } },
                { status: 502 },
            )
        }

        // Persist AWB + tracking_number + shipment_id (reuses easyParcelOrderNo col)
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                awbNo: firstShipment.awb,
                trackingNumber: firstShipment.tracking_number ?? firstShipment.awb,
                easyParcelOrderNo: firstShipment.shipment_id ?? null,
                labelUrl: null,  // New API does not return label_url in submit response
                shippingTrackingStatus: 'pending_pickup',
                ...(codAmountSen != null && codAmountSen > 0 ? { codStatus: 'pending' } : {}),
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
            data: { awbNo: firstShipment.awb, trackingNumber: firstShipment.tracking_number ?? firstShipment.awb },
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
