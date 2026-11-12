// @vitest-environment node
/**
 * TC-F15.39: a merchant-access session cannot move the payout destination (bank/QR, Xendit, Stripe).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findByID, update, getCurrentUser, getCurrentTenantId, exchangeOAuthCode, requestHeaders, createManagedAccount } = vi.hoisted(() => ({
    findByID: vi.fn(),
    update: vi.fn(),
    getCurrentUser: vi.fn(),
    getCurrentTenantId: vi.fn(),
    exchangeOAuthCode: vi.fn(),
    requestHeaders: { current: new Headers() },
    createManagedAccount: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID, update, create: vi.fn() })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => requestHeaders.current }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser,
    getCurrentTenantId,
    withAuth: (handler: (u: unknown, r: Request, c: unknown) => unknown) => async (req: Request, ctx?: unknown) =>
        handler(await getCurrentUser(req), req, ctx),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({ withFeatureGuard: () => (h: unknown) => h }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({ id: 1, plan: 'pro' }),
    canUse: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/payload/tenant-row-lock', () => ({ withTenantRowLock: async (_p: unknown, _t: unknown, op: (req: unknown) => unknown) => op({}) }))
vi.mock('@/lib/payment/xendit-visibility', () => ({ XENDIT_ENABLED: true }))
vi.mock('@/lib/payment/xendit', () => ({ createManagedAccount, getOnboardingUrl: vi.fn().mockResolvedValue('https://xendit.test/onboard') }))
vi.mock('@/lib/payment/xendit-client', () => ({ XenditError: class extends Error {}, xenditFetch: vi.fn() }))
vi.mock('@/lib/payment/stripe', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/payment/stripe')>()),
    exchangeOAuthCode,
    deauthorizeStripeAccount: vi.fn(),
}))

import { signOAuthState, verifyOAuthState } from '@/lib/payment/stripe'
import { signMerchantSessionToken } from '@/lib/support/merchant-access-token'
import { disconnectStripe, disconnectXendit, getPaymentSettings, saveXenditKeys, updatePaymentSettings, uploadQrMedia } from '@/app/(dashboard)/settings/payments/actions'
import { POST as onboardPOST } from '@/app/api/stripe/connect/onboard/route'
import { POST as accountLinkPOST } from '@/app/api/stripe/connect/account-link/route'
import { GET as callbackGET } from '@/app/api/stripe/connect/callback/route'
import { POST as xenditPOST } from '@/app/api/xendit/connect/route'

const owner = { id: 1, email: 'owner@x.com', tenants: [{ tenant: 5, role: 'owner', status: 'active' }] }
const memberB = { id: 2, email: 'b@x.com', tenants: [{ tenant: 5, role: 'editor', status: 'active' }] }
const BANK = { bank_name: 'Maybank', account_holder_name: 'Shop', account_number: '1234567890', payment_cod: true }
const FORBIDDEN = 'impersonation_forbidden_action'
let sessionCookie: string

const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('https://app.test/api/x', { method: 'POST', body: JSON.stringify(body), headers })
const callback = (state: string, headers: Record<string, string> = {}) =>
    new Request(`https://app.test/api/stripe/connect/callback?code=c&state=${encodeURIComponent(state)}`, { headers })
const location = (res: Response) => res.headers.get('location') ?? ''

beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('PAYLOAD_SECRET', 'payment-guard-secret')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
    vi.stubEnv('STRIPE_CLIENT_ID', 'ca_test')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://app.test')
    sessionCookie = `payload-token=${await signMerchantSessionToken({ id: 1, email: owner.email }, 7)}`
    requestHeaders.current = new Headers()
    getCurrentUser.mockResolvedValue(owner)
    getCurrentTenantId.mockResolvedValue(5)
    findByID.mockResolvedValue({ id: 5, name: 'Shop', payments: { ...BANK }, stripeAccountId: 'acct_old' })
    update.mockResolvedValue({})
    exchangeOAuthCode.mockResolvedValue({ stripeUserId: 'acct_new' })
})

describe('[TC-F15.39] payments server actions inside a merchant-access session', () => {
    it('TC-F15.39: hides bank details and refuses payout writes, even with a fake Authorization header', async () => {
        requestHeaders.current = new Headers({ authorization: 'Bearer x', cookie: sessionCookie })

        const settings = (await getPaymentSettings()) as { payments: Record<string, unknown> }
        const write = await updatePaymentSettings({ bank_name: 'Evil', account_number: '999' })
        const qr = await uploadQrMedia(new FormData())

        expect(settings.payments).not.toHaveProperty('account_number')
        expect(settings.payments).not.toHaveProperty('bank_name')
        expect(write).toEqual({ success: false, error: FORBIDDEN })
        expect(qr).toMatchObject({ success: false, error: FORBIDDEN })
        expect(update).not.toHaveBeenCalled()
    })

    it('TC-F15.39: blocks saveXenditKeys, disconnectXendit and disconnectStripe', async () => {
        requestHeaders.current = new Headers({ cookie: sessionCookie })

        expect(await saveXenditKeys('xnd_key', 'tok')).toEqual({ success: false, error: FORBIDDEN })
        expect(await disconnectXendit()).toEqual({ success: false, error: FORBIDDEN })
        expect(await disconnectStripe()).toEqual({ success: false, error: FORBIDDEN })
        expect(update).not.toHaveBeenCalled()
    })

    it('TC-F15.39: toggling a payment method still saves in the session', async () => {
        requestHeaders.current = new Headers({ cookie: sessionCookie })

        const result = await updatePaymentSettings({ payment_cod: true })

        expect(result).toMatchObject({ success: true })
        expect(update).toHaveBeenCalled()
    })

    it('TC-F15.39: a normal owner still reads bank details and writes the payout account', async () => {
        const settings = (await getPaymentSettings()) as { payments: Record<string, unknown> }
        const write = await updatePaymentSettings({ bank_name: 'Maybank 2' })

        expect(settings.payments).toHaveProperty('account_number', '1234567890')
        expect(write).toMatchObject({ success: true })
        expect(await disconnectStripe()).toEqual({ success: true })
    })
})

describe('[TC-F15.39] Stripe / Xendit connect endpoints', () => {
    const body = { tenantId: '5' }

    it.each([
        ['stripe onboard', onboardPOST],
        ['stripe account-link', accountLinkPOST],
        ['xendit connect', xenditPOST],
    ])('TC-F15.39: %s is 403 in a session (fake Authorization header included), nothing written', async (_n, route) => {
        const res = await (route as (r: Request, c: unknown) => Promise<Response>)(
            post(body, { authorization: 'Bearer x', cookie: sessionCookie }), {})

        expect(res.status).toBe(403)
        expect(JSON.stringify(await res.json())).toContain(FORBIDDEN)
        expect(update).not.toHaveBeenCalled()
        expect(createManagedAccount).not.toHaveBeenCalled()
    })

    it.each([
        ['stripe onboard', onboardPOST],
        ['stripe account-link', accountLinkPOST],
        ['xendit connect', xenditPOST],
    ])('TC-F15.39: %s is 403 for an active member who is not owner/admin', async (_n, route) => {
        getCurrentUser.mockResolvedValue(memberB)

        const res = await (route as (r: Request, c: unknown) => Promise<Response>)(post(body), {})

        expect(res.status).toBe(403)
        expect(update).not.toHaveBeenCalled()
    })

    it('TC-F15.39: a normal owner still gets the OAuth URL for their tenant', async () => {
        const res = await onboardPOST(post(body), {} as never)
        const { data } = (await res.json()) as { data: { oauthUrl: string } }

        expect(res.status).toBe(200)
        const state = new URL(data.oauthUrl).searchParams.get('state')!
        expect(verifyOAuthState(state)).toBe('5')
    })
})

describe('[TC-F15.39] Stripe OAuth callback', () => {
    it('TC-F15.39: outside a merchant-access session the callback still saves the account', async () => {
        const res = await callbackGET(callback(signOAuthState('5')))

        expect(location(res)).toContain('?stripe=complete')
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            id: '5',
            data: expect.objectContaining({ stripeAccountId: 'acct_new', stripeOnboardingComplete: false }),
        }))
    })

    it('TC-F15.39: a valid state replayed from a merchant-access session redirects to refresh, account unchanged', async () => {
        const res = await callbackGET(callback(signOAuthState('5'), { authorization: 'Bearer x', cookie: sessionCookie }))

        expect(location(res)).toContain('?stripe=refresh')
        expect(exchangeOAuthCode).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()
    })
})
