import { createHmac, timingSafeEqual } from 'crypto'
import { getStripeClient } from './stripe-client'

function computeStateHmac(tenantId: string, secret: string): string {
    return createHmac('sha256', secret).update(tenantId).digest('hex')
}

/**
 * Produce a tamper-proof `state` param for Stripe OAuth.
 * Format: `{tenantId}_{hmac}` signed with STRIPE_SECRET_KEY.
 * Prevents an attacker from forging `state=victim_tenantId` in the callback.
 */
export function signOAuthState(tenantId: string): string {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) throw new Error('STRIPE_SECRET_KEY is not set')
    const hmac = computeStateHmac(tenantId, secret)
    return `${tenantId}_${hmac}`
}

/**
 * Verify the signed OAuth state and return the tenantId, or null if tampered.
 */
export function verifyOAuthState(state: string): string | null {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return null
    const sepIdx = state.lastIndexOf('_')
    if (sepIdx === -1) return null
    const tenantId = state.substring(0, sepIdx)
    const providedHmac = state.substring(sepIdx + 1)
    const expected = computeStateHmac(tenantId, secret)
    try {
        const a = Buffer.from(providedHmac, 'hex')
        const b = Buffer.from(expected, 'hex')
        if (a.length !== b.length) return null
        return timingSafeEqual(a, b) ? tenantId : null
    } catch {
        return null
    }
}

export function getStripeOAuthUrl(tenantId: string): string {
    const clientId = process.env.STRIPE_CLIENT_ID
    if (!clientId) throw new Error('STRIPE_CLIENT_ID is not set')

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: 'read_write',
        state: signOAuthState(tenantId),
        prompt: 'login',
    })

    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
}

export async function exchangeOAuthCode(
    code: string,
): Promise<{ stripeUserId: string }> {
    const stripe = getStripeClient()
    const response = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code,
    })

    if (!response.stripe_user_id) {
        throw new Error('Stripe OAuth response missing stripe_user_id')
    }

    return { stripeUserId: response.stripe_user_id }
}

export async function deauthorizeStripeAccount(accountId: string): Promise<void> {
    const stripe = getStripeClient()
    const clientId = process.env.STRIPE_CLIENT_ID
    if (!clientId) throw new Error('STRIPE_CLIENT_ID is not set')

    await stripe.oauth.deauthorize({
        client_id: clientId,
        stripe_user_id: accountId,
    })
}
