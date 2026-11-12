import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { upsertPlanSubscription, VALID_BASE_CODES } from '@/lib/subscriptions/plan-subscription'
import { revalidatePlanSubscription } from '@/lib/cache/revalidate-storefront'

/**
 * PUT /api/v1/sso/upgrade
 *
 * Updates tenant's plan-subscription to a higher plan + new period.
 * Called by SSO PrimeWebV2Service when user upgrades.
 *
 * Auth: Bearer token (super-admin)
 * Body: { email, subscription_code, subscription_type, start_date, end_date }
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
    const { email, subscription_code, subscription_type, start_date, end_date } = body

    if (!email || !subscription_code) {
      return NextResponse.json(
        { message: 'Missing required fields: email, subscription_code' },
        { status: 400 },
      )
    }
    if (!VALID_BASE_CODES.has(subscription_code.toLowerCase())) {
      return NextResponse.json(
        { message: `Invalid subscription_code: ${subscription_code}` },
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

    await upsertPlanSubscription(payload, tenantId, {
      subscriptionCode: subscription_code,
      subscriptionType: subscription_type,
      startDate: start_date,
      endDate: end_date,
    })
    // #2179: reopen the store now (post-commit; the collection hook fired before the commit)
    revalidatePlanSubscription(tenantId)

    return NextResponse.json({ message: 'Subscription upgraded' }, { status: 200 })
  } catch (error) {
    console.error('[SSO Upgrade Error]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
