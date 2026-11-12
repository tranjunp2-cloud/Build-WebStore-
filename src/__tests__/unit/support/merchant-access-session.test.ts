// @vitest-environment node
/**
 * TC-F15.39 (detection): a merchant-access session is recognised from EVERY candidate token, so a fake
 * `Authorization: Bearer x` header cannot hide the impersonation cookie.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import {
    IMPERSONATION_FORBIDDEN,
    getMerchantAccessActorId,
    isMerchantAccessSession,
} from '@/lib/support/merchant-access-session'
import { signMerchantSessionToken } from '@/lib/support/merchant-access-token'

const SECRET = 'merchant-access-session-test-secret'
const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) })

async function plainSessionToken(): Promise<string> {
    return new SignJWT({ id: 3185, collection: 'users', mfa_verified: true })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(SECRET))
}

beforeEach(() => {
    process.env.PAYLOAD_SECRET = SECRET
})

describe('[TC-F15.39] merchant access session detection', () => {
    it('TC-F15.39: exposes the forbidden code the clients branch on', () => {
        expect(IMPERSONATION_FORBIDDEN).toBe('impersonation_forbidden_action')
    })

    it('TC-F15.39: reads impersonated_by from the cookie token', async () => {
        const token = await signMerchantSessionToken({ id: 3185, email: 'o@x.com' }, 7, 'ben@primecommerce.asia')

        const source = req({ cookie: `payload-token=${token}` })

        expect(getMerchantAccessActorId(source)).toBe(7)
        expect(isMerchantAccessSession(source)).toBe(true)
    })

    it('TC-F15.39: a fake Authorization header does not hide the impersonation cookie', async () => {
        const token = await signMerchantSessionToken({ id: 3185, email: 'o@x.com' }, 7)

        const source = req({ authorization: 'Bearer x', cookie: `theme=dark; payload-token=${token}` })

        expect(isMerchantAccessSession(source)).toBe(true)
    })

    it('TC-F15.39: a valid plain-session header does not hide the impersonation cookie either', async () => {
        const token = await signMerchantSessionToken({ id: 3185, email: 'o@x.com' }, 7)

        const source = req({ authorization: `JWT ${await plainSessionToken()}`, cookie: `payload-token=${token}` })

        expect(isMerchantAccessSession(source)).toBe(true)
    })

    it('TC-F15.39/40: recognises percent-encoded cookie JWTs like Next cookies()', async () => {
        // Arrange
        const token = await signMerchantSessionToken({ id: 3185, email: 'o@x.com' }, 7)
        const source = req({ cookie: `payload-token=${token.replaceAll('.', '%2E')}`, authorization: 'Bearer x' })
        // Act / Assert
        expect(getMerchantAccessActorId(source)).toBe(7)
    })

    it('TC-F15.39: ignores malformed percent encoding without throwing', () => {
        expect(isMerchantAccessSession(req({ cookie: 'payload-token=%E0%A4%A' }))).toBe(false)
    })

    it('TC-F15.39: a normal merchant session, garbage tokens and no token are not impersonation', async () => {
        expect(isMerchantAccessSession(req({ cookie: `payload-token=${await plainSessionToken()}` }))).toBe(false)
        expect(isMerchantAccessSession(req({ authorization: 'Bearer x', cookie: 'payload-token=not.a.jwt' }))).toBe(false)
        expect(isMerchantAccessSession(req({}))).toBe(false)
        expect(getMerchantAccessActorId({} as never)).toBeNull()
    })
})
