import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import crypto from 'crypto'

/**
 * POST /api/v1/tm/users
 *
 * SSO Auto-Provisioning endpoint.
 * Receives full payload from TM Legacy SSO system, validates required fields,
 * creates User (Owner) + Tenant (Workspace), stores raw payload as metaData.
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

        // Verify the token belongs to an admin/super-admin user
        let callerUser: any
        try {
            // Decode and verify JWT manually using the same secret as Payload
            const secret = process.env.PAYLOAD_SECRET || 'fallback-dev-secret'
            const [header, body, signature] = token.split('.')
            const expectedSig = crypto
                .createHmac('sha256', secret)
                .update(`${header}.${body}`)
                .digest('base64url')

            if (signature !== expectedSig) {
                return NextResponse.json(
                    { message: 'Invalid token' },
                    { status: 401 },
                )
            }

            const decoded = JSON.parse(Buffer.from(body, 'base64url').toString())

            // Check expiry
            if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
                return NextResponse.json(
                    { message: 'Token expired' },
                    { status: 401 },
                )
            }

            // Fetch the user to verify roles
            callerUser = await payload.findByID({
                collection: 'users',
                id: decoded.id,
            })
        } catch {
            return NextResponse.json(
                { message: 'Invalid token' },
                { status: 401 },
            )
        }

        if (!callerUser?.roles?.includes('super-admin')) {
            return NextResponse.json(
                { message: 'Insufficient permissions. Super-admin role required.' },
                { status: 403 },
            )
        }

        // ── 2. Parse & Validate Payload ──
        const rawPayload = await req.json()
        const {
            company_name,
            email,
            customer_id_number,
            service_id,
            first_name,
            last_name,
            pack_code,
            telephone,
            preferred_language,
            unifi_order_id,
            // Address fields
            unit_number,
            floor_number,
            building_name,
            street_name,
            section,
            post_code,
            city,
            state,
            country,
        } = rawPayload

        // Required fields check (FR-02)
        const requiredFields = { company_name, email, customer_id_number, service_id, first_name, last_name, pack_code }
        const missingFields = Object.entries(requiredFields)
            .filter(([, v]) => !v || String(v).trim() === '')
            .map(([k]) => k)

        if (missingFields.length > 0) {
            return NextResponse.json(
                { message: `Missing required fields: ${missingFields.join(', ')}` },
                { status: 400 },
            )
        }

        // Service ID must not be "NA" (FR-02)
        if (service_id === 'NA' || String(service_id).trim() === '') {
            return NextResponse.json(
                { message: 'service_id is required and cannot be "NA"' },
                { status: 400 },
            )
        }

        // ── 3. Unique Check (FR-02) ──
        const [existingEmail, existingCustomerId, existingServiceId] = await Promise.all([
            payload.find({
                collection: 'users',
                where: { email: { equals: email } },
                limit: 1,
            }),
            payload.find({
                collection: 'tenants',
                where: { customerId: { equals: customer_id_number } },
                limit: 1,
            }),
            payload.find({
                collection: 'tenants',
                where: { serviceId: { equals: service_id } },
                limit: 1,
            }),
        ])

        if (existingEmail.docs.length > 0) {
            return NextResponse.json(
                { message: 'User with this email already exists' },
                { status: 409 },
            )
        }
        if (existingCustomerId.docs.length > 0) {
            return NextResponse.json(
                { message: 'Tenant with this customer_id_number already exists' },
                { status: 409 },
            )
        }
        if (existingServiceId.docs.length > 0) {
            return NextResponse.json(
                { message: 'Tenant with this service_id already exists' },
                { status: 409 },
            )
        }

        // ── 4. Map pack_code → plan (FR-03) ──
        const mapPlan = (code: string): string => {
            const c = code.toLowerCase()
            if (c.includes('business')) return 'business'
            if (c.includes('pro')) return 'pro'
            if (c.includes('starter')) return 'starter'
            return 'free'
        }

        // ── 5. Build address object ──
        const addressData = {
            unit_number: unit_number || null,
            floor_number: floor_number !== 'NA' ? floor_number : null,
            building_name: building_name !== 'NA' ? building_name : null,
            street_name: street_name || null,
            section: section || null,
            post_code: post_code || null,
            city: city || null,
            state: state || null,
            country: country || null,
        }

        // ── 6. Generate slug ──
        const baseSlug = company_name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')
            .substring(0, 30)
        const uniqueSlug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`

        // ── 7. Create Tenant (FR-04) ──
        const newTenant = await payload.create({
            collection: 'tenants',
            data: {
                name: company_name,
                slug: uniqueSlug,
                plan: mapPlan(pack_code),
                customerId: customer_id_number,
                serviceId: service_id,
                packCode: pack_code,
                orderId: unifi_order_id || null,
                address: addressData,
                metaData: rawPayload,
                status: 'active',
            },
        })

        // ── 8. Create User (FR-04) ──
        const generatedPassword = crypto.randomBytes(16).toString('hex')
        const mapLang = (langCode: number | undefined): string => {
            if (langCode === 2) return 'ms'
            return 'en'
        }

        const newUser = await payload.create({
            collection: 'users',
            data: {
                email,
                password: generatedPassword,
                firstName: first_name,
                lastName: last_name || '',
                phone: telephone || '',
                roles: ['tenant-owner'],
                prefer_lang: mapLang(preferred_language),
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
