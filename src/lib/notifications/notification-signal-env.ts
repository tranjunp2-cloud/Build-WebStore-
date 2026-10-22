/**
 * Path/uid helpers for the Firebase RTDB notification "doorbell".
 * Data lives under `pw2/{env}/…` so one Firebase project can serve several
 * deployments (local, staging, production) without cross-talk.
 */

let warnedMissingTarget = false

/** `VERCEL_TARGET_ENV` (staging | production | preview); `development` when unset. */
export function getNotificationSignalEnv(): string {
    const raw = (process.env.VERCEL_TARGET_ENV ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (raw) return raw
    if (process.env.VERCEL === '1' && !warnedMissingTarget) {
        warnedMissingTarget = true
        console.warn('[Signal] VERCEL_TARGET_ENV is not set at runtime; using "development" prefix')
    }
    return 'development'
}

/** Firebase Auth uid for a PW2 user. Must match `firebase/pw2-database-rules.json`. */
export function signalUid(userId: number | string): string {
    return `pw2_${getNotificationSignalEnv()}_${userId}`
}

export function userSignalPath(userId: number | string): string {
    return `pw2/${getNotificationSignalEnv()}/u/${userId}`
}

export function userSignalParentPath(): string {
    return `pw2/${getNotificationSignalEnv()}/u`
}

export function broadcastSignalPath(): string {
    return `pw2/${getNotificationSignalEnv()}/broadcast`
}
