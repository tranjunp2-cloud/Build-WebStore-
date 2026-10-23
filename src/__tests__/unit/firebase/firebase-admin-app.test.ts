import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── TC-F16.56: firebase-admin app config + access-token cache (#1972) ──

const mockGetAccessToken = vi.fn()
const mockInit = vi.fn()
const loaded = vi.hoisted(() => ({ adminApp: 0 }))
let apps: Array<{ name: string; options: unknown }> = []
vi.mock('firebase-admin/app', () => {
    loaded.adminApp++ // factory runs only when the module is actually imported
    return {
        getApps: () => apps,
        cert: (c: unknown) => c,
        initializeApp: (opts: { credential: unknown }, name: string) => {
            mockInit(opts, name)
            const app = { name, options: { credential: { getAccessToken: () => mockGetAccessToken() } } }
            apps.push(app)
            return app
        },
    }
})

const ENV = {
    FIREBASE_PROJECT_ID: 'proj', FIREBASE_CLIENT_EMAIL: 'x@proj.iam',
    FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n',
    FIREBASE_DATABASE_URL: 'https://proj-rtdb.firebasedatabase.app/', FIREBASE_WEB_API_KEY: 'AIzaX',
}

async function load() {
    vi.resetModules() // fresh module-level token cache each test
    return import('@/lib/firebase/firebase-admin-app')
}

beforeEach(() => {
    vi.clearAllMocks()
    apps = []
    loaded.adminApp = 0
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
    mockGetAccessToken.mockResolvedValue({ access_token: 'T1', expires_in: 3600 })
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
})

describe('[TC-F16.56] getFirebaseServerConfig', () => {
    it('normalises the private key (\\n → newline) and strips trailing slashes from the DB url', async () => {
        const { getFirebaseServerConfig } = await load()

        const cfg = getFirebaseServerConfig()!

        expect(cfg.privateKey).toContain('\n')
        expect(cfg.privateKey).not.toContain('\\n')
        expect(cfg.databaseURL).toBe('https://proj-rtdb.firebasedatabase.app')
    })

    it.each(Object.keys(ENV))('returns null when %s is missing (feature off)', async (key) => {
        vi.stubEnv(key, '')
        const { getFirebaseServerConfig, getFirebaseAdminApp, getFirebaseAccessToken } = await load()

        expect(getFirebaseServerConfig()).toBeNull()
        expect(await getFirebaseAdminApp()).toBeNull()
        expect(getFirebaseAccessToken()).toBeNull()
    })

    it('never loads firebase-admin while Firebase is off (Payload routes import this module)', async () => {
        vi.stubEnv('FIREBASE_PROJECT_ID', '')
        const { getFirebaseAdminApp, getFirebaseAccessToken } = await load()

        await getFirebaseAdminApp()
        getFirebaseAccessToken()

        expect(loaded.adminApp).toBe(0)
    })
})

describe('[TC-F16.56] getFirebaseAdminApp', () => {
    it('creates one named app and reuses it', async () => {
        const { getFirebaseAdminApp } = await load()

        const a = await getFirebaseAdminApp()
        const b = await getFirebaseAdminApp()

        expect(a).toBe(b)
        expect(mockInit).toHaveBeenCalledTimes(1)
        expect(mockInit.mock.calls[0][1]).toBe('pw2-notif')
    })
})

describe('[TC-F16.56] getFirebaseAccessToken cache', () => {
    it('concurrent callers share ONE token request', async () => {
        const { getFirebaseAccessToken } = await load()

        const [a, b, c] = await Promise.all([getFirebaseAccessToken()!, getFirebaseAccessToken()!, getFirebaseAccessToken()!])

        expect([a, b, c]).toEqual(['T1', 'T1', 'T1'])
        expect(mockGetAccessToken).toHaveBeenCalledTimes(1)
    })

    it('reuses the token until ~60s before expiry, then refreshes', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-21T10:00:00Z'))
        const { getFirebaseAccessToken } = await load()
        await getFirebaseAccessToken()

        vi.setSystemTime(new Date('2026-10-21T10:50:00Z')) // 50 min: still valid
        await getFirebaseAccessToken()
        expect(mockGetAccessToken).toHaveBeenCalledTimes(1)

        mockGetAccessToken.mockResolvedValue({ access_token: 'T2', expires_in: 3600 })
        vi.setSystemTime(new Date('2026-10-21T10:59:30Z')) // inside the 60s safety margin
        expect(await getFirebaseAccessToken()).toBe('T2')
        expect(mockGetAccessToken).toHaveBeenCalledTimes(2)
    })

    it('a failed request is not cached — the next call retries', async () => {
        mockGetAccessToken.mockRejectedValueOnce(new Error('oauth down'))
        const { getFirebaseAccessToken } = await load()

        await expect(getFirebaseAccessToken()!).rejects.toThrow('oauth down')
        await new Promise((r) => setTimeout(r, 0)) // let the cache-clearing catch run
        const token = await getFirebaseAccessToken()!

        expect(token).toBe('T1')
        expect(mockGetAccessToken).toHaveBeenCalledTimes(2)
    })
})
