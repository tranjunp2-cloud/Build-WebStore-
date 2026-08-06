// GH-1293: SSO step-sync fix — timeout, body-logging on failure, and
// persistStepEvent upsert (each user has at most 3 rows in sso_step_events).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    encryptPassword,
    sendSSOStepNotification,
    notifyStepComplete,
} from '@/lib/sso/sso-api-client'

process.env.SSO_API_BASE_URL = 'https://sso.test'
process.env.SSO_ENCRYPTION_KEY = 'a'.repeat(64)

// drizzle's `sql` tagged template returns an object whose queryChunks alternate
// between StringChunk wrappers ({ value: string[] }) and raw interpolated
// primitives — flatten it back to plain text so we can assert on query shape.
function sqlToText(sqlObj: any): string {
    return sqlObj.queryChunks
        .map((c: any) => (c && typeof c === 'object' && Array.isArray(c.value) ? c.value.join('') : String(c)))
        .join('')
}

function createMockPayload(opts: { completedCheckHasRow?: boolean; hasKeyString?: boolean } = {}) {
    const execute = vi.fn(async (sqlObj: any) => {
        const text = sqlToText(sqlObj)
        if (text.includes('SELECT 1 FROM sso_step_events')) {
            return { rows: opts.completedCheckHasRow ? [{ exists: 1 }] : [] }
        }
        return { rows: [] }
    })
    return {
        findByID: vi.fn().mockResolvedValue({
            email: 'user@test.com',
            keyString: opts.hasKeyString === false ? null : encryptPassword('test-password'),
        }),
        db: { drizzle: { execute } },
    } as any
}

describe('[TC-1293-SYNC] sso-api-client', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.spyOn(console, 'warn').mockImplementation(() => { })
        vi.spyOn(console, 'info').mockImplementation(() => { })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('[TC-1293-SYNC-01] fetchWithTimeout aborts at SSO_FETCH_TIMEOUT_MS (30s) — not sooner, not later', async () => {
        vi.useFakeTimers()
        vi.stubGlobal(
            'fetch',
            vi.fn(
                (_url: string, init: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        init.signal?.addEventListener('abort', () => {
                            reject(new DOMException('This operation was aborted', 'AbortError'))
                        })
                    }),
            ),
        )
        const payload = createMockPayload()

        const promise = sendSSOStepNotification(payload, 1, 1)
        let settled = false
        promise.catch(() => {
            settled = true
        })

        // Still pending just before the timeout — catches a regression to a shorter
        // timeout (e.g. back to the original 10s that caused Bug B).
        await vi.advanceTimersByTimeAsync(29_999)
        expect(settled).toBe(false)

        await vi.advanceTimersByTimeAsync(1)
        expect(settled).toBe(true)
        await expect(promise).rejects.toThrow(/aborted/i)
    })

    it('[TC-1293-SYNC-02] login failure includes the status but never the response body (request carries the real plaintext password — a Hub-side echo of it must never reach logs)', async () => {
        const textSpy = vi.fn(async () => 'hub boom, password: super-secret-123')
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 500, text: textSpy }),
        )
        const payload = createMockPayload()

        const err: Error = await sendSSOStepNotification(payload, 1, 2).catch((e) => e)

        expect(err.message).toContain('500')
        expect(err.message).not.toContain('hub boom')
        expect(err.message).not.toContain('super-secret-123')
        // Body must not even be read for the login-failure path — belt and suspenders.
        expect(textSpy).not.toHaveBeenCalled()
    })

    it('[TC-1293-SYNC-03] step-status PATCH failure includes status and response body, with our own bearer token redacted', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ status: 200, data: { access_token: 'tok123' } }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 422,
                text: async () => 'invalid step — request was: Authorization: Bearer tok123',
            })
        vi.stubGlobal('fetch', fetchMock)
        const payload = createMockPayload()

        const err: Error = await sendSSOStepNotification(payload, 1, 2).catch((e) => e)

        expect(err.message).toContain('422')
        expect(err.message).toContain('invalid step')
        // The response body itself is safe to surface (no password in this request),
        // but our own bearer token must never appear even if Hub's error echoes it back.
        expect(err.message).not.toContain('tok123')
        expect(err.message).toContain('[redacted]')
    })

    it('[TC-1293-SYNC-04] notifyStepComplete never throws and persists a pending row with the error text on failure', async () => {
        // PATCH failure (not login) — its response body is safe to surface since that
        // request never carries the user's password, unlike the login call.
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ status: 200, data: { access_token: 'tok123' } }),
            })
            .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'hub boom' })
        vi.stubGlobal('fetch', fetchMock)
        const payload = createMockPayload()

        await expect(notifyStepComplete(payload, 1, 2)).resolves.toBeUndefined()

        const insertCall = payload.db.drizzle.execute.mock.calls.find(([sqlObj]: any[]) =>
            sqlToText(sqlObj).includes('INSERT INTO sso_step_events'),
        )
        expect(insertCall).toBeDefined()
        const text = sqlToText(insertCall[0])
        expect(text).toContain('pending')
        expect(text).toContain('hub boom')
    })

    it('[TC-1293-SYNC-05] notifyStepComplete skips the SSO call entirely when the step is already completed', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const payload = createMockPayload({ completedCheckHasRow: true })

        await notifyStepComplete(payload, 1, 1)

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('[TC-1724-SYNC-04] missing keyString persists pending instead of false completed', async () => {
        const payload = createMockPayload({ hasKeyString: false })
        vi.stubGlobal('fetch', vi.fn())

        await expect(notifyStepComplete(payload, 1, 2)).resolves.toBeUndefined()

        const insertCall = payload.db.drizzle.execute.mock.calls.find(([sqlObj]: any[]) =>
            sqlToText(sqlObj).includes('INSERT INTO sso_step_events'),
        )
        expect(insertCall).toBeDefined()
        const text = sqlToText(insertCall[0])
        expect(text).toContain('pending')
        expect(text).not.toContain('completed')
    })

    it('[TC-1293-SYNC-06] a failing body read on an error response still throws a status-bearing error (no unhandled rejection)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                text: () => Promise.reject(new Error('stream closed')),
            }),
        )
        const payload = createMockPayload()

        const err: Error = await sendSSOStepNotification(payload, 1, 1).catch((e) => e)

        expect(err.message).toContain('503')
    })

    it('[TC-1293-SYNC-07] persistStepEvent upserts via ON CONFLICT (user_id, step) on every attempt, never a plain insert', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'x' }),
        )
        const payload = createMockPayload()

        // Call twice for the same (userId, step) — proves the code always goes
        // through the upsert, never a separate first-attempt-only insert branch.
        await notifyStepComplete(payload, 1, 2)
        await notifyStepComplete(payload, 1, 2)

        const insertCalls = payload.db.drizzle.execute.mock.calls.filter(([sqlObj]: any[]) =>
            sqlToText(sqlObj).includes('INSERT INTO sso_step_events'),
        )
        expect(insertCalls).toHaveLength(2)
        for (const call of insertCalls) {
            const text = sqlToText(call[0])
            expect(text).toContain('ON CONFLICT')
            expect(text).toContain('(user_id, step)')
        }
    })

    it('[TC-1293-SYNC-08] the upsert resets retry_count to 0 on both the insert default and the conflict-update path', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'x' }),
        )
        const payload = createMockPayload()

        await notifyStepComplete(payload, 1, 2)

        const insertCall = payload.db.drizzle.execute.mock.calls.find(([sqlObj]: any[]) =>
            sqlToText(sqlObj).includes('INSERT INTO sso_step_events'),
        )
        const text = sqlToText(insertCall[0])
        // DO UPDATE SET ... retry_count = 0
        expect(text).toContain('retry_count = 0')
        // VALUES (..., 0) default, right before ON CONFLICT
        expect(text).toMatch(/,\s*0\)\s*ON CONFLICT/)
    })
    it('[TC-1724-SYNC-06] PATCH body consumption is covered by the stage timeout', async () => {
        vi.useFakeTimers()
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ status: 200, data: { access_token: 'tok123' } }),
            })
            .mockImplementationOnce((_url: string, init: RequestInit) => ({
                ok: true,
                status: 200,
                text: () => new Promise((_resolve, reject) => {
                    init.signal?.addEventListener('abort', () =>
                        reject(new DOMException('This operation was aborted', 'AbortError')),
                    )
                }),
            }))
        vi.stubGlobal('fetch', fetchMock)
        const promise = sendSSOStepNotification(createMockPayload(), 1, 2, {
            loginTimeoutMs: 100,
            patchTimeoutMs: 100,
        })
        promise.catch(() => {})
        await vi.advanceTimersByTimeAsync(99)
        await vi.advanceTimersByTimeAsync(1)
        await expect(promise).rejects.toThrow(/aborted/i)
    })

    it('[TC-1724-SYNC-07] deadline caps each network stage by remaining budget', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
                init.signal?.addEventListener('abort', () =>
                    reject(new DOMException('This operation was aborted', 'AbortError')),
                )
            }),
        ))
        const promise = sendSSOStepNotification(createMockPayload(), 1, 2, {
            loginTimeoutMs: 20_000,
            patchTimeoutMs: 25_000,
            deadlineMs: Date.now() + 250,
        })
        promise.catch(() => {})
        await vi.advanceTimersByTimeAsync(250)
        await expect(promise).rejects.toThrow(/aborted/i)
    })
})
