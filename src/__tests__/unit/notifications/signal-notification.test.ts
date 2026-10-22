import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── TC-F16.45: server-side Firebase doorbell writes (#1972) ──

const mockGetConfig = vi.fn()
const mockGetToken = vi.fn()
vi.mock('@/lib/firebase/firebase-admin-app', () => ({
    getFirebaseServerConfig: () => mockGetConfig(),
    getFirebaseAccessToken: () => mockGetToken(),
}))

import { signalNotificationUsers, signalNotificationBroadcast } from '@/lib/notifications/signal-notification'

const CFG = { databaseURL: 'https://example-rtdb.firebasedatabase.app' }
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VERCEL_TARGET_ENV', 'staging')
    mockGetConfig.mockReturnValue(CFG)
    mockGetToken.mockReturnValue(Promise.resolve('access-token'))
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('[TC-F16.45] signalNotificationUsers', () => {
    it('sends ONE PATCH for all users with a server timestamp and Bearer token', async () => {
        await signalNotificationUsers([1, 2, 3])

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(`${CFG.databaseURL}/pw2/staging/u.json`)
        expect(init.method).toBe('PATCH')
        expect(init.headers.authorization).toBe('Bearer access-token')
        expect(JSON.parse(init.body)).toEqual({
            '1': { at: { '.sv': 'timestamp' } },
            '2': { at: { '.sv': 'timestamp' } },
            '3': { at: { '.sv': 'timestamp' } },
        })
    })

    it('dedupes ids and drops invalid ones (NaN, negative, non-integer, zero)', async () => {
        await signalNotificationUsers([5, '5', 'abc', -1, 0, 1.5, 6])

        const body = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(Object.keys(body).sort()).toEqual(['5', '6'])
    })

    it('does nothing for an empty / fully-invalid list', async () => {
        await signalNotificationUsers([])
        await signalNotificationUsers(['x', -3])

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('is a silent no-op when Firebase is not configured', async () => {
        mockGetConfig.mockReturnValue(null)
        mockGetToken.mockReturnValue(null)

        await signalNotificationUsers([1])

        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('never throws when the RTDB request fails (network error)', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockRejectedValue(new Error('ECONNRESET'))

        await expect(signalNotificationUsers([1])).resolves.toBeUndefined()
        expect(errSpy).toHaveBeenCalled()
    })

    it('never throws when RTDB answers with an error status', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockResolvedValue(new Response('denied', { status: 401 }))

        await expect(signalNotificationUsers([1])).resolves.toBeUndefined()
        expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('401'))
    })

    it('gives up after 3s when the access token never resolves (must not stall push)', async () => {
        vi.useFakeTimers()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mockGetToken.mockReturnValue(new Promise(() => {}))

        const done = signalNotificationUsers([1])
        await vi.advanceTimersByTimeAsync(3_000)
        await done

        expect(fetchMock).not.toHaveBeenCalled()
        vi.useRealTimers()
    })

    it('never throws when getting the access token fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mockGetToken.mockReturnValue(Promise.reject(new Error('token boom')))

        await expect(signalNotificationUsers([1])).resolves.toBeUndefined()
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('[TC-F16.45] signalNotificationBroadcast', () => {
    it('PUTs a server timestamp to the broadcast node', async () => {
        await signalNotificationBroadcast()

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(`${CFG.databaseURL}/pw2/staging/broadcast.json`)
        expect(init.method).toBe('PUT')
        expect(JSON.parse(init.body)).toEqual({ at: { '.sv': 'timestamp' } })
    })

    it('never throws on failure', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        fetchMock.mockRejectedValue(new Error('down'))

        await expect(signalNotificationBroadcast()).resolves.toBeUndefined()
    })
})
