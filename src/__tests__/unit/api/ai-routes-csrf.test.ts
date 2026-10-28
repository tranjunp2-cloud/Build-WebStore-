/**
 * TC-AISEC-112 — every legacy POST /api/ai/* route refuses cross-origin requests.
 *
 * Each route module is imported for real (real withAuth / validateCsrf). A cross-origin POST
 * must get 403 {error:'CSRF verification failed.'} before the session is read or any route
 * work starts; a same-origin or header-less POST must get past the check (then fails auth,
 * since no session cookie is set here).
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCookies = vi.fn()
vi.mock('next/headers', () => ({ cookies: (...args: unknown[]) => mockCookies(...args) }))
const mockGetPayload = vi.fn()
vi.mock('payload', async (importOriginal) => ({
    ...(await importOriginal<typeof import('payload')>()),
    getPayload: (...args: unknown[]) => mockGetPayload(...args),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const AI_ROUTES = [
    'apply-template',
    'blog-seo',
    'extract-from-url',
    'generate-blog',
    'generate-site',
    'product-description',
    'products-bulk-parse',
    'rewrite-text',
    'seo-generate',
    'translate',
] as const

type PostHandler = (req: Request, ctx?: unknown) => Promise<Response>

async function loadPost(route: string): Promise<PostHandler> {
    const mod = await import(`@/app/api/ai/${route}/route.ts`)
    return mod.POST as PostHandler
}

async function postTo(route: string, headers: Record<string, string>): Promise<Response> {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest(`https://app.test/api/ai/${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({}),
    })
    return (await loadPost(route))(req, { params: Promise.resolve({}) })
}

describe('TC-AISEC-112 — /api/ai/* same-origin check', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCookies.mockResolvedValue({ get: () => undefined })
        mockGetPayload.mockRejectedValue(new Error('payload must not be reached in this test'))
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('TC-AISEC-112 — the route list covers every route under src/app/api/ai', () => {
        const dir = join(process.cwd(), 'src/app/api/ai')
        const onDisk = readdirSync(dir)
            .filter((name) => statSync(join(dir, name)).isDirectory())
            .sort()

        expect(onDisk).toEqual([...AI_ROUTES].sort())
    })

    it.each(AI_ROUTES)('TC-AISEC-112 — %s: cross-origin POST → 403 before the session is read', async (route) => {
        // Act
        const res = await postTo(route, { host: 'app.test', origin: 'https://evil.test' })

        // Assert
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: 'CSRF verification failed.' })
        expect(mockCookies).not.toHaveBeenCalled()
        expect(mockGetPayload).not.toHaveBeenCalled()
    }, 30_000)

    it.each(AI_ROUTES)('TC-AISEC-112 — %s: same-origin POST passes the check', async (route) => {
        const res = await postTo(route, { host: 'app.test', origin: 'https://app.test' })

        expect(res.status).not.toBe(403)
    }, 30_000)

    it('TC-AISEC-112 — header-less (server-to-server) POST passes the check', async () => {
        const res = await postTo('generate-blog', { host: 'app.test' })

        expect(res.status).toBe(401)
    })
})
