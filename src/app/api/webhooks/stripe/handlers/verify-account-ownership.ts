import type { Payload } from 'payload'

/**
 * Verify a connected-account webhook event is authorised to act on the given tenant.
 *
 * Fail-closed: if the tenant has no stripeAccountId we cannot verify ownership and we
 * reject — this prevents any connected account from targeting non-onboarded tenants.
 *
 * Returns true if the event may proceed, false if it must be silently rejected.
 * Caller is responsible for `return` after a false result.
 */
export async function verifyConnectedAccountOwnership(
    payload: Payload,
    connectedAccountId: string | undefined,
    tenantId: number | string,
    eventLabel: string,
): Promise<boolean> {
    if (!connectedAccountId) return true  // platform webhook — no Connected Account check

    const tenant = await payload.findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        overrideAccess: true,
    }).catch(() => null) as any

    // Fail-closed: unknown tenant or tenant not yet onboarded → can't verify → reject
    if (!tenant?.stripeAccountId) {
        console.error(
            `[Stripe Webhook] SECURITY: ${eventLabel} — tenant ${tenantId} has no stripeAccountId; rejecting connected-account event from ${connectedAccountId}`,
        )
        return false
    }

    if (tenant.stripeAccountId !== connectedAccountId) {
        console.error(
            `[Stripe Webhook] SECURITY: ${eventLabel} — forged event from ${connectedAccountId} ≠ tenant ${tenantId} account ${tenant.stripeAccountId}`,
        )
        return false
    }

    return true
}
