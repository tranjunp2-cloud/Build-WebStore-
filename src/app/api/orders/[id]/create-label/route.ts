import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { withFeatureGuard } from '@/lib/subscriptions/feature-guard'
import { submitOrder, payOrder } from '@/lib/shipping/easyparcel/client'
import { EasyParcelError } from '@/lib/shipping/easyparcel/types'
import type { EasyParcelConfig } from '@/lib/shipping/easyparcel/types'
import { buildSubmitParams } from './build-submit-params'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/create-label
 *
 * Idempotent: if awbNo already set, returns existing label without charging.
 * Recovery: if easyParcelOrderNo set but awbNo null, skips submit and retries pay only.
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

        // Load order with depth=2 to resolve tenant.easyParcelIntegration
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
                { status: 404 }
            )
        }

        // Idempotency guard: already labelled
        const existingAwbNo = (order as any).awbNo as string | null | undefined
        const existingLabelUrl = (order as any).labelUrl as string | null | undefined
        if (existingAwbNo) {
            return NextResponse.json({ success: true, data: { alreadyCreated: true, awbNo: existingAwbNo, labelUrl: existingLabelUrl } })
        }

        // Fetch tenant with secrets (overrideAccess for apiKey/authKey)
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
                { status: 422 }
            )
        }

        const epConfig: EasyParcelConfig = {
            apiKey: tenantEp.apiKey as string,
            authKey: tenantEp.authKey as string,
            env: (tenantEp.detectedEnv ?? 'production') as 'production' | 'demo',
        }

        const warehouse = tenantEp.warehouse as {
            name?: string; phone?: string; addr1?: string; addr2?: string
            city?: string; state?: string; postcode?: string; country?: string
        } | undefined

        if (!warehouse?.addr1) {
            return NextResponse.json(
                { success: false, error: { code: 'EP_NO_WAREHOUSE', message: 'Warehouse address not configured in EasyParcel settings' } },
                { status: 422 }
            )
        }

        const shippingAddress = (order as any).shippingAddress as {
            line1?: string; line2?: string; city?: string; state?: string; postcode?: string; country?: string
        } | undefined

        if (!shippingAddress?.postcode) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_ADDRESS', message: 'Order is missing recipient postcode' } },
                { status: 422 }
            )
        }

        const shippingServiceId = (order as any).shippingServiceId as string | undefined
        if (!shippingServiceId) {
            return NextResponse.json(
                { success: false, error: { code: 'MISSING_SERVICE_ID', message: 'Order is missing shipping service ID' } },
                { status: 422 }
            )
        }

        const courier = (order as any).shippingCourier as string | undefined
        const weightGrams = parcelWeightGrams ?? ((order as any).parcelWeight as number | undefined) ?? 500

        // Recovery matrix: check if order_no already exists (step 1 succeeded but step 2 failed)
        let epOrderNo = (order as any).easyParcelOrderNo as string | null | undefined

        // Read COD amount server-side — never trust client body
        const codAmountSen = (order as any).codAmount as number | null | undefined
        const codAmountRm = (codAmountSen != null && codAmountSen > 0) ? codAmountSen / 100 : undefined

        if (!epOrderNo) {
            // Step 1: Submit order to EP
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

            const submitRes = await submitOrder(epConfig, submitParams)

            if (!submitRes.order_no) {
                return NextResponse.json(
                    { success: false, error: { code: 'EASYPARCEL_ERROR', message: 'EasyParcel failed to reserve order. Please try again.' } },
                    { status: 502 }
                )
            }

            epOrderNo = submitRes.order_no

            // Checkpoint: persist easyParcelOrderNo before paying (recovery if pay fails)
            await payload.update({
                collection: 'orders',
                id: orderId,
                data: { easyParcelOrderNo: epOrderNo } as any,
            })
        }

        // Step 2: Pay order (charges EP wallet)
        const payRes = await payOrder(epConfig, { order_no: epOrderNo })

        if (!payRes.awb_no) {
            return NextResponse.json(
                { success: false, error: { code: 'EASYPARCEL_ERROR', message: 'EasyParcel payment failed. Please check your wallet balance and try again.' } },
                { status: 502 }
            )
        }

        // Persist AWB + label + tracking status (+ codStatus if COD order)
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: {
                awbNo: payRes.awb_no,
                labelUrl: payRes.label_url ?? null,
                shippingTrackingStatus: 'pending_pickup',
                easyParcelOrderNo: epOrderNo,
                ...(codAmountSen != null && codAmountSen > 0 ? { codStatus: 'pending' } : {}),
            } as any,
        })

        // Flip status to ready_to_ship ONLY after payOrder success
        await payload.update({
            collection: 'orders',
            id: orderId,
            data: { status: 'ready_to_ship' } as any,
        })

        return NextResponse.json({
            success: true,
            data: { awbNo: payRes.awb_no, labelUrl: payRes.label_url ?? null },
        })
    } catch (error: unknown) {
        if (error instanceof EasyParcelError) {
            const isWalletLow = error.code === 'WALLET_LOW' || error.message.toLowerCase().includes('insufficient') || error.message.toLowerCase().includes('wallet')
            if (isWalletLow) {
                return NextResponse.json(
                    { success: false, error: { code: 'EASYPARCEL_WALLET_LOW', message: 'Insufficient EasyParcel wallet balance. Please top up and try again.' } },
                    { status: 402 }
                )
            }
            if (error.code === 'AUTH_ERROR' || error.message.toLowerCase().includes('auth')) {
                return NextResponse.json(
                    { success: false, error: { code: 'EASYPARCEL_AUTH_ERROR', message: 'EasyParcel authentication failed. Check your API credentials.' } },
                    { status: 422 }
                )
            }
            return NextResponse.json(
                { success: false, error: { code: 'EASYPARCEL_ERROR', message: error.message } },
                { status: 502 }
            )
        }
        console.error('[Create Label Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create shipping label' } },
            { status: 500 }
        )
    }
}))
