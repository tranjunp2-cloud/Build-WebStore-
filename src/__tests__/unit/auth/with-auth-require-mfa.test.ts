/**
 * TC-AICP-354 — withAuth({ requireMfa: true }) answers 401 to a session that never passed the OTP step (Payload's
 * password-only login token) and lets the same session through once it carries `mfa_verified`; without the option
 * nothing changes for the routes that used it before.
 * TC-AICP-355 — every POST /api/ai/* route spends AI quota only for an OTP-verified session: the withAuth routes pass
 * `requireMfa: true` (a real route answers 401 before its handler runs) and generate-site reads the user with
 * `getCurrentUser(req, { requireMfa: true })`.
 * Real: lib/auth.ts (withAuth, getCurrentUser), jose (tokens built here), the rewrite-text route.
 * Faked: Payload (auth verifies the signature), the cookie store, the AI task runner (must not be reached).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieValues = new Map<string, string>()
vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({ get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined) })),
}))
const { auth, runAiTaskForUser } = vi.hoisted(() => ({ auth: vi.fn(), runAiTaskForUser: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ auth, findByID: vi.fn() })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai-platform/ai-tasks', () => ({ runAiTaskForUser, resolveSiteBillingTenant: vi.fn(), describeAiTaskFailure: vi.fn() }))

import { withAuth } from '@/lib/auth'
import { POST as rewriteText } from '@/app/api/ai/rewrite-text/route'

const user = { id: 3, email: 'owner@shop.my', tenants: [] }
const key = new TextEncoder().encode('test-secret-test-secret-test-secret')
const token = (claims: Record<string, unknown>) =>
    new SignJWT({ id: 3, collection: 'users', ...claims }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(key)
const handler = vi.fn(async () => NextResponse.json({ ok: true }))
const call = (route: (req: Request, ctx: never) => Promise<NextResponse>) => route(new Request('http://app.test/api/x', { method: 'POST' }), undefined as never)

beforeEach(() => {
    vi.clearAllMocks()
    cookieValues.clear()
    auth.mockResolvedValue({ user })
})

describe('withAuth requireMfa [TC-AICP-354]', () => {
    it('[TC-AICP-354] refuses a password-only session with 401 and never runs the handler', async () => {
        // Arrange
        cookieValues.set('payload-token', await token({}))

        // Act
        const res = await call(withAuth(handler, { requireMfa: true }))

        // Assert
        expect(res.status).toBe(401)
        expect(handler).not.toHaveBeenCalled()
    })

    it('[TC-AICP-354] lets the same session through once it passed the OTP step', async () => {
        // Arrange
        cookieValues.set('payload-token', await token({ mfa_verified: true }))

        // Act
        const res = await call(withAuth(handler, { requireMfa: true }))

        // Assert
        expect(res.status).toBe(200)
        expect(handler).toHaveBeenCalledWith(user, expect.any(Request), undefined)
    })

    it('[TC-AICP-354] without the option a password-only session still passes (unchanged for other routes)', async () => {
        // Arrange
        cookieValues.set('payload-token', await token({}))

        // Act
        const res = await call(withAuth(handler))

        // Assert
        expect(res.status).toBe(200)
    })
})

describe('/api/ai/* need an OTP-verified session [TC-AICP-355]', () => {
    it('[TC-AICP-355] rewrite-text answers 401 to a password-only bearer token and runs no AI task', async () => {
        // Arrange
        const req = new Request('http://app.test/api/ai/rewrite-text', {
            method: 'POST',
            headers: { authorization: `JWT ${await token({})}`, 'content-type': 'application/json' },
            body: JSON.stringify({ text: 'Hello', instruction: 'shorter' }),
        })

        // Act
        const res = await rewriteText(req, undefined as never)

        // Assert
        expect(res.status).toBe(401)
        expect(runAiTaskForUser).not.toHaveBeenCalled()
    })

    const AI_ROUTES = ['apply-template', 'blog-seo', 'extract-from-url', 'generate-blog', 'product-description', 'products-bulk-parse', 'rewrite-text', 'seo-generate', 'translate']
    it.each(AI_ROUTES)('[TC-AICP-355] %s wraps its POST with withAuth(..., { csrf: true, requireMfa: true })', (route) => {
        // Arrange
        const source = readFileSync(join(process.cwd(), 'src/app/api/ai', route, 'route.ts'), 'utf8')

        // Act
        const wrapped = source.match(/export const POST = withAuth\(/g) ?? []

        // Assert
        expect(wrapped).toHaveLength(1)
        expect(source).toContain('}, { csrf: true, requireMfa: true })')
    })

    it('[TC-AICP-355] generate-site reads the user with requireMfa', () => {
        // Arrange
        const source = readFileSync(join(process.cwd(), 'src/app/api/ai/generate-site/route.ts'), 'utf8')

        // Act
        const reads = source.match(/getCurrentUser\(req[^)]*\)/g) ?? []

        // Assert
        expect(reads.length).toBeGreaterThan(0)
        expect(reads.every((read) => read.includes('requireMfa: true'))).toBe(true)
    })
})
