import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { updateDiscountSchema } from '@/lib/validations/discounts'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/v1/discounts/[id]
 */
export const GET = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        const discount = await payload.findByID({
            collection: 'discounts',
            id,
            depth: 1,
            user,
            overrideAccess: false,
            disableErrors: true,
        })

        if (!discount) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } },
                { status: 404 },
            )
        }

        return NextResponse.json({ success: true, data: discount })
    } catch (error: any) {
        console.error('[Discount Get Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load discount' } },
            { status: 500 },
        )
    }
})

/**
 * PUT /api/v1/discounts/[id]
 *
 * Update a discount. usageCount and tenant are stripped — never client-writable.
 */
export const PUT = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, updateDiscountSchema)
        if (errorResponse) return errorResponse

        const payload = await getPayload({ config })

        // Verify exists + access before update
        const existing = await payload.findByID({
            collection: 'discounts',
            id,
            user,
            overrideAccess: false,
        })

        if (!existing) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } },
                { status: 404 },
            )
        }

        // Strip protected fields — usageCount has access.update:false on the collection,
        // but defence-in-depth: strip explicitly here too
        const { usageCount: _uc, tenant: _t, ...safeData } = data as any

        let updated
        try {
            updated = await payload.update({
                collection: 'discounts',
                id,
                data: safeData,
                user,
                overrideAccess: false,
            })
        } catch (err: any) {
            if (err?.message?.includes('duplicate') || err?.message?.includes('unique') || err?.code === '23505') {
                return NextResponse.json(
                    { success: false, error: { code: 'DUPLICATE_CODE', message: 'This code is already in use for your tenant. Try a different code or append a number.' } },
                    { status: 409 },
                )
            }
            throw err
        }

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        console.error('[Discount Update Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update discount' } },
            { status: 500 },
        )
    }
})

/**
 * DELETE /api/v1/discounts/[id]
 */
export const DELETE = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const { id } = await ctx.params
        const payload = await getPayload({ config })

        const existing = await payload.findByID({
            collection: 'discounts',
            id,
            user,
            overrideAccess: false,
        })

        if (!existing) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } },
                { status: 404 },
            )
        }

        await payload.delete({
            collection: 'discounts',
            id,
            user,
            overrideAccess: false,
        })

        // 204 No Content — delete succeeded, nothing to return (US-F33-03 AC).
        return new NextResponse(null, { status: 204 })
    } catch (error: any) {
        console.error('[Discount Delete Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete discount' } },
            { status: 500 },
        )
    }
})
