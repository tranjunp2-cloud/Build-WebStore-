import type { Payload } from 'payload'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:adminprimeweb@yopmail.com'

let vapidConfigured = false

interface PushPayload {
  title: string
  body?: string
  tag: string
  actionUrl?: string
}

/**
 * Send push notifications to all active subscriptions for a user+tenant.
 * Handles expired endpoints by marking them inactive.
 * Fire-and-forget — never throws (logs errors internally).
 *
 * Uses dynamic import for `web-push` to avoid module resolution errors
 * when the package is not installed (e.g., Docker dev without rebuild).
 */
export async function sendPushToUser(
  userId: number | string,
  tenantId: number | string,
  pushPayload: PushPayload,
  payload: Payload,
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0 }

  let webpush: typeof import('web-push')
  try {
    webpush = await import('web-push')
  } catch {
    console.warn('[Push] web-push package not available, skipping push notifications')
    return { sent: 0, failed: 0 }
  }

  if (!vapidConfigured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    vapidConfigured = true
  }

  let sent = 0
  let failed = 0

  try {
    const subs = await payload.find({
      collection: 'push-subscriptions',
      where: {
        and: [
          { user: { equals: userId } },
          { tenant: { equals: tenantId } },
          { isActive: { equals: true } },
        ],
      },
      limit: 20,
      depth: 0,
    })

    const pushData = JSON.stringify({
      title: pushPayload.title,
      body: pushPayload.body || '',
      tag: pushPayload.tag,
      actionUrl: pushPayload.actionUrl || '/',
    })

    const results = await Promise.allSettled(
      subs.docs.map(async (sub) => {
        const subscription = {
          endpoint: sub.endpoint as string,
          keys: {
            p256dh: sub.p256dh as string,
            auth: sub.auth as string,
          },
        }

        try {
          await webpush.sendNotification(subscription, pushData)
          sent++
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode
          // 410 Gone or 404 = endpoint expired, deactivate
          if (statusCode === 410 || statusCode === 404) {
            await payload.update({
              collection: 'push-subscriptions',
              id: sub.id,
              data: { isActive: false },
            }).catch((e: Error) => console.error('[Push] Failed to deactivate subscription', e))
          }
          failed++
        }
      }),
    )

    void results
  } catch (err) {
    console.error('[Push] Failed to query subscriptions', err)
  }

  return { sent, failed }
}
