import type { Payload } from 'payload'
import type { PaymentWebhookEvent } from '@/lib/payment/types'

/** Minimal shape of a tenant document used in account-updated handlers. */
export interface TenantDoc {
    id: string | number
    name?: string | null
    slug?: string | null
}

// TC-F13.87: lock seller's Card/FPX when Stripe revokes the Connect application
export async function handleAccountDeauthorized(
    payload: Payload,
    event: PaymentWebhookEvent,
) {
    // Stripe sends the accountId in the top-level 'account' field for Connect events
    const accountId = event.connectedAccountId ?? (event.data as { id?: string }).id
    if (!accountId) {
        console.warn('[Stripe Webhook] account.application.deauthorized missing accountId')
        return
    }

    const tenants = await payload.find({
        collection: 'tenants',
        where: { stripeAccountId: { equals: accountId } },
        limit: 1,
    })

    if (tenants.docs.length === 0) {
        console.warn(`[Stripe Webhook] No tenant found for deauthorized account ${accountId}`)
        return
    }

    await payload.update({
        collection: 'tenants',
        id: tenants.docs[0].id,
        data: {
            stripeOnboardingComplete: false,
            payments: { payment_card: false, payment_fpx: false },
        },
    })

    console.log(`[Stripe Webhook] Tenant ${tenants.docs[0].id} deauthorized — onboarding + payment flags reset`)
}

export async function handleAccountUpdated(
    payload: Payload,
    event: PaymentWebhookEvent,
) {
    const account = event.data
    const accountId = account.id

    // Find tenant with this stripeAccountId
    const tenants = await payload.find({
        collection: 'tenants',
        where: { stripeAccountId: { equals: accountId } },
        limit: 1,
    })

    if (tenants.docs.length === 0) {
        console.warn(`[Stripe Webhook] No tenant found for Stripe account ${accountId}`)
        return
    }

    const isOnboardingComplete =
        account.charges_enabled && account.details_submitted

    // Warn if account has pending KYC deadline — will be suspended if not resolved
    const requiresActionDeadline = account.requirements?.current_deadline
    if (requiresActionDeadline) {
        const deadline = new Date(requiresActionDeadline * 1000).toISOString()
        console.warn(
            `[Stripe Webhook] Tenant ${tenants.docs[0].id} has pending Stripe requirements due ${deadline} — merchant must submit documents`,
        )
    }

    const tenantDoc = tenants.docs[0] as any
    const wasOnboardingComplete = tenantDoc.stripeOnboardingComplete ?? false

    const tenantUpdateData: Record<string, unknown> = { stripeOnboardingComplete: isOnboardingComplete }
    const fpxCapable = (account as any).capabilities?.fpx_payments === 'active'

    if (isOnboardingComplete !== wasOnboardingComplete) {
        // Onboarding status changed — sync all payment flags
        tenantUpdateData.payments = isOnboardingComplete
            ? { payment_card: true, payment_fpx: fpxCapable }
            : { payment_card: false, payment_fpx: false }
    } else if (isOnboardingComplete) {
        // Onboarding already complete — check if fpx_payments capability changed
        // (e.g. pending → active on a subsequent account.updated after initial onboarding)
        const wasFpxEnabled = tenantDoc.payments?.payment_fpx ?? false
        if (fpxCapable !== wasFpxEnabled) {
            tenantUpdateData.payments = {
                payment_card: tenantDoc.payments?.payment_card ?? true,
                payment_fpx: fpxCapable,
            }
        }
    }

    await payload.update({
        collection: 'tenants',
        id: tenantDoc.id,
        data: tenantUpdateData,
    })

    console.log(
        `[Stripe Webhook] Tenant ${tenants.docs[0].id} stripe onboarding: ${isOnboardingComplete ? 'complete' : 'pending'}`,
    )
}
