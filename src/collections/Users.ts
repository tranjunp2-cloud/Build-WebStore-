import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { sendEmail } from '@/lib/email/send'
import { welcomeEmail } from '@/lib/email/templates/welcome'
import { forgotPasswordEmail } from '@/lib/email/templates/forgot-password'
import { generateOTP, hashOTP, getOTPExpiry } from '@/lib/otp/generate'
import { otpVerificationEmail } from '@/lib/email/templates/otp-verification'

/**
 * afterChange hook: send Welcome email to new users.
 * Non-blocking — registration succeeds even if email fails.
 */
const sendWelcomeEmailHook: CollectionAfterChangeHook = async ({ doc, operation }) => {
    if (operation !== 'create') return doc

    const userName = doc.firstName || doc.email?.split('@')[0] || 'there'
    const { subject, html } = welcomeEmail({ userName })

    // Fire-and-forget — don't block registration
    sendEmail({ to: doc.email, subject, html }).catch((err) => {
        console.error(`[Users] Failed to send welcome email to ${doc.email}:`, err)
    })

    return doc
}

export const Users: CollectionConfig = {
    slug: 'users',
    auth: {
        forgotPassword: {
            generateEmailHTML: (args) => {
                const token = args?.token || ''
                const user = args?.user || {}
                const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
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

                // Generate OTP
                const otp = generateOTP()
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

                // Send OTP email via Payload's nodemailer adapter (AWS SES)
                const { subject, html } = otpVerificationEmail({ userName, otpCode: otp })
                req.payload.sendEmail({ to: email, subject, html }).catch((err: unknown) => {
                    console.error(`[Users] Failed to send OTP email to ${email}:`, err)
                })

                console.log(`[OTP] Sent to ${email}`)
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

                // Check expiry
                if (!user.otpHash || !user.otpExpiresAt) {
                    return Response.json(
                        { errors: [{ message: 'No verification code found. Please request a new one.' }] },
                        { status: 401 },
                    )
                }

                const isExpired = Date.now() > new Date(user.otpExpiresAt as string).getTime()
                if (isExpired) {
                    return Response.json(
                        { errors: [{ message: 'Code has expired. Please request a new one.' }] },
                        { status: 401 },
                    )
                }

                // Verify OTP hash
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

                // OTP valid — clear OTP fields
                await req.payload.update({
                    collection: 'users',
                    id: user.id,
                    data: {
                        otpHash: '',
                        otpExpiresAt: null,
                        otpAttempts: 0,
                        lastLoginAt: new Date().toISOString(),
                    },
                })

                // Generate JWT token using built-in crypto (no external deps)
                const crypto = await import('crypto')
                const secret = process.env.PAYLOAD_SECRET || 'fallback-dev-secret'
                const expSeconds = 60 * 60 * 24 // 24 hours
                const now = Math.floor(Date.now() / 1000)

                const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
                const payload = Buffer.from(JSON.stringify({
                    id: user.id,
                    email: user.email,
                    collection: 'users',
                    iat: now,
                    exp: now + expSeconds,
                })).toString('base64url')
                const signature = crypto.createHmac('sha256', secret)
                    .update(`${header}.${payload}`)
                    .digest('base64url')
                const token = `${header}.${payload}.${signature}`

                // Sanitize user object for response (remove sensitive fields)
                const { otpHash: _h, otpExpiresAt: _e, otpAttempts: _a, ...safeUser } = user

                return Response.json({
                    message: 'Verification successful',
                    token,
                    user: safeUser,
                    exp: now + expSeconds,
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
                    name: 'role',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Owner', value: 'owner' },
                        { label: 'Admin', value: 'admin' },
                        { label: 'Editor', value: 'editor' },
                        { label: 'Viewer', value: 'viewer' },
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
