import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { SAFE_RELATION_POPULATE } from '@/lib/payload/safe-populate'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { profilePatchSchema } from '@/lib/profile/schemas'
import { blockOwner, type UserLike } from '@/lib/profile/role-guard'

export const runtime = 'nodejs'

type RelationshipValue = string | number | { id?: string | number } | null

interface TenantMembershipValue {
    tenant?: RelationshipValue
    status?: string
}

function relationshipId(value: RelationshipValue | undefined): string | null {
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (!value || typeof value !== 'object') return null
    return typeof value.id === 'string' || typeof value.id === 'number'
        ? String(value.id)
        : null
}

export async function GET(_req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config: configPromise })
        const doc = await payload.findByID({
            collection: 'users',
            id: user.id,
            depth: 1,
            // Local API skips field read access: without this the populated memberships carry the whole
            // tenant row (Xendit / EasyParcel / ECH secrets) and createdBy / updatedBy users (TC-PERF-126).
            populate: SAFE_RELATION_POPULATE,
        }) as unknown as Record<string, unknown>

        const includeSiteStatus = _req.nextUrl.searchParams.get('include') === 'site-status'
        const memberships = Array.isArray(doc.tenants)
            ? doc.tenants as TenantMembershipValue[]
            : []
        const activeTenantIds = Array.from(new Set(
            memberships
                .filter(membership => membership.status === 'active')
                .map(membership => relationshipId(membership.tenant))
                .filter((id): id is string => Boolean(id)),
        ))
        const siteDocs = includeSiteStatus && activeTenantIds.length > 0
            ? (await payload.find({
                collection: 'sites',
                depth: 0,
                limit: 2,
                overrideAccess: true,
                pagination: false,
                sort: 'createdAt',
                where: { tenant: { in: activeTenantIds } },
                select: { tenant: true, status: true },
            })).docs as unknown as Array<Record<string, unknown>>
            : []

        return NextResponse.json({
            id: doc.id,
            email: doc.email,
            firstName: doc.firstName,
            lastName: doc.lastName,
            phone: doc.phone,
            avatar: doc.avatar,
            roles: doc.roles,
            tenants: doc.tenants,
            sites: includeSiteStatus
                ? siteDocs.map(site => ({
                    id: site.id,
                    tenant: site.tenant,
                    status: site.status,
                }))
                : undefined,
            createdAt: doc.createdAt,
            lastLoginAt: doc.lastLoginAt,
        })
    } catch (err) {
        console.error('[users/me] GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getCurrentUser(req)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const guard = blockOwner(user as UserLike)
        if (guard) return guard

        const body = await req.json()
        const parsed = profilePatchSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'invalidInput', details: parsed.error.flatten() },
                { status: 400 },
            )
        }

        const payload = await getPayload({ config: configPromise })

        const tenants = (user as any).tenants as Array<{ tenant: any; role?: string }> | undefined
        const tenantEntry = tenants?.find((t) => t.role === 'owner') ?? tenants?.[0]
        const tenantRef = tenantEntry?.tenant
        const tenantId = typeof tenantRef === 'object' && tenantRef !== null ? tenantRef?.id : tenantRef
        if (tenantId) {
            const sub = await getActivePlanSubscription(payload, tenantId)
            if (!sub) {
                return NextResponse.json(
                    { success: false, error: { code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired or not found' } },
                    { status: 403 },
                )
            }
            const allowed = await canUse(payload, sub.plan as PlanCode, 'account_profile')
            if (!allowed) {
                return NextResponse.json(
                    { success: false, error: { code: 'FEATURE_LOCKED', message: 'This feature is not available on your current plan' } },
                    { status: 403 },
                )
            }
        }

        const updated = await payload.update({
            collection: 'users',
            id: user.id,
            data: parsed.data,
        }) as unknown as Record<string, unknown>

        return NextResponse.json({
            id: updated.id,
            firstName: updated.firstName,
            lastName: updated.lastName,
            phone: updated.phone,
        })
    } catch (err) {
        console.error('[users/me] PATCH error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
