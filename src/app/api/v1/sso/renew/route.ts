import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { dateOnly } from '@/lib/subscriptions/plan-subscription'

/**
 * PUT /api/v1/sso/renew
 *
 * Renews tenant's subscription by extending endsAt only — plan code unchanged.
 * Mirrors PW1 PlanSubscription::renew() + sendUpdateExpiredTimeToProduct().
 * Returns 404 if no 'main' subscription exists (no upsert — renew requires existing record).
 *
 * Auth: Bearer token (super-admin)
 * Body: { email, expired_at }
 */
export async function PUT(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization required' }, { status: 401 })
    }
    const callerUser = await getCurrentUser(req)
    if (!callerUser) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
    }
    if (!callerUser.roles?.includes('super-admin')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { email, expired_at } = body

    if (!email || !expired_at) {
      return NextResponse.json(
        { message: 'Missing required fields: email, expired_at' },
        { status: 400 },
      )
    }

    // Find user by email
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
    })
    if (!users.docs.length) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    // Resolve tenantId — filter for owner role to avoid picking a staff tenant
    const ownerEntry = users.docs[0].tenants?.find((t: any) => t.role === 'owner')
    if (!ownerEntry?.tenant) {
      return NextResponse.json({ message: 'User has no owner tenant' }, { status: 404 })
    }
    const tenantRef = ownerEntry.tenant
    const tenantId = typeof tenantRef === 'object' ? (tenantRef as { id: number }).id : tenantRef

    // Find existing 'main' subscription — renew does NOT upsert (AC-14)
    const subs = await payload.find({
      collection: 'plan-subscriptions',
      where: { and: [{ tenant: { equals: tenantId } }, { name: { equals: 'main' } }] },
      limit: 1,
    })
    if (!subs.docs.length) {
      return NextResponse.json({ message: 'Subscription not found' }, { status: 404 })
    }

    // Normalize MySQL datetime before parsing (B-02 fix: handle '2027-06-01 00:00:00')
    const endsAt = new Date(`${dateOnly(expired_at)}T23:59:59Z`).toISOString()

    await payload.update({
      collection: 'plan-subscriptions',
      id: subs.docs[0].id,
      data: { endsAt, canceledAt: null, status: 'active' },
    })

    return NextResponse.json({ message: 'Subscription renewed' }, { status: 200 })
  } catch (error) {
    console.error('[SSO Renew Error]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
