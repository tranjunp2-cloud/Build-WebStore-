import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { IMPERSONATION_FORBIDDEN, isMerchantAccessSession } from '@/lib/support/merchant-access-session'

export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/push-subscribe
 * Save or re-activate a Web Push subscription for the authenticated user.
 *
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 */
export const POST = withAuth(async (user, request) => {
  // A support session must not register its browser for the merchant's notifications (TC-F15.40)
  if (isMerchantAccessSession(request)) {
    return NextResponse.json({ error: IMPERSONATION_FORBIDDEN }, { status: 403 })
  }
  try {
    const payload = await getPayload({ config })
    const body = await request.json()

    const { endpoint, keys } = body as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 })
    }

    // Validate endpoint is HTTPS URL
    try {
      const url = new URL(endpoint)
      if (url.protocol !== 'https:') {
        return NextResponse.json({ error: 'Endpoint must be HTTPS' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid endpoint URL' }, { status: 400 })
    }

    // Resolve tenant
    const userWithTenants = user as unknown as {
      tenants?: Array<{ tenant: string | { id: string } }>
    }
    const firstTenant = userWithTenants.tenants?.[0]?.tenant
    const tenantId = typeof firstTenant === 'object' ? firstTenant?.id : firstTenant

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 })
    }

    // Check if subscription already exists for this user+endpoint
    const existing = await payload.find({
      collection: 'push-subscriptions',
      where: {
        and: [
          { user: { equals: user.id } },
          { endpoint: { equals: endpoint } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    const userAgent = request.headers.get('user-agent') || undefined

    if (existing.docs.length > 0) {
      // Re-activate and update keys
      await payload.update({
        collection: 'push-subscriptions',
        id: existing.docs[0].id,
        data: {
          p256dh: keys.p256dh,
          auth: keys.auth,
          isActive: true,
          userAgent,
        },
      })
    } else {
      await payload.create({
        collection: 'push-subscriptions',
        data: {
          user: user.id,
          tenant: tenantId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          isActive: true,
          userAgent,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Push Subscribe] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * DELETE /api/notifications/push-subscribe
 * Deactivate a push subscription (user opts out).
 *
 * Body: { endpoint: string }
 */
export const DELETE = withAuth(async (user, request) => {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { endpoint } = body as { endpoint?: string }

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    const existing = await payload.find({
      collection: 'push-subscriptions',
      where: {
        and: [
          { user: { equals: user.id } },
          { endpoint: { equals: endpoint } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'push-subscriptions',
        id: existing.docs[0].id,
        data: { isActive: false },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Push Unsubscribe] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
