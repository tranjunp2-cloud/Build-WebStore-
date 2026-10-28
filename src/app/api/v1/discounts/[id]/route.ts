import { NextResponse } from 'next/server'
import { getPayload, type User } from 'payload'
import config from '@payload-config'
import { extractTenantId, withAuth } from '@/lib/auth'
import { parseRequest } from '@/lib/validations/helpers'
import { updateDiscountSchema } from '@/lib/validations/discounts'
import { VersionConflictError } from '@/lib/save-version/save-version'
import { deleteDiscountAs, DiscountServiceError, updateDiscountAs, type DiscountWriteData } from '@/lib/discounts/discount-service'
import { discountWriteRefusal } from '../discount-write-access'

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
 * Optional `expectedUpdatedAt`: a discount changed since is refused, 409 `{ ok: false, code: 'VERSION_CONFLICT', current }`.
 * Same role gate as create (Orders permission, active membership, not a viewer): 403 FORBIDDEN.
 */
export const PUT = withAuth<RouteContext>(async (user, request, ctx) => {
    try {
        const refusal = discountWriteRefusal(user)
        if (refusal) return refusal
        const { id } = await ctx.params
        const { data, errorResponse } = await parseRequest(request, updateDiscountSchema)
        if (errorResponse) return errorResponse
        const { expectedUpdatedAt, ...patch } = data

        // Verify exists + access, strip usageCount / tenant, then write (lib/discounts/discount-service)
        let updated
        try {
            updated = await updateDiscountAs({ user: user as unknown as User, tenantId: extractTenantId(user) ?? '' }, id, patch as DiscountWriteData, expectedUpdatedAt)
        } catch (err: any) {
            if (err instanceof DiscountServiceError && err.code === 'NOT_FOUND') {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } },
                    { status: 404 },
                )
            }
            if (err instanceof VersionConflictError) {
                // changed since the form loaded: nothing written, `current` is the version to save over
                return NextResponse.json({ success: false, ...err.toResult() }, { status: 409 })
            }
            if (err instanceof DiscountServiceError && err.code === 'DUPLICATE_CODE') {
                return NextResponse.json(
                    { success: false, error: { code: 'DUPLICATE_CODE', message: err.message } },
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
 * Same role gate as create (Orders permission, active membership, not a viewer): 403 FORBIDDEN.
 */
export const DELETE = withAuth<RouteContext>(async (user, _request, ctx) => {
    try {
        const refusal = discountWriteRefusal(user)
        if (refusal) return refusal
        const { id } = await ctx.params
        try {
            await deleteDiscountAs({ user: user as unknown as User, tenantId: extractTenantId(user) ?? '' }, id)
        } catch (err: any) {
            if (err instanceof DiscountServiceError && err.code === 'NOT_FOUND') {
                return NextResponse.json(
                    { success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } },
                    { status: 404 },
                )
            }
            throw err
        }

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
