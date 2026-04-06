import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email/send'
import { welcomeEmail } from '@/lib/email/templates/welcome'
import { staffInvitationEmail } from '@/lib/email/templates/staff-invitation'
import { forgotPasswordEmail } from '@/lib/email/templates/forgot-password'
import { generateOTP, hashOTP, getOTPExpiry } from '@/lib/otp/generate'
import { otpVerificationEmail } from '@/lib/email/templates/otp-verification'

/** Minimal shape of a user's tenant membership returned by Payload queries */
interface TenantMembership {
    tenant: string | { id: string }
    role: string
    status?: string
    permissions?: string[]
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
        maxLoginAttempts: 50, // Restore to 50 so Payload doesn't drop columns
        lockTime: 10 * 60 * 1000,
        forgotPassword: {
            generateEmailHTML: (args) => {
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
                        process.env.NEXT_PUBLIC_APP_URL,
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
                const { html } = forgotPasswordEmail({ userName, resetUrl })
                return html
            },
            generateEmailSubject: () => {
                return 'Reset your PrimeWeb password \uD83D\uDD10'
            },
        },
    },
    admin: {
        useAsTitle: 'email',
        description: 'Platform users — can be super-admins or tenant members.',
    },
    hooks: {
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

                // Check permissions of requester
                const requesterTenant = req.user.tenants?.find((t: any) =>
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
                )
                if (!requesterTenant || !['owner', 'admin'].includes(requesterTenant.role)) {
                    return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
                }

                // Security: Only an owner can invite another owner
                if (role === 'owner' && requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Only an owner can invite another owner' }] }, { status: 403 })
                }

                try {
                    // Check if user exists
                    const users = await req.payload.find({ collection: 'users', where: { email: { equals: email } } })
                    let targetUser = users.docs[0]
                    let isNewUser = false
                    let tempPassword = ''

                    if (targetUser) {
                        // Check if already in tenant
                        const alreadyInTenant = targetUser.tenants?.find((t: any) =>
                            (t.tenant?.id === tenantId || t.tenant === tenantId)
                        )
                        if (alreadyInTenant) {
                            return Response.json({ errors: [{ message: 'User is already a member of this workspace' }] }, { status: 400 })
                        }

                        // Add to tenant
                        await req.payload.update({
                            collection: 'users',
                            id: targetUser.id,
                            data: {
                                tenants: [
                                    ...(targetUser.tenants || []),
                                    { tenant: tenantId, role, status: 'pending', permissions: role === 'custom' ? permissions : undefined }
                                ]
                            }
                        })
                    } else {
                        // Generate a cryptographically secure temporary password (crypto.randomBytes)
                        tempPassword = randomBytes(8).toString('base64url').slice(0, 12)
                        isNewUser = true

                        targetUser = await req.payload.create({
                            collection: 'users',
                            data: {
                                email,
                                firstName: name,
                                password: tempPassword,
                                roles: ['tenant-owner'], // Default platform role
                                tenants: [
                                    { tenant: tenantId, role, status: 'pending', permissions: role === 'custom' ? permissions : undefined }
                                ]
                            }
                        })
                    }

                    // Fetch tenant details for email
                    const tenant = await req.payload.findByID({ collection: 'tenants', id: tenantId })
                    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
                    const loginUrl = `${serverUrl}/login`

                    const { subject, html } = staffInvitationEmail({
                        userName: name || targetUser.firstName || email.split('@')[0],
                        workspaceName: tenant.name as string,
                        loginUrl,
                        temporaryPassword: isNewUser ? tempPassword : undefined
                    })

                    req.payload.sendEmail({ to: email, subject, html }).catch((err: unknown) => {
                        console.error(`[StaffInvite] Failed to send email to ${email}:`, err)
                    })

                    return Response.json({ message: 'Invitation sent successfully' })
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
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
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
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
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
                            u.tenants?.find((t: any) => (t.tenant?.id === tenantId || t.tenant === tenantId) && t.role === 'owner' && t.status === 'active')
                        )

                        if (activeOwners.length <= 1) {
                            return Response.json({ errors: [{ message: 'Cannot remove the last workspace owner' }] }, { status: 400 })
                        }
                    }
                }

                // Remove the tenant from the user's tenants array
                const updatedTenants = [...(targetUser.tenants || [])]
                updatedTenants.splice(targetTenantIndex, 1)

                await req.payload.update({
                    collection: 'users',
                    id: userId,
                    data: { tenants: updatedTenants }
                })

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
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
                )
                if (!requesterTenant || requesterTenant.role !== 'owner') {
                    return Response.json({ errors: [{ message: 'Forbidden: Only owners can update staff' }] }, { status: 403 })
                }

                const targetUser = await req.payload.findByID({ collection: 'users', id: userId })
                if (!targetUser) return Response.json({ errors: [{ message: 'User not found' }] }, { status: 404 })

                const targetTenantIndex = targetUser.tenants?.findIndex((t: any) =>
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
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
                            u.tenants?.find((t: any) => (t.tenant?.id === tenantId || t.tenant === tenantId) && t.role === 'owner' && t.status === 'active')
                        )
                        if (activeOwners.length <= 1) {
                            return Response.json({ errors: [{ message: 'Cannot demote the last workspace owner' }] }, { status: 400 })
                        }
                    }
                }

                const updatedTenants = [...(targetUser.tenants || [])]
                updatedTenants[targetTenantIndex].role = role as any
                updatedTenants[targetTenantIndex].permissions = role === 'custom' ? permissions : undefined

                await req.payload.update({
                    collection: 'users',
                    id: userId,
                    data: {
                        firstName: name, // Overwrite name along with access rights
                        tenants: updatedTenants
                    }
                })

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
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
                )
                if (!requesterTenant || !['owner', 'admin'].includes(requesterTenant.role)) {
                    return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
                }

                const targetUser = await req.payload.findByID({ collection: 'users', id: userId })
                if (!targetUser) return Response.json({ errors: [{ message: 'User not found' }] }, { status: 404 })

                const targetTenantIndex = targetUser.tenants?.findIndex((t: any) =>
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
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
                            u.tenants?.find((t: any) => (t.tenant?.id === tenantId || t.tenant === tenantId) && t.role === 'owner' && t.status === 'active')
                        )
                        if (activeOwners.length <= 1) {
                            return Response.json({ errors: [{ message: 'Cannot deactivate the last workspace owner' }] }, { status: 400 })
                        }
                    }
                }

                const updatedTenants = [...(targetUser.tenants || [])]
                updatedTenants[targetTenantIndex].status = status as any

                await req.payload.update({
                    collection: 'users',
                    id: userId,
                    data: { tenants: updatedTenants }
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
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
                )
                if (!requesterTenant || !['owner', 'admin'].includes(requesterTenant.role)) {
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

                req.payload.sendEmail({ to: targetUser.email, subject, html }).catch((err: unknown) => {
                    console.error(`[StaffInvite] Failed to resend email to ${targetUser.email}:`, err)
                })

                return Response.json({ message: 'Invitation resent successfully' })
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
                    (t.tenant?.id === tenantId || t.tenant === tenantId)
                )
                if (!requesterTenant || !['owner', 'admin'].includes(requesterTenant.role)) {
                    return Response.json({ errors: [{ message: 'Forbidden' }] }, { status: 403 })
                }

                let removedCount = 0;
                let errorCount = 0;

                for (const userId of userIds) {
                    try {
                        const targetUser = await req.payload.findByID({ collection: 'users', id: userId })
                        if (!targetUser) continue;

                        const targetTenantIndex = targetUser.tenants?.findIndex((t: any) =>
                            (t.tenant?.id === tenantId || t.tenant === tenantId)
                        ) ?? -1
                        if (targetTenantIndex === -1) continue;

                        const targetTenantRole = targetUser.tenants![targetTenantIndex].role
                        if (targetTenantRole === 'owner') {
                            const allStaff = await req.payload.find({ collection: 'users', where: { 'tenants.tenant': { equals: tenantId } }, limit: 1000 })
                            const activeOwners = allStaff.docs.filter((u: any) => u.tenants?.find((t: any) => (t.tenant?.id === tenantId || t.tenant === tenantId) && t.role === 'owner' && t.status === 'active'))
                            if (activeOwners.length <= 1) {
                                errorCount++;
                                continue;
                            }
                        }

                        const updatedTenants = [...(targetUser.tenants || [])]
                        updatedTenants.splice(targetTenantIndex, 1)

                        await req.payload.update({ collection: 'users', id: userId, data: { tenants: updatedTenants } })
                        removedCount++;
                    } catch (e) {
                        errorCount++;
                    }
                }

                return Response.json({ message: `Removed ${removedCount} users. ${errorCount ? `${errorCount} errors.` : ''}` })
            }
        },
        {
            path: '/send-otp',
            method: 'post',
            handler: async (req) => {
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
                const useE2EBypass = !!(testOtpCode && testEmail && email === testEmail)

                const otp = (useDevBypass || useE2EBypass) ? testOtpCode! : generateOTP()
                const otpHash = hashOTP(otp)
                const otpExpiry = getOTPExpiry()

                // Store hashed OTP in database
                await req.payload.update({
                    collection: 'users',
                    id: user.id,
                    data: {
                        otpHash,
                        otpExpiresAt: otpExpiry.toISOString(),
                        otpAttempts: 0,
                    },
                })

                // Mask email for logging
                const [local, domain] = email.split('@')
                const safeLocal = local.length <= 2 ? '*'.repeat(local.length) : local.slice(0, 2) + '***'
                const maskedEmail = `${safeLocal}@${domain}`

                if (useDevBypass || useE2EBypass) {
                    // Dev/E2E: log the bypass code, skip sending email
                    console.log(`[DEV OTP] ════════════════════════════════════`)
                    console.log(`[DEV OTP] Email: ${maskedEmail}`)
                    console.log(`[DEV OTP] Code:  ${otp}`)
                    console.log(`[DEV OTP] ════════════════════════════════════`)
                } else {
                    // Production: send real email, never log code
                    const { subject, html } = otpVerificationEmail({ userName, otpCode: otp })
                    req.payload.sendEmail({ to: email, subject, html }).catch((err: unknown) => {
                        console.error(`[Users] Failed to send OTP email to ${email}:`, err)
                    })
                    console.log(`[OTP] Code dispatched for ${maskedEmail}`)
                }
                return Response.json({ message: 'If the email exists, an OTP has been sent.' })
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

                // Dev/E2E OTP bypass — two modes:
                // 1. Dev mode: any email + magic code (NODE_ENV=development only)
                // 2. E2E test: specific TEST_EMAIL + E2E_TEST_OTP_CODE (any env)
                // Security: production MUST NOT set E2E_TEST_OTP_CODE in GitHub Secrets
                const testOtpCode = process.env.E2E_TEST_OTP_CODE
                const testEmail = process.env.TEST_EMAIL
                const isDev = process.env.NODE_ENV === 'development'
                const isDevBypass = isDev && testOtpCode && otp === testOtpCode
                const isE2EBypass = !!(testOtpCode && testEmail
                    && email === testEmail && otp === testOtpCode)
                const isTestBypass = isDevBypass || isE2EBypass

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
                            data: { otpAttempts: attempts + 1 },
                        })
                        return Response.json(
                            { errors: [{ message: 'Invalid verification code.' }] },
                            { status: 401 },
                        )
                    }
                }

                // OTP valid — clear OTP fields and activate any pending tenant invites
                const updatedTenants = (user.tenants || []).map((t: any) => {
                    if (t.status === 'pending') {
                        return { ...t, status: 'active' }
                    }
                    return t
                })

                await req.payload.update({
                    collection: 'users',
                    id: user.id,
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
                const expSeconds = 60 * 60 * 24 // 24 hours
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
            options: [
                { label: 'Super Admin', value: 'super-admin' },
                { label: 'Tenant Owner', value: 'tenant-owner' },
                { label: 'Editor', value: 'editor' },
                { label: 'Viewer', value: 'viewer' },
            ],
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
    ],
    timestamps: true,
}
