import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'

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

        const token = authHeader.split(' ')[1]

        let callerUser: any
        try {
            const authResult = await payload.auth({
                headers: new Headers({
                    Authorization: `JWT ${token}`,
                }),
            })
            callerUser = authResult?.user || null

            if (!callerUser) {
                return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
            }
        } catch (error) {
            console.error('[SSO Auth Error]', error)
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
        const customerId = rawPayload.customer_id_number || ''
        const serviceId = rawPayload.service_id || ''
        const orderId = rawPayload.unifi_order_id || ''

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

        // ── 4. Unique Check ──
        const existingEmail = await payload.find({
            collection: 'users',
            where: { email: { equals: email } },
            limit: 1,
        })

        if (existingEmail.docs.length > 0) {
            return NextResponse.json(
                { message: 'User with this email already exists' },
                { status: 409 },
            )
        }

        // ── 5. Map pack_code → plan ──
        const mapPlan = (code: string): string => {
            const c = code.toLowerCase()
            if (c.includes('business')) return 'business'
            if (c.includes('pro')) return 'pro'
            if (c.includes('starter')) return 'starter'
            return 'free'
        }

        // ── 6. Generate slug ──
        // ── 7. Create Tenant ──
        const baseSlug = companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')
            .substring(0, 30)
        const uniqueSlug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`

        const { password: _ssoPassword, ...safeMetaData } = rawPayload

        const newTenant = await payload.create({
            collection: 'tenants',
            data: {
                name: companyName,
                slug: uniqueSlug,
                plan: mapPlan(packCode),
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
        const newUser = await payload.create({
            collection: 'users',
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
            },
        })

        return NextResponse.json(
            {
                message: 'Provisioning successful',
                user: { id: newUser.id, email: newUser.email },
                tenant: { id: newTenant.id, slug: newTenant.slug },
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
