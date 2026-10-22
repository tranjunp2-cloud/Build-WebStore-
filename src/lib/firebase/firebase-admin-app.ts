import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'

const APP_NAME = 'pw2-notif'

export interface FirebaseServerConfig {
    projectId: string
    clientEmail: string
    privateKey: string
    databaseURL: string
    webApiKey: string
}

/** Reads the 5 server-only env vars. Returns null when Firebase is not configured. */
export function getFirebaseServerConfig(): FirebaseServerConfig | null {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
    const databaseURL = process.env.FIREBASE_DATABASE_URL
    const webApiKey = process.env.FIREBASE_WEB_API_KEY
    if (!projectId || !clientEmail || !privateKey || !databaseURL || !webApiKey) return null
    return {
        projectId,
        clientEmail,
        // Vercel stores the key with literal "\n" sequences.
        privateKey: privateKey.replace(/\\n/g, '\n'),
        databaseURL: databaseURL.replace(/\/+$/, ''),
        webApiKey,
    }
}

/** Singleton admin app dedicated to notifications. Null when not configured / invalid. */
export function getFirebaseAdminApp(): App | null {
    const existing = getApps().find((a) => a.name === APP_NAME)
    if (existing) return existing
    const cfg = getFirebaseServerConfig()
    if (!cfg) return null
    try {
        return initializeApp(
            {
                credential: cert({
                    projectId: cfg.projectId,
                    clientEmail: cfg.clientEmail,
                    privateKey: cfg.privateKey,
                }),
                databaseURL: cfg.databaseURL,
            },
            APP_NAME,
        )
    } catch (err) {
        console.error('[Signal] Firebase admin init failed:', err instanceof Error ? err.message : 'unknown')
        return null
    }
}

let tokenCache: { promise: Promise<string>; expiresAt: number } | null = null

/** OAuth access token for RTDB REST calls. Caches the promise so concurrent callers share one fetch. */
export function getFirebaseAccessToken(): Promise<string> | null {
    const app = getFirebaseAdminApp()
    const credential = app?.options.credential
    if (!credential) return null
    const now = Date.now()
    if (tokenCache && tokenCache.expiresAt > now) return tokenCache.promise
    const promise = credential.getAccessToken().then((t) => {
        // Refresh 60s before Google's expiry.
        if (tokenCache?.promise === promise) tokenCache.expiresAt = t.expires_in * 1000 + Date.now() - 60_000
        return t.access_token
    })
    // Provisional expiry until the token resolves; failure clears the cache.
    tokenCache = { promise, expiresAt: now + 30_000 }
    promise.catch(() => {
        if (tokenCache?.promise === promise) tokenCache = null
    })
    return promise
}
