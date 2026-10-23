/**
 * Browser-side Firebase for the notification "doorbell" (F16, #1972).
 * Everything is dynamically imported so Firebase never lands in the first-load bundle.
 * Auth uses in-memory persistence: a full page load always starts signed out, so
 * switching users in one browser can never inherit the previous user's session.
 */
import type { Auth } from 'firebase/auth'
import type { Database } from 'firebase/database'

export interface FirebaseWebConfig {
    apiKey: string
    databaseURL: string
    projectId: string
}

export interface FirebaseClient {
    auth: Auth
    db: Database
}

const APP_NAME = 'pw2-notif'

/** Initialise (or reuse) the app, sign in with the server-issued custom token. */
export async function connectFirebaseClient(config: FirebaseWebConfig, customToken: string): Promise<FirebaseClient> {
    const [{ getApps, getApp, initializeApp }, authMod, { getDatabase }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/database'),
    ])
    const app = getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(config, APP_NAME)
    let auth: Auth
    try {
        auth = authMod.initializeAuth(app, { persistence: authMod.inMemoryPersistence })
    } catch {
        // Already initialised (HMR / React StrictMode double mount)
        auth = authMod.getAuth(app)
    }
    await authMod.signInWithCustomToken(auth, customToken)
    return { auth, db: getDatabase(app) }
}
