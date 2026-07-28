import type {
    CollectionConfig,
    CollectionAfterChangeHook,
    CollectionBeforeChangeHook,
    CollectionBeforeOperationHook,
} from 'payload'
import { APIError } from 'payload'
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email/send'
import { welcomeEmail } from '@/lib/email/templates/welcome'
import { staffInvitationEmail } from '@/lib/email/templates/staff-invitation'
import { forgotPasswordEmail } from '@/lib/email/templates/forgot-password'
import { generateOTP, hashOTP, getOTPExpiry } from '@/lib/otp/generate'
import { canBypassOtpForEmail, getQcBypassCode, isValidQcBypass } from '@/lib/otp/qc-bypass'
import { isE2EProfileIdentity, isValidE2EProfileOtp } from '@/lib/otp/e2e-profile-bypass'
import { otpVerificationEmail } from '@/lib/email/templates/otp-verification'
import { normalizeTenants } from '@/lib/normalize-tenants'
import type { TenantMembership } from '@/lib/normalize-tenants'
import { ALLOWED_PERMISSIONS } from '@/lib/permissions'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { getActivePlanSubscription, canUseWithinLimit, recordUsage, reduceUsage } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'

/**
 * Single source of truth for the `roles` select options — reused by the field
 * definition below and by the invalid-filter guard so the two can never drift.
 */
const USER_ROLE_OPTIONS = [
    { label: 'Super Admin', value: 'super-admin' },
    { label: 'Tenant Owner', value: 'tenant-owner' },
    { label: 'Editor', value: 'editor' },
    { label: 'Viewer', value: 'viewer' },
]
const VALID_ROLE_VALUES = new Set(USER_ROLE_OPTIONS.map((o) => o.value))
// Operators that compare `roles` against an enum value — only these may carry a role
// string. `exists` (boolean) is allowed but carries no enum value. Any OTHER operator
// (like/contains/greater_than/…) on an enum column makes Postgres throw 42883 → 500,
// so we reject them up front. (GH #1535 — Bug 1)
const ROLE_VALUE_OPS = new Set(['equals', 'not_equals', 'in', 'not_in', 'all'])

/**
 * beforeOperation guard: reject any query that filters `roles` by a value outside the
 * select enum (e.g. ?where[roles][in][]=buyer) or by an operator the enum column can't
 * handle. Such queries otherwise reach Postgres and crash with "invalid input value for
 * enum" / 42883 → Payload swallows it into a generic 500. Short-circuit with a clean 400
 * so a bad filter never crashes /api/users. Valid role filters pass through untouched.
 * (GH #1535 — Bug 1)
 */
const rejectInvalidRoleFilter: CollectionBeforeOperationHook = ({ args }) => {
    const where = (args as { where?: unknown }).where
    const invalidValues = new Set<string>()
    const badOperators = new Set<string>()

    const scan = (node: unknown): void => {
        if (!node || typeof node !== 'object') return
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
            if ((key === 'and' || key === 'or') && Array.isArray(value)) {
                value.forEach(scan)
            } else if (key === 'roles' && value && typeof value === 'object') {
                for (const [op, opVal] of Object.entries(value as Record<string, unknown>)) {
                    if (op === 'exists') continue // boolean semantics — carries no enum value
                    if (!ROLE_VALUE_OPS.has(op)) {
                        badOperators.add(op)
                        continue
                    }
                    const vals = Array.isArray(opVal) ? opVal : [opVal]
                    for (const v of vals) {
                        // For a value-comparison op, anything not an exact enum string is invalid
                        // (catches 'buyer'/'staff' and non-string values like numbers).
                        if (typeof v !== 'string' || !VALID_ROLE_VALUES.has(v)) invalidValues.add(String(v))
                    }
                }
            }
        }
    }
    scan(where)

    if (invalidValues.size > 0 || badOperators.size > 0) {
        const parts: string[] = []
        if (invalidValues.size > 0) parts.push(`invalid value(s): ${[...invalidValues].join(', ')}`)
        if (badOperators.size > 0) parts.push(`unsupported operator(s): ${[...badOperators].join(', ')}`)
        throw new APIError(
            `Invalid roles filter — ${parts.join('; ')}. Valid roles: ${[...VALID_ROLE_VALUES].join(', ')}; operators: ${[...ROLE_VALUE_OPS].join(', ')}, exists.`,
            400,
        )
    }
    return args
}

/**
 * beforeChange hook: auto-set createdBy (on create) and updatedBy (on create/update) from req.user.
 * Skip if req.user is null — system-level operations (e.g. Payload internal tasks) have no caller.
 */
const setAuditFields: CollectionBeforeChangeHook = ({ data, operation, req }) => {
    const callerId = req.user?.id ?? null
    if (!callerId) return data

    if (operation === 'create') {
        data.createdBy = callerId
    }
    data.updatedBy = callerId
    return data
}

/**
 * afterChange hook: send Welcome email to new users.
 * Non-blocking — registration succeeds even if email fails.
 */
const sendWelcomeEmailHook: CollectionAfterChangeHook = async ({ doc, operation }) => {
    if (operation !== 'create') return doc

    // Skip welcome email for SSO-provisioned or staff-invited users
    // These users already have tenants assigned at creation time
    if (doc.tenants && doc.tenants.length > 0) return doc

    const userName = doc.firstName || doc.email?.split('@')[0] || 'there'
    const { subject, html } = welcomeEmail({ userName })

    // Fire-and-forget — don't block registration
    sendEmail({ to: doc.email, subject, html }).catch((err) => {
        console.error(`[Users] Failed to send welcome email to ${doc.email}:`, err)
    })

    return doc
}

async function injectUser(req: any) {
    if (req.user) return;
    const authHeader = (typeof req.headers.get === 'function')
        ? req.headers.get('authorization')
        : req.headers.authorization;

    if (authHeader && (authHeader.startsWith('JWT ') || authHeader.startsWith('Bearer '))) {
        const token = authHeader.split(' ')[1];
        try {
            const payloadSecret = process.env.PAYLOAD_SECRET || '';
            const { jwtVerify } = await import('jose');
            const secret = new TextEncoder().encode(payloadSecret);
            const { payload: decoded } = await jwtVerify(token, secret);
            if (decoded?.id && decoded?.collection === 'users') {
                const user = await req.payload.findByID({ collection: 'users', id: decoded.id as string });
                if (user) req.user = user;
            }
        } catch (err) {
            // JWT decode failures are expected (expired/invalid tokens) — log at warn level only
            req.payload?.logger?.warn?.({ err }, 'injectUser: JWT decode failed — treating as unauthenticated')
        }
    }
}

export const Users: CollectionConfig = {
    slug: 'users',
    auth: {
        maxLoginAttempts: 5,
        lockTime: 15 * 60 * 1000, // 15 minutes
        forgotPassword: {
            generateEmailHTML: async (args) => {
                const token = args?.token || ''
                const user = args?.user || {}
                const req = args?.req

                // Use req.headers' host/origin if available but strictly validate against allowlist
                // to prevent Host Header Injection.
                let serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
                if (req && req.headers) {
                    const headers = req.headers as Headers | Record<string, string | string[] | undefined>
                    const isHeadersObj = typeof (headers as Headers).get === 'function'

                    const origin = isHeadersObj ? (headers as Headers).get('origin') : (headers as Record<string, string | string[] | undefined>)['origin']
                    const host = isHeadersObj ? (headers as Headers).get('host') : (headers as Record<string, string | string[] | undefined>)['host']

                    const originStr = Array.isArray(origin) ? origin[0] : origin
                    const hostStr = Array.isArray(host) ? host[0] : host

                    const allowedOrigins = [
                        process.env.NEXT_PUBLIC_SERVER_URL,
                        'http://localhost:3000',
                    ].filter(Boolean) as string[]

                    if (process.env.ALLOWED_ORIGINS) {
                        allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()))
                    }

                    if (originStr && !originStr.includes('null') && allowedOrigins.includes(originStr)) {
                        serverUrl = originStr
                    } else if (hostStr && !hostStr.includes('localhost')) {
                        const protoVal = isHeadersObj ? (headers as Headers).get('x-forwarded-proto') : (headers as Record<string, string | string[] | undefined>)['x-forwarded-proto']
                        const protoStr = Array.isArray(protoVal) ? protoVal[0] : protoVal

                        const proto = protoStr || 'https'
                        const potentialUrl = `${proto}://${hostStr}`

                        if (allowedOrigins.includes(potentialUrl)) {
                            serverUrl = potentialUrl
                        }
                    }
                }

                const resetUrl = `${serverUrl}/reset-password?token=${token}`
                const userName = user.firstName || user.email?.split('@')[0] || 'there'
                const rawTenantId = user.tenants?.[0]?.tenant
                const tenantId = rawTenantId
                    ? String(typeof rawTenantId === 'object' ? rawTenantId.id : rawTenantId)
                    : null
                const cmsConfig = tenantId
                    ? await getTemplateConfig(tenantId, 'forgot-password', 'seller').catch(() => null)
                    : null
                if (cmsConfig?.enabled === false) return ''
                const { html } = forgotPasswordEmail({ userName, resetUrl }, cmsConfig ?? undefined)
                return html
            },
            generateEmailSubject: () => {
                return 'Reset your Web Store password \uD83D\uDD10'
            },
        },
    },
    admin: {
        useAsTitle: 'email',
        description: 'Platform users — can be super-admins or tenant members.',
    },
    hooks: {
        beforeOperation: [rejectInvalidRoleFilter],
        beforeChange: [setAuditFields],
        afterChange: [sendWelcomeEmailHook],
    },
    endpoints: [
        {
            path: '/login',
            method: 'post',
            handler: async (req) => {
                const body = await req.json?.() ?? {}
                const email = body.email as string
                const password = body.password as string

                if (!email || !password) {
                    return Response.json({ errors: [{ message: 'Email and password are required' }] }, { status: 400 })
                }

                // Input Validation (Mitigate SQL/NoSQL Injection)
                const { z } = await import('zod')
                const emailSchema = z.string().email()
                if (!emailSchema.safeParse(email).success) {
                    return Response.json({ errors: [{ message: 'Invalid email format' }] }, { status: 400 })
                }

                try {
                    // Internal Payload login (verifies password)
                    const result = await req.payload.login({
                        collection: 'users',
                        data: { email, password },
                    })

                    // Ban enforcement: block login if all tenants are suspended.
                    // Extract IDs defensively — handles both depth:0 (raw ID) and depth:2 (populated object).
                    // Guard against vacuous truth: [].every() returns true, which would block all users.
                    const userTenants = result.user?.tenants as Array<{ tenant: string | number | { id: string | number } }> | undefined
                    if (userTenants && userTenants.length > 0) {
                        const tenantIds = userTenants
                            .map(t => {
                                if (t.tenant == null) return null
                                if (typeof t.tenant === 'object') return String((t.tenant as { id: string | number }).id)
                                return String(t.tenant)  // depth:0 — raw integer or string ID
                            })
                            .filter((id): id is string => Boolean(id) && id !== '0')
                        if (tenantIds.length > 0) {
                            const tenantResults = await Promise.all(
                                tenantIds.map(id => req.payload.find({ collection: 'tenants', where: { id: { equals: id } }, limit: 1, depth: 0 }))
                            )
                            const allSuspended = tenantResults.every(r => (r.docs[0] as { status?: string } | undefined)?.status === 'suspended')
                            if (allSuspended) {
                                return Response.json({ errors: [{ message: 'Account suspended' }] }, { status: 403 })
                            }
                        }
                    }

                    let finalToken = result.token

                    // 2. Bypass MFA by minting custom token
                    if (email === 'sso-service@primeweb.app' && result.user) {
                        const { SignJWT } = await import('jose')
                        const secret = process.env.PAYLOAD_SECRET
                        if (!secret) throw new Error('PAYLOAD_SECRET is required to sign JWT')
                        const secretKey = new TextEncoder().encode(secret)

                        finalToken = await new SignJWT({
                            id: result.user?.id,
                            email: result.user?.email,
                            collection: 'users',
                            mfa_verified: true, // Bypass Next.js middleware MFA check
                        })
                            .setProtectedHeader({ alg: 'HS256' })
                            .setIssuedAt()
                            .setExpirationTime('24h')
                            .sign(secretKey)
                    }

                    const cookiePrefix = process.env.NODE_ENV === 'production' ? 'Secure;' : ''

                    return Response.json({
                        message: 'Auth Passed',
                        user: result.user,
                        token: finalToken,
                        exp: Math.floor(Date.now() / 1000) + 86400,
                    }, {
                        headers: {
                            'Set-Cookie': `payload-token=${finalToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; ${cookiePrefix}`
                        }
                    })

                } catch (error: unknown) {
                    console.error('[Users SSO Login Error]:', error)
                    return Response.json({ errors: [{ message: 'Login failed' }] }, { status: 401 })
                }
            }
        },
        {
            path: '/invite-staff',
            method: 'post',
            handler: async (req) => {
                const body = await req.json?.() ?? {}
                const { email, name, tenantId, role, permissions } = body as { email?: string; name?: string; tenantId?: string; role?: string; permissions?: string[] }

                await injectUser(req);
                if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
                if (!email || !name || !tenantId || !role) return Response.json({ errors: [{ message: 'Missing required fields' }] }, { status: 400 })

                // Payload postgres adapter uses integer IDs — coerce tenantId string → number
                // so the relationship field validator can resolve it (string "5" !== integer 5 in strict mode)
                const parsedTenantId = Number(tenantId)
                const tenantIdForPayload: string | number = Number.isInteger(parsedTenantId) ? parsedTenantId : tenantId

                // BUG-F19.08: Validate email length (RFC 5321)
                if (typeof email !== 'string' || email.length > 254) {
                    return Response.json({ errors: [{ message: 'Email must not exceed 254 characters' }] }, { status: 400 })
                }

                // BUG-F19.10: Block self-invite
                if (req.user.email && email.toLowerCase() === req.user.email.toLowerCase()) {
                    return Response.json({ errors: [{ message: 'Cannot invite yourself' }] }, { status: 400 })
                }

                // Check permissions of requester
                const requesterTenant = req.user.tenants?.find((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                )
                if (!requesterTenant || requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
                }

                // Security: Only an owner can invite another owner
                if (role === 'owner' && requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Only an owner can invite another owner' }] }, { status: 403 })
                }

                try {
                    // NOTE: check→recordUsage is not atomic (no Payload cross-collection lock).
                    // Concurrent invites can race past staff_limit by 1. Accepted tradeoff —
                    // see upsertPlanSubscription note. Revisit if Payload exposes transactions.
                    const inviteSub = await getActivePlanSubscription(req.payload, tenantIdForPayload)
                    if (!inviteSub || !await canUseWithinLimit(req.payload, inviteSub.id, inviteSub.plan as PlanCode, 'staff_limit')) {
                        return Response.json({ errors: [{ message: 'Staff limit reached on your current plan' }] }, { status: 403 })
                    }

                    // Check if user exists
                    const users = await req.payload.find({ collection: 'users', where: { email: { equals: email } } })
                    let targetUser = users.docs[0]
                    let isNewUser = false
                    let tempPassword = ''

                    if (targetUser) {
                        // Check if already in tenant
                        const alreadyInTenant = targetUser.tenants?.find((t: any) =>
                            String(t.tenant?.id ?? t.tenant) === String(tenantId)
                        )
                        if (alreadyInTenant) {
                            return Response.json({ errors: [{ message: 'User is already a member of this workspace' }] }, { status: 400 })
                        }

                        // Check cross-tenant: block if user is an active owner of another workspace
                        const isOwnerElsewhere = targetUser.tenants?.find((t: any) =>
                            t.role === 'owner' && t.status === 'active'
                        )
                        if (isOwnerElsewhere) {
                            return Response.json({ errors: [{ message: 'This user is an owner of another workspace and cannot be added as staff' }] }, { status: 400 })
                        }

                        // Generate new temp password for re-invited staff
                        // So they can login even if they forgot the old password
                        tempPassword = randomBytes(8).toString('base64url').slice(0, 12)

                        // Add to tenant + reset password
                        const normalizedExisting = normalizeTenants(targetUser.tenants || [])
                        await req.payload.update({
                            collection: 'users',
                            id: targetUser.id,
                            overrideAccess: true,
                            data: {
                                password: tempPassword,
                                tenants: [
                                    ...normalizedExisting,
                                    { tenant: tenantIdForPayload, role, status: 'pending', permissions: role === 'custom' ? (permissions || []).filter((p): p is string => typeof p === 'string' && ALLOWED_PERMISSIONS.has(p)) : [] }
                                ]
                            }
                        })
                    } else {
                        // Generate a cryptographically secure temporary password (crypto.randomBytes)
                        tempPassword = randomBytes(8).toString('base64url').slice(0, 12)
                        isNewUser = true

                        targetUser = await req.payload.create({
                            collection: 'users',
                            overrideAccess: true,
                            data: {
                                email,
                                firstName: name,
                                password: tempPassword,
                                roles: role === 'owner' ? ['tenant-owner'] : [],
                                tenants: [
                                    { tenant: tenantIdForPayload, role, status: 'pending', permissions: role === 'custom' ? (permissions || []).filter((p): p is string => typeof p === 'string' && ALLOWED_PERMISSIONS.has(p)) : [] }
                                ]
                            }
                        })
                    }

                    // Fetch tenant details for email
                    const tenant = await req.payload.findByID({ collection: 'tenants', id: tenantId })
                    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
                    const loginUrl = `${serverUrl}/login`

                    const staffCmsConfig = await getTemplateConfig(String(tenantId), 'staff-invitation', 'seller').catch(() => null)

                    let emailSent = true
                    if (staffCmsConfig?.enabled === false) {
                        emailSent = false
                        console.log(`[StaffInvite] Suppressed by CMS config for tenant ${tenantId}`)
                    // Empty string is also falsy — any non-empty value is trusted as valid transport
                    } else if (!process.env.MAIL_HOST) {
                        emailSent = false
                        console.error('[StaffInvite] MAIL_HOST not set — email transport is streamTransport, no real email sent')
                    } else {
                        const { subject, html } = staffInvitationEmail({
                            userName: name || targetUser.firstName || email.split('@')[0],
                            workspaceName: tenant.name as string,
                            loginUrl,
                            temporaryPassword: tempPassword || undefined
                        }, staffCmsConfig ?? undefined)
                        try {
                            await req.payload.sendEmail({ to: email, subject, html })
                        } catch (err: unknown) {
                            emailSent = false
                            console.error(`[StaffInvite] Failed to send email to ${email}:`, err)
                        }
                    }

                    try {
                        await recordUsage(req.payload, inviteSub.id, 'staff_limit')
                    } catch (err: unknown) {
                        console.error('[StaffInvite] Failed to record staff_limit usage:', err)
                    }
                    return Response.json({ message: 'Invitation sent successfully', emailSent })
                } catch (error: any) {
                    console.error('[StaffInvite]', error)
                    return Response.json({ errors: [{ message: error.message || 'Server error' }] }, { status: 500 })
                }
            }
        },
        {
            path: '/remove-staff',
            method: 'post',
            handler: async (req) => {
                const body = await req.json?.() ?? {}
                const { userId, tenantId } = body as { userId?: string; tenantId?: string }

                await injectUser(req);
                if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
                if (!userId || !tenantId) return Response.json({ errors: [{ message: 'Missing fields' }] }, { status: 400 })

                // Check requester permission
                const requesterTenant = req.user.tenants?.find((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                )
                if (!requesterTenant || requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Forbidden: Only owners can remove staff' }] }, { status: 403 })
                }
                if (String(userId) === String(req.user.id)) {
                    return Response.json({ errors: [{ message: 'Cannot remove yourself via this action' }] }, { status: 400 })
                }

                // Check target user
                const targetUser = await req.payload.findByID({ collection: 'users', id: userId })
                if (!targetUser) return Response.json({ errors: [{ message: 'User not found' }] }, { status: 404 })

                const targetTenantIndex = targetUser.tenants?.findIndex((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                ) ?? -1

                if (targetTenantIndex === -1) {
                    return Response.json({ errors: [{ message: 'User is not in this workspace' }] }, { status: 400 })
                }

                // Security: Prevent removing if they are the last active owner
                const targetTenantRole = targetUser.tenants![targetTenantIndex].role
                const targetTenantStatus = targetUser.tenants![targetTenantIndex].status
                if (targetTenantRole === 'owner') {
                    if (requesterTenant.role !== 'owner') {
                        return Response.json({ errors: [{ message: 'Only an owner can remove another owner' }] }, { status: 403 })
                    }
                    if (targetTenantStatus === 'active') {
                        // Check if there are other owners
                        const allStaff = await req.payload.find({
                            collection: 'users',
                            where: {
                                'tenants.tenant': { equals: tenantId }
                            },
                            limit: 1000
                        })
                        const activeOwners = allStaff.docs.filter((u: any) =>
                            u.tenants?.find((t: any) => String(t.tenant?.id ?? t.tenant) === String(tenantId) && t.role === 'owner' && t.status === 'active')
                        )

                        if (activeOwners.length <= 1) {
                            return Response.json({ errors: [{ message: 'Cannot remove the last workspace owner' }] }, { status: 400 })
                        }
                    }
                }

                // Remove the tenant from the user's tenants array
                const normalizedTenants = normalizeTenants(targetUser.tenants || [])
                normalizedTenants.splice(targetTenantIndex, 1)

                const removeData: Record<string, unknown> = { tenants: normalizedTenants }

                // Strip 'tenant-owner' platform role if removed user was an owner and has no owner tenancy elsewhere.
                // Note: the last-active-owner guard above (line ~365) is status-gated (active only), but this sync
                // is intentionally not status-gated — it checks all remaining tenancies regardless of status so
                // that inactive owners don't retain the platform role after removal.
                if (targetTenantRole === 'owner') {
                    const stillOwnerAnywhere = normalizedTenants.some(t => t.role === 'owner')
                    if (!stillOwnerAnywhere) {
                        const currentRoles: string[] = (targetUser.roles as string[]) || []
                        removeData.roles = currentRoles.filter(r => r !== 'tenant-owner')
                    }
                }

                await req.payload.update({
                    collection: 'users',
                    id: userId,
                    overrideAccess: true,
                    data: removeData
                })

                const removeSub = await getActivePlanSubscription(req.payload, tenantId)
                if (removeSub) {
                    try {
                        await reduceUsage(req.payload, removeSub.id, 'staff_limit')
                    } catch (err) {
                        console.warn('[StaffRemove] Failed to reduce staff_limit usage:', err)
                    }
                }

                return Response.json({ message: 'User removed from workspace successfully' })
            }
        },
        {
            path: '/update-staff',
            method: 'post',
            handler: async (req) => {
                const body = await req.json?.() ?? {}
                const { userId, tenantId, name, role, permissions } = body as { userId?: string; tenantId?: string; name?: string; role?: string; permissions?: string[] }

                await injectUser(req);
                if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
                if (!userId || !tenantId || !role || !name) return Response.json({ errors: [{ message: 'Missing fields' }] }, { status: 400 })

                const requesterTenant = req.user.tenants?.find((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                )
                if (!requesterTenant || requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Forbidden: Only owners can update staff' }] }, { status: 403 })
                }

                const targetUser = await req.payload.findByID({ collection: 'users', id: userId })
                if (!targetUser) return Response.json({ errors: [{ message: 'User not found' }] }, { status: 404 })

                const targetTenantIndex = targetUser.tenants?.findIndex((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                ) ?? -1

                if (targetTenantIndex === -1) {
                    return Response.json({ errors: [{ message: 'User is not in this workspace' }] }, { status: 400 })
                }

                const targetTenantRole = targetUser.tenants![targetTenantIndex].role
                const targetTenantStatus = targetUser.tenants![targetTenantIndex].status

                // Security: Prevent Admin from promoting anyone to Owner
                if (role === 'owner' && requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Only an owner can promote another user to owner' }] }, { status: 403 })
                }

                if (String(userId) === String(req.user.id) && role !== targetTenantRole) {
                    return Response.json({ errors: [{ message: 'Cannot change your own role' }] }, { status: 400 })
                }

                if (targetTenantRole === 'owner') {
                    if (requesterTenant.role !== 'owner') {
                        return Response.json({ errors: [{ message: 'Only an owner can modify another owner' }] }, { status: 403 })
                    }
                    if (role !== 'owner' && targetTenantStatus === 'active') {
                        const allStaff = await req.payload.find({
                            collection: 'users',
                            where: { 'tenants.tenant': { equals: tenantId } },
                            limit: 1000
                        })
                        const activeOwners = allStaff.docs.filter((u: any) =>
                            u.tenants?.find((t: any) => String(t.tenant?.id ?? t.tenant) === String(tenantId) && t.role === 'owner' && t.status === 'active')
                        )
                        if (activeOwners.length <= 1) {
                            return Response.json({ errors: [{ message: 'Cannot demote the last workspace owner' }] }, { status: 400 })
                        }
                    }
                }

                const normalizedTenants = normalizeTenants(targetUser.tenants || [])
                normalizedTenants[targetTenantIndex].role = role
                normalizedTenants[targetTenantIndex].permissions = role === 'custom' ? (permissions || []).filter((p): p is string => typeof p === 'string' && ALLOWED_PERMISSIONS.has(p)) : []

                // Sync platform roles when owner status changes.
                // 'tenant-owner' gates login redirect (login/page.tsx) and password reset flow (check-reset-flow).
                // Demotion safety: normalizedTenants[targetTenantIndex].role is already set to the new role above,
                // so stillOwnerAnywhere reflects post-update state. This is safe because the last-active-owner guard
                // above (line ~443) guarantees at least one other owner exists before we reach this block.
                const wasOwner = targetTenantRole === 'owner'
                const becomesOwner = role === 'owner'
                const currentRoles: string[] = (targetUser.roles as string[]) || []
                let updatedRoles: string[] | undefined
                if (becomesOwner && !currentRoles.includes('tenant-owner')) {
                    updatedRoles = [...currentRoles, 'tenant-owner']
                } else if (wasOwner && !becomesOwner) {
                    const stillOwnerAnywhere = normalizedTenants.some(t => t.role === 'owner')
                    if (!stillOwnerAnywhere) {
                        updatedRoles = currentRoles.filter(r => r !== 'tenant-owner')
                    }
                }

                const updateData: Record<string, unknown> = { firstName: name, tenants: normalizedTenants }
                if (updatedRoles !== undefined) updateData.roles = updatedRoles

                await req.payload.update({
                    collection: 'users',
                    id: userId,
                    overrideAccess: true,
                    data: updateData
                })

                // Sync staff_limit usage when owner status changes.
                // Owners don't count toward staff_limit; non-owners do.
                if (wasOwner !== becomesOwner) {
                    try {
                        const updateSub = await getActivePlanSubscription(req.payload, tenantId)
                        if (updateSub) {
                            if (wasOwner && !becomesOwner) {
                                await recordUsage(req.payload, updateSub.id, 'staff_limit')
                            } else {
                                await reduceUsage(req.payload, updateSub.id, 'staff_limit')
                            }
                        }
                    } catch (err: unknown) {
                        console.warn('[StaffUpdate] Failed to adjust staff_limit usage:', err)
                    }
                }

                return Response.json({ message: 'User updated successfully' })
            }
        },
        {
            path: '/update-staff-status',
            method: 'post',
            handler: async (req) => {
                const body = await req.json?.() ?? {}
                const { userId, tenantId, status } = body as { userId?: string; tenantId?: string; status?: string }

                await injectUser(req);
                if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
                if (!userId || !tenantId || !status) return Response.json({ errors: [{ message: 'Missing fields' }] }, { status: 400 })

                const requesterTenant = req.user.tenants?.find((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                )
                if (!requesterTenant || requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
                }

                const targetUser = await req.payload.findByID({ collection: 'users', id: userId })
                if (!targetUser) return Response.json({ errors: [{ message: 'User not found' }] }, { status: 404 })

                const targetTenantIndex = targetUser.tenants?.findIndex((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                ) ?? -1

                if (targetTenantIndex === -1) {
                    return Response.json({ errors: [{ message: 'User is not in this workspace' }] }, { status: 400 })
                }

                const targetTenantRole = targetUser.tenants![targetTenantIndex].role
                const targetTenantStatus = targetUser.tenants![targetTenantIndex].status
                if (targetTenantRole === 'owner') {
                    if (requesterTenant.role !== 'owner') {
                        return Response.json({ errors: [{ message: 'Only an owner can update the status of another owner' }] }, { status: 403 })
                    }
                    if (status !== 'active' && targetTenantStatus === 'active') {
                        const allStaff = await req.payload.find({
                            collection: 'users',
                            where: { 'tenants.tenant': { equals: tenantId } },
                            limit: 1000
                        })
                        const activeOwners = allStaff.docs.filter((u: any) =>
                            u.tenants?.find((t: any) => String(t.tenant?.id ?? t.tenant) === String(tenantId) && t.role === 'owner' && t.status === 'active')
                        )
                        if (activeOwners.length <= 1) {
                            return Response.json({ errors: [{ message: 'Cannot deactivate the last workspace owner' }] }, { status: 400 })
                        }
                    }
                }

                const normalizedTenants = normalizeTenants(targetUser.tenants || [])
                normalizedTenants[targetTenantIndex].status = status

                await req.payload.update({
                    collection: 'users',
                    id: userId,
                    overrideAccess: true,
                    data: { tenants: normalizedTenants }
                })

                return Response.json({ message: 'User status updated successfully' })
            }
        },
        {
            path: '/resend-invite',
            method: 'post',
            handler: async (req) => {
                const body = await req.json?.() ?? {}
                const { userId, tenantId } = body as { userId?: string; tenantId?: string }

                await injectUser(req);
                if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
                if (!userId || !tenantId) return Response.json({ errors: [{ message: 'Missing fields' }] }, { status: 400 })

                const requesterTenant = req.user.tenants?.find((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                )
                if (!requesterTenant || requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
                }

                const targetUser = await req.payload.findByID({ collection: 'users', id: userId })
                if (!targetUser) return Response.json({ errors: [{ message: 'User not found' }] }, { status: 404 })

                const tenant = await req.payload.findByID({ collection: 'tenants', id: tenantId })
                const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
                const loginUrl = `${serverUrl}/login`

                const { subject, html } = staffInvitationEmail({
                    userName: targetUser.firstName || targetUser.email.split('@')[0],
                    workspaceName: tenant.name as string,
                    loginUrl
                })

                let emailSent = true
                if (!process.env.MAIL_HOST) {
                    emailSent = false
                    console.error('[StaffInvite] MAIL_HOST not set — resend skipped, streamTransport would swallow it')
                } else {
                    try {
                        await req.payload.sendEmail({ to: targetUser.email, subject, html })
                    } catch (err: unknown) {
                        emailSent = false
                        console.error(`[StaffInvite] Failed to resend email to ${targetUser.email}:`, err)
                    }
                }

                return Response.json({ message: 'Invitation resent successfully', emailSent })
            }
        },
        {
            path: '/bulk-remove-staff',
            method: 'post',
            handler: async (req) => {
                const body = await req.json?.() ?? {}
                const { userIds, tenantId } = body as { userIds?: string[]; tenantId?: string }

                await injectUser(req);
                if (!req.user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
                if (!userIds || !tenantId || !Array.isArray(userIds)) return Response.json({ errors: [{ message: 'Missing or invalid fields' }] }, { status: 400 })

                const requesterTenant = req.user.tenants?.find((t: any) =>
                    String(t.tenant?.id ?? t.tenant) === String(tenantId)
                )
                if (!requesterTenant || requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
                }

                const bulkRemoveSub = await getActivePlanSubscription(req.payload, tenantId)

                let removedCount = 0;
                let errorCount = 0;

                for (const userId of userIds) {
                    try {
                        const targetUser = await req.payload.findByID({ collection: 'users', id: userId })
                        if (!targetUser) continue;

                        const targetTenantIndex = targetUser.tenants?.findIndex((t: any) =>
                            String(t.tenant?.id ?? t.tenant) === String(tenantId)
                        ) ?? -1
                        if (targetTenantIndex === -1) continue;

                        const targetTenantRole = targetUser.tenants![targetTenantIndex].role
                        if (targetTenantRole === 'owner') {
                            const allStaff = await req.payload.find({ collection: 'users', where: { 'tenants.tenant': { equals: tenantId } }, limit: 1000 })
                            const activeOwners = allStaff.docs.filter((u: any) => u.tenants?.find((t: any) => String(t.tenant?.id ?? t.tenant) === String(tenantId) && t.role === 'owner' && t.status === 'active'))
                            if (activeOwners.length <= 1) {
                                errorCount++;
                                continue;
                            }
                        }

                        const normalizedTenants = normalizeTenants(targetUser.tenants || [])
                        normalizedTenants.splice(targetTenantIndex, 1)

                        await req.payload.update({ collection: 'users', id: userId, overrideAccess: true, data: { tenants: normalizedTenants } })
                        removedCount++;
                    } catch (e) {
                        errorCount++;
                    }
                }

                if (bulkRemoveSub && removedCount > 0) {
                    try {
                        await reduceUsage(req.payload, bulkRemoveSub.id, 'staff_limit', removedCount)
                    } catch (err) {
                        console.warn('[BulkStaffRemove] Failed to reduce staff_limit usage:', err)
                    }
                }

                return Response.json({ message: `Removed ${removedCount} users. ${errorCount ? `${errorCount} errors.` : ''}` })
            }
        },
        {
            path: '/send-otp',
            method: 'post',
            handler: async (req) => {
                try {
                    const body = await req.json?.() ?? {}
                    const { email } = body as { email?: string }

                    if (!email) {
                        return Response.json(
                            { errors: [{ message: 'Email is required' }] },
                            { status: 400 },
                        )
                    }

                    // Find user by email
                    const result = await req.payload.find({
                        collection: 'users',
                        where: { email: { equals: email } },
                        limit: 1,
                        overrideAccess: true, // Required to read protected fields like otpHash
                    })

                    if (!result.docs.length) {
                        // Don't reveal whether email exists — return generic success
                        return Response.json({ message: 'If the email exists, an OTP has been sent.' })
                    }

                    const user = result.docs[0]
                    const userName = user.firstName || user.email?.split('@')[0] || 'there'

                    // Check rate limiting: max 1 OTP per 60 seconds
                    if (user.otpExpiresAt) {
                        const lastExpiry = new Date(user.otpExpiresAt)
                        const cooldownEnd = new Date(lastExpiry.getTime() - (4 * 60 * 1000)) // 5 min TTL - 4 min = sent 1 min ago
                        if (Date.now() < cooldownEnd.getTime()) {
                            return Response.json(
                                { errors: [{ message: 'Please wait before requesting a new code.' }] },
                                { status: 429 },
                            )
                        }
                    }

                    // Dev/E2E bypass: use magic code instead of generating real OTP
                    const testOtpCode = process.env.E2E_TEST_OTP_CODE
                    const isDev = process.env.NODE_ENV === 'development'
                    const testEmail = process.env.TEST_EMAIL
                    const useDevBypass = isDev && !!testOtpCode
                    // The profile browser regression uses one dedicated Staff alias derived
                    // from TEST_EMAIL. Keep the bypass bounded to staging and those two identities.
                    const useE2EBypass = process.env.APP_ENV === 'staging'
                        && !!testOtpCode
                        && isE2EProfileIdentity(email, testEmail)
                    // QC domain bypass — triple-guarded in qc-bypass.ts
                    // (APP_ENV=qc-test + QC_OTP_BYPASS_ENABLED=true + email
                    // ends with QC_OTP_BYPASS_DOMAIN). Skips SES for the
                    // whole @primeweb.local test-account population.
                    const useQcBypass = canBypassOtpForEmail(email)

                    const otp = (useDevBypass || useE2EBypass)
                        ? testOtpCode!
                        : useQcBypass
                            ? getQcBypassCode()
                            : generateOTP()
                    const otpHash = hashOTP(otp)
                    const otpExpiry = getOTPExpiry()

                    // Store hashed OTP in database.
                    // Payload 3 validates the full merged document on update, not just the fields passed.
                    // DB stores null (not []) for permissions when no rows exist in users_tenants_permissions.
                    // normalizeTenants converts null → [] so Payload's select hasMany validator doesn't reject it.
                    await req.payload.update({
                        collection: 'users',
                        id: user.id,
                        overrideAccess: true,
                        data: {
                            otpHash,
                            otpExpiresAt: otpExpiry.toISOString(),
                            otpAttempts: 0,
                            tenants: normalizeTenants(user.tenants || []),
                        },
                    })

                    // Mask email for logging
                    const [local, domain] = email.split('@')
                    const safeLocal = local.length <= 2 ? '*'.repeat(local.length) : local.slice(0, 2) + '***'
                    const maskedEmail = `${safeLocal}@${domain}`

                    let emailSent = true

                    if (useDevBypass || useE2EBypass) {
                        // Dev/E2E: log metadata only, never log OTP code
                        console.log(`[DEV OTP] Bypass code sent for ${maskedEmail}`)
                    } else if (useQcBypass) {
                        // QC lane: never sends real email — code is fixed
                        // per env var. Log presence only, never the code.
                        console.log(`[QC OTP] Domain bypass active for ${maskedEmail}`)
                    } else if (!process.env.MAIL_HOST) {
                        // Empty string is also falsy — any non-empty value is trusted as valid transport
                        // MAIL_HOST not configured — streamTransport silently swallows the message
                        emailSent = false
                        console.error('[OTP] MAIL_HOST not set — email transport is streamTransport, no real email sent')
                    } else {
                        // Production: await real email send so we can report failures
                        const rawTenantId = user.tenants?.[0]?.tenant
                        const tenantId = rawTenantId
                            ? String(typeof rawTenantId === 'object' ? rawTenantId.id : rawTenantId)
                            : null
                        const cmsConfig = tenantId
                            ? await getTemplateConfig(tenantId, 'otp-verification', 'seller').catch(() => null)
                            : null
                        if (cmsConfig?.enabled === false) {
                            emailSent = false
                            console.log(`[OTP] Suppressed by CMS config for tenant ${tenantId}`)
                        } else {
                            const { subject, html } = otpVerificationEmail({ userName, otpCode: otp }, cmsConfig ?? undefined)
                            try {
                                await req.payload.sendEmail({ to: email, subject, html })
                                console.log(`[OTP] Code dispatched for ${maskedEmail}`)
                            } catch (err: unknown) {
                                emailSent = false
                                console.error(`[OTP] Email send FAILED for ${maskedEmail}:`, err instanceof Error ? err.message : err)
                            }
                        }
                    }
                    return Response.json({ message: 'If the email exists, an OTP has been sent.', emailSent })
                } catch (error: unknown) {
                    console.error('[Users] send-otp error:', error)
                    return Response.json(
                        { errors: [{ message: 'Failed to send verification code. Please try again.' }] },
                        { status: 500 },
                    )
                }
            },
        },
        {
            path: '/verify-otp',
            method: 'post',
            handler: async (req) => {
                const body = await req.json?.() ?? {}
                const { email, otp } = body as { email?: string; otp?: string }

                if (!email || !otp) {
                    return Response.json(
                        { errors: [{ message: 'Email and OTP are required' }] },
                        { status: 400 },
                    )
                }

                // Find user
                const result = await req.payload.find({
                    collection: 'users',
                    where: { email: { equals: email } },
                    limit: 1,
                    overrideAccess: true, // Required to read protected fields like otpHash
                })

                if (!result.docs.length) {
                    return Response.json(
                        { errors: [{ message: 'Invalid verification code.' }] },
                        { status: 401 },
                    )
                }

                const user = result.docs[0]

                // Check rate limiting: max 5 attempts
                const attempts = (user.otpAttempts as number) || 0
                if (attempts >= 5) {
                    return Response.json(
                        { errors: [{ message: 'Too many attempts. Please request a new code.' }] },
                        { status: 429 },
                    )
                }

                // Dev/E2E OTP bypass — three modes:
                // 1. Dev mode: ANY 6-digit OTP passes (NODE_ENV=development only)
                // 2. Dev + magic code: specific E2E_TEST_OTP_CODE matches
                // 3. Staging E2E: specific TEST_EMAIL identity + E2E_TEST_OTP_CODE
                const testOtpCode = process.env.E2E_TEST_OTP_CODE
                const testEmail = process.env.TEST_EMAIL
                const isDev = process.env.NODE_ENV === 'development'
                const isDevBypass = isDev && /^\d{6}$/.test(otp) // Dev: any 6-digit code passes
                const isE2EBypass = isValidE2EProfileOtp(
                    email,
                    otp,
                    testEmail,
                    testOtpCode,
                    process.env.APP_ENV,
                )
                // QC domain bypass — accepts fixed QC_OTP_BYPASS_CODE for any
                // @primeweb.local (or configured) email when APP_ENV=qc-test
                // AND QC_OTP_BYPASS_ENABLED=true. Triple-guarded in
                // qc-bypass.ts to defend against accidental prod leak.
                const isQcBypass = isValidQcBypass(email, otp)
                const isTestBypass = isDevBypass || isE2EBypass || isQcBypass

                // Check expiry (skip for test bypass)
                if (!isTestBypass && (!user.otpHash || !user.otpExpiresAt)) {
                    return Response.json(
                        { errors: [{ message: 'No verification code found. Please request a new one.' }] },
                        { status: 401 },
                    )
                }

                if (!isTestBypass) {
                    const isExpired = Date.now() > new Date(user.otpExpiresAt as string).getTime()
                    if (isExpired) {
                        return Response.json(
                            { errors: [{ message: 'Code has expired. Please request a new one.' }] },
                            { status: 401 },
                        )
                    }
                }

                // Verify OTP hash (skip for test bypass)
                if (!isTestBypass) {
                    const { verifyOTP } = await import('@/lib/otp/generate')
                    const isValid = verifyOTP(otp, user.otpHash as string)

                    if (!isValid) {
                        // Increment attempts
                        await req.payload.update({
                            collection: 'users',
                            id: user.id,
                            overrideAccess: true,
                            data: { otpAttempts: attempts + 1 },
                        })
                        return Response.json(
                            { errors: [{ message: 'Invalid verification code.' }] },
                            { status: 401 },
                        )
                    }
                }

                // OTP valid — clear OTP fields and activate any pending tenant invites.
                // Use normalizeTenants to sanitize null permissions before spreading,
                // preventing the same select hasMany validation error as in send-otp.
                const updatedTenants = normalizeTenants(user.tenants || []).map((t) => ({
                    ...t,
                    status: t.status === 'pending' ? 'active' : t.status,
                }))

                await req.payload.update({
                    collection: 'users',
                    id: user.id,
                    overrideAccess: true,
                    data: {
                        otpHash: '',
                        otpExpiresAt: null,
                        otpAttempts: 0,
                        lastLoginAt: new Date().toISOString(),
                        tenants: updatedTenants,
                    },
                })

                // Generate JWT token using jose (same lib as Payload V3 internally)
                // This ensures token is valid when verified by payload.auth()
                const { SignJWT } = await import('jose')
                const secret = process.env.PAYLOAD_SECRET || 'fallback-dev-secret'
                const secretKey = new TextEncoder().encode(secret)
                const expSeconds = 60 * 60 * 24
                const now = Math.floor(Date.now() / 1000)

                const token = await new SignJWT({
                    id: user.id,
                    email: user.email,
                    collection: 'users',
                    mfa_verified: true,
                })
                    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
                    .setIssuedAt(now)
                    .setExpirationTime(now + expSeconds)
                    .sign(secretKey)

                // Sanitize user object for response (remove sensitive fields)
                const { otpHash: _h, otpExpiresAt: _e, otpAttempts: _a, ...safeUser } = user

                return new Response(JSON.stringify({
                    message: 'Verification successful',
                    token,
                    user: safeUser,
                    exp: now + expSeconds,
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Set-Cookie': `payload-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expSeconds}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
                    }
                })
            },
        },
    ],
    access: {
        // Allow anyone to register (public create)
        create: () => true,
        // Users can read their own data, super-admin can read all
        read: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            return { id: { equals: req.user.id } }
        },
        // Users can update their own data
        update: ({ req }) => {
            if (!req.user) return false
            if (req.user.roles?.includes('super-admin')) return true
            return { id: { equals: req.user.id } }
        },
        // Only super-admin can delete
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'firstName',
            type: 'text',
            required: true,
        },
        {
            name: 'lastName',
            type: 'text',
        },
        {
            name: 'phone',
            type: 'text',
            admin: {
                description: 'Phone number with country code (e.g. 60123456789)',
            },
        },
        {
            name: 'roles',
            type: 'select',
            hasMany: true,
            defaultValue: ['tenant-owner'],
            saveToJWT: true, // edge middleware checks role via decoded JWT (no DB call in edge runtime)
            options: USER_ROLE_OPTIONS,
            access: {
                update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
            },
        },
        {
            name: 'tenants',
            type: 'array',
            label: 'Tenant Memberships',
            admin: {
                description: 'Which tenants this user has access to',
            },
            fields: [
                {
                    name: 'tenant',
                    type: 'relationship',
                    relationTo: 'tenants',
                    required: true,
                },
                {
                    name: 'status',
                    type: 'select',
                    defaultValue: 'active',
                    options: [
                        { label: 'Pending', value: 'pending' },
                        { label: 'Active', value: 'active' },
                        { label: 'Suspended', value: 'suspended' },
                    ],
                },
                {
                    name: 'role',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Owner', value: 'owner' },
                        { label: 'Admin', value: 'admin' },
                        { label: 'Editor', value: 'editor' },
                        { label: 'Viewer', value: 'viewer' },
                        { label: 'Custom', value: 'custom' },
                    ],
                },
                {
                    name: 'permissions',
                    type: 'select',
                    hasMany: true,
                    admin: {
                        condition: (_, siblingData) => siblingData.role === 'custom',
                        description: 'Select custom features this user can access',
                    },
                    options: [
                        { label: 'Products & Inventory', value: 'products' },
                        { label: 'Orders & Fulfillment', value: 'orders' },
                        { label: 'Blog Management', value: 'blog' },
                        { label: 'Store Design (Builder)', value: 'builder' },
                        { label: 'Settings & Domain', value: 'settings' },
                    ],
                },
            ],
        },
        {
            name: 'avatar',
            type: 'upload',
            relationTo: 'media',
        },
        {
            name: 'prefer_lang',
            type: 'select',
            defaultValue: 'en',
            admin: {
                description: 'Preferred display language for the CMS interface.',
            },
            options: [
                { label: 'English', value: 'en' },
                { label: 'Bahasa Melayu', value: 'ms' },
            ],
        },
        {
            name: 'has_seen_ai_wizard',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                position: 'sidebar',
                description: 'Whether the user has completed the initial CMS AI Wizard.',
            },
        },
        {
            name: 'lastLoginAt',
            type: 'date',
            admin: { readOnly: true },
        },
        {
            name: 'migrationStatus',
            type: 'select',
            defaultValue: 'migrated',
            options: [
                { label: 'Migrated', value: 'migrated' },
                { label: 'Pending', value: 'pending' },
                { label: 'Failed', value: 'failed' },
            ],
            admin: { description: 'Migration status from legacy SSO system', position: 'sidebar' },
        },
        {
            name: 'customerIdNumber',
            type: 'text',
            admin: { description: 'TM customer ID — composite key with email' },
        },
        // ── Audit trail (hidden from admin) ──
        {
            name: 'createdBy',
            type: 'relationship',
            relationTo: 'users',
            admin: { hidden: true, description: 'User who created this record (audit trail)' },
            access: { update: () => false },
        },
        {
            name: 'updatedBy',
            type: 'relationship',
            relationTo: 'users',
            admin: { hidden: true, description: 'User who last updated this record (audit trail)' },
        },
        // ── OTP 2FA fields (hidden from admin) ──
        {
            name: 'otpHash',
            type: 'text',
            admin: { hidden: true },
        },
        {
            name: 'otpExpiresAt',
            type: 'date',
            admin: { hidden: true },
        },
        {
            name: 'otpAttempts',
            type: 'number',
            defaultValue: 0,
            admin: { hidden: true },
        },
        {
            name: 'keyString',
            type: 'text',
            // Server-managed only — never expose or allow direct writes via REST/GraphQL.
            // Internal writes use overrideAccess:true (provision, reset-password, me/password routes).
            // Same pattern as Orders.magicLinkSecret and Tenants.xenditSecretKey.
            access: { read: () => false, update: () => false },
            admin: { hidden: true, description: 'Encrypted SSO password for outbound SSO API calls' },
        },
    ],
    timestamps: true,
}
