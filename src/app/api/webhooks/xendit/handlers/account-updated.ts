import { timingSafeEqual } from 'crypto'
import type { Payload } from 'payload'
import { mapXenditAccountStatus } from '@/lib/payment/xendit'
import type { XenditAccountStatus } from '@/lib/payment/types'

/**
 * Verify the X-CALLBACK-TOKEN header using timing-safe comparison.
 * Returns false if token is missing or does not match XENDIT_WEBHOOK_TOKEN env var.
 */
export function verifyXenditCallbackToken(received: string | null): boolean {
    const expected = process.env.XENDIT_WEBHOOK_TOKEN
    if (!expected || !received) return false
    const a = Buffer.from(received)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
}

/**
 * Handle Xendit sub-account events (account.created / account.updated / account.activated).
 * Updates tenant xenditAccountStatus and xenditOnboardingComplete.
 * Never throws — unknown accounts are logged and skipped (race-safe).
 */
export async function handleAccountEvent(
    payload: Payload,
    event: string,
    data: Record<string, any>,
): Promise<void> {
    const accountId: string | undefined = data.id
    if (!accountId) {
        console.warn('[Xendit Webhook] handleAccountEvent: missing data.id, skipping')
        return
    }

    const { docs } = await payload.find({
        collection: 'tenants',
        where: { xenditAccountId: { equals: accountId } },
        limit: 1,
        overrideAccess: true,
    })
    const tenant = docs[0]

    if (!tenant) {
        console.log('[Xendit Webhook] No tenant for account', accountId)
        return
    }

    let status: XenditAccountStatus
    let onboardingComplete: boolean

    if (event === 'account.activated') {
        status = 'LIVE'
        onboardingComplete = true
    } else {
        // account.created | account.updated
        status = mapXenditAccountStatus(data.status ?? '')
        onboardingComplete = status === 'LIVE'
    }

    await payload.update({
        collection: 'tenants',
        id: tenant.id,
        data: { xenditAccountStatus: status, xenditOnboardingComplete: onboardingComplete },
        overrideAccess: true,
    })

    console.log('[Xendit Webhook] Tenant', tenant.id, 'status →', status)
}
