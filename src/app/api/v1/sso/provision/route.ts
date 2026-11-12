import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { getPlanCode, mapPlanCodeToTier, dateOnly, VALID_BASE_CODES } from '@/lib/subscriptions/plan-subscription'

/**
 * POST /api/v1/sso/provision
 *
 * SSO Auto-Provisioning endpoint.
 * Receives payload from TM Legacy SSO system, creates User (Owner) + Tenant.
 * Compatible with v1 params: name, email, password, phone, company_name, subscription_code...
 *
 * Auth: Requires Bearer token from admin login.
 */
export async function POST(req: NextRequest) {
    try {
        const payload = await getPayload({ config })

        // ── 1. Auth Check ──
        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { message: 'Authorization required' },
                { status: 401 },
            )
        }

        const callerUser = await getCurrentUser(req)

        if (!callerUser) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
        }

        if (!callerUser?.roles?.includes('super-admin')) {
            return NextResponse.json(
                { message: 'Insufficient permissions. Super-admin role required.' },
                { status: 403 },
            )
        }

        // ── 2. Parse Payload (support cả v1 params & v2 params) ──
        const rawPayload = await req.json()

        // Mapping v1 → v2 fields
        const companyName = rawPayload.company_name || ''
        const email = rawPayload.email || ''
        const password = rawPayload.password || ''
        const phone = rawPayload.phone || rawPayload.telephone || ''
        const packCode = rawPayload.subscription_code || rawPayload.pack_code || ''
        const subscriptionType = rawPayload.subscription_type ?? rawPayload.subscription_type_id ?? null
        const startDate = rawPayload.start_date || null
        const endDate = rawPayload.end_date || null
        const customerId = rawPayload.customer_id_number || ''
        const serviceId = rawPayload.service_id || ''
        const orderId = rawPayload.unifi_order_id || ''
        // GH-1723: immutable SSO users.id (optional — older SSO builds do not send it)
        const ssoUserId = Number.isInteger(rawPayload.sso_user_id) && rawPayload.sso_user_id > 0
            ? rawPayload.sso_user_id as number
            : undefined

        // Name: v1 gửi `name` (full), v2 gửi `first_name` + `last_name`
        let firstName = rawPayload.first_name || ''
        let lastName = rawPayload.last_name || ''
        if (!firstName && rawPayload.name) {
            const parts = rawPayload.name.trim().split(/\s+/)
            firstName = parts[0] || ''
            lastName = parts.slice(1).join(' ') || ''
        }

        // ── 3. Validate Required Fields ──
        const missing: string[] = []
        if (!companyName) missing.push('company_name')
        if (!email) missing.push('email')
        if (!password) missing.push('password')
        if (!firstName) missing.push('first_name or name')
        if (!packCode) missing.push('subscription_code or pack_code')

        if (missing.length > 0) {
            return NextResponse.json(
                { message: `Missing required fields: ${missing.join(', ')}` },
                { status: 400 },
            )
        }

        // Validate subscription_code against known base codes (parity with upgrade/downgrade)
        if (!VALID_BASE_CODES.has(packCode.toLowerCase())) {
            return NextResponse.json(
                { message: `Invalid subscription_code: ${packCode}` },
                { status: 400 },
            )
        }

        // ── 4. Unique Check (composite key: email + customerIdNumber when present) ──
        // AC-09: same email + different customer_id → allowed (creates new user)
        const existing = await payload.find({
            collection: 'users',
            where: customerId
                ? { and: [{ email: { equals: email } }, { customerIdNumber: { equals: String(customerId) } }] }
                : { email: { equals: email } },
            limit: 1,
        })

        if (existing.docs.length > 0) {
            return NextResponse.json(
                { message: 'User already provisioned' },
                { status: 409 },
            )
        }

        // GH-1723: the SSO id may already be bound (e.g. by avatar sync) — check before creating the tenant
        if (ssoUserId) {
            const boundBySsoId = await payload.find({
                collection: 'users',
                where: { ssoUserId: { equals: ssoUserId } },
                limit: 1,
                depth: 0,
                overrideAccess: true,
            })
            if (boundBySsoId.docs.length > 0) {
                return NextResponse.json(
                    { message: 'User already provisioned' },
                    { status: 409 },
                )
            }
        }

        // ── 5. Map pack_code → plan ──
        const planCode = getPlanCode(packCode, subscriptionType)

        // ── 6. Generate slug ──
        // ── 7. Create Tenant ──
        const baseSlug = companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')
            .substring(0, 30)
        const uniqueSlug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`

        const { password: _ssoPassword, ...safeMetaData } = rawPayload

        let keyString: string | undefined
        try {
            const { encryptPassword } = await import('@/lib/sso/sso-api-client')
            keyString = encryptPassword(password)
        } catch (err) {
            // Non-blocking — provision succeeds even if encryption fails
            console.error('[SSO Provisioning] keyString encryption failed:', err)
        }

        const newTenant = await payload.create({
            collection: 'tenants',
            data: {
                name: companyName,
                slug: uniqueSlug,
                plan: mapPlanCodeToTier(planCode),
                status: 'active',
                // SSO fields (optional — populated if provided)
                ...(customerId && { customerId }),
                ...(serviceId && serviceId !== 'NA' && { serviceId }),
                ...(packCode && { packCode }),
                ...(orderId && { orderId }),
                // Store raw payload for future reference (exclude plaintext password)
                metaData: safeMetaData,
            },
        })

        // ── 8. Create User (with password from SSO) ──
        let newUser
        try {
            newUser = await payload.create({
                collection: 'users',
                overrideAccess: true,
                data: {
                    email,
                    password, // SSO provides password → user can login immediately
                    firstName,
                    lastName,
                    phone,
                    roles: ['tenant-owner'],
                    tenants: [
                        {
                            tenant: newTenant.id,
                            role: 'owner',
                        },
                    ],
                    ...(customerId && { customerIdNumber: String(customerId) }),
                    ...(ssoUserId && { ssoUserId }),
                    migrationStatus: 'migrated',
                    ...(keyString && { keyString }),
                    // Audit trail: payload.create() local API has no req.user; set explicitly
                    createdBy: callerUser.id,
                    updatedBy: callerUser.id,
                },
            })
        } catch (err) {
            // GH-1723: a concurrent request bound the same sso_user_id between the pre-check and this
            // create (unique index) → drop the tenant created above and answer 409 like the pre-check.
            if (ssoUserId) {
                // A failing lookup must not hide the original create error → treat it as "no race"
                const raced = await payload.find({
                    collection: 'users',
                    where: { ssoUserId: { equals: ssoUserId } },
                    limit: 1,
                    depth: 0,
                    overrideAccess: true,
                }).catch(() => ({ docs: [] as unknown[] }))
                if (raced.docs.length > 0) {
                    await payload.delete({ collection: 'tenants', id: newTenant.id, overrideAccess: true }).catch((cleanupErr) => {
                        // Orphan tenant: leave a trace so it can be cleaned up by hand
                        console.error(`[SSO Provisioning] could not remove tenant ${newTenant.id} after the sso_user_id race:`, cleanupErr)
                    })
                    return NextResponse.json({ message: 'User already provisioned' }, { status: 409 })
                }
            }
            throw err
        }

        // ── 9. Create PlanSubscription (non-blocking — failure does not abort provision) ──
        const startsAt = startDate
            ? new Date(`${dateOnly(startDate)}T00:00:00Z`).toISOString()
            : new Date().toISOString()
        const endsAt = endDate
            ? new Date(`${dateOnly(endDate)}T23:59:59Z`).toISOString()
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

        let planSubscription: { id: number; plan: string } | null = null
        try {
            const sub = await payload.create({
                collection: 'plan-subscriptions',
                data: {
                    tenant: newTenant.id,
                    name: 'main',
                    plan: planCode,
                    status: 'active',
                    startsAt,
                    endsAt,
                    packCode: packCode.toUpperCase(),
                },
            })
            planSubscription = { id: sub.id as number, plan: sub.plan as string }
        } catch (err) {
            console.error('[SSO Provisioning] PlanSubscription creation failed (non-blocking):', err)
        }

        return NextResponse.json(
            {
                message: 'Provisioning successful',
                user: { id: newUser.id, email: newUser.email },
                tenant: { id: newTenant.id, slug: newTenant.slug },
                planSubscription,
            },
            { status: 201 },
        )
    } catch (error) {
        console.error('[SSO Provisioning Error]', error)
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 },
        )
    }
}
