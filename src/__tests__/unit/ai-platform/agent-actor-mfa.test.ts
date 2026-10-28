/**
 * TC-AISEC-013..015 — the copilot needs a session that passed the OTP step.
 * `POST /api/users/login` returns Payload's own token after the password alone (no `mfa_verified`); the middleware
 * keeps it out of pages, but `/api/*` is not behind the middleware, so the token drove refunds, buyer emails and
 * publishing through `/api/agent/*` (live-confirmed in the audit, H-S1).
 * Real: lib/auth.ts getCurrentUser, lib/ai-platform/context.ts resolveAgentActor, jose (tokens built here).
 * Faked: Payload (auth verifies the signature), the cookie store.
 */
import { SignJWT } from 'jose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieValues = new Map<string, string>()
vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({ get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined) })),
}))
const auth = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ auth, findByID: vi.fn() })) }))
vi.mock('@payload-config', () => ({ default: {} }))

import { getCurrentUser } from '@/lib/auth'
import { AgentAccessError, resolveAgentActor } from '@/lib/ai-platform/context'

const user = { id: 3, email: 'owner@shop.my', tenants: [] }
const key = new TextEncoder().encode('test-secret-test-secret-test-secret')
const token = (claims: Record<string, unknown>) =>
    new SignJWT({ id: 3, collection: 'users', ...claims }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(key)

beforeEach(() => {
    cookieValues.clear()
    auth.mockReset()
    auth.mockResolvedValue({ user })
})

describe('getCurrentUser requireMfa [TC-AISEC-013]', () => {
    it('refuses a verified Payload token that never passed the OTP step', async () => {
        // Arrange
        cookieValues.set('payload-token', await token({}))

        // Act
        const strict = await getCurrentUser(undefined, { requireMfa: true })

        // Assert
        expect(strict).toBeNull()
    })

    it('accepts the same session once it carries mfa_verified', async () => {
        cookieValues.set('payload-token', await token({ mfa_verified: true }))

        expect(await getCurrentUser(undefined, { requireMfa: true })).toEqual(user)
    })
})

describe('getCurrentUser without requireMfa [TC-AISEC-014]', () => {
    it('keeps accepting a password-only Payload token for the routes that did before', async () => {
        cookieValues.set('payload-token', await token({}))

        expect(await getCurrentUser()).toEqual(user)
    })
})

describe('resolveAgentActor [TC-AISEC-015]', () => {
    it('answers 401 to a password-only token sent as a bearer header', async () => {
        // Arrange
        const req = new Request('http://app.test/api/agent/runs', { headers: { authorization: `JWT ${await token({})}` } })

        // Act
        const refused = await resolveAgentActor(req).catch((error: unknown) => error)

        // Assert
        expect(refused).toBeInstanceOf(AgentAccessError)
        expect((refused as AgentAccessError).status).toBe(401)
    })
})
