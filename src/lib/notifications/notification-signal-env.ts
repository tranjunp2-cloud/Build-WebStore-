/**
 * Path/uid helpers for the Firebase RTDB notification "doorbell".
 * Data lives under `pw2/{env}/…` so one Firebase project can serve several
 * deployments (local, staging, production) without cross-talk.
 */

let warnedMissingTarget = false

/**
 * `VERCEL_TARGET_ENV` (staging | production | preview); `development` off Vercel.
 * On Vercel without it → null: the signal is disabled (fail-closed) rather than
 * sharing the `development` prefix across environments. Clients then poll.
 */
export function getNotificationSignalEnv(): string | null {
    const raw = (process.env.VERCEL_TARGET_ENV ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (raw) return raw
    if (process.env.VERCEL !== '1') return 'development'
    if (!warnedMissingTarget) {
        warnedMissingTarget = true
        console.error('[Signal] VERCEL_TARGET_ENV is not set at runtime; Firebase signal disabled')
    }
    return null
}

/** Callers gate on `getNotificationSignalEnv()` first, so null here is a bug. */
function requireEnv(): string {
    const env = getNotificationSignalEnv()
    if (!env) throw new Error('Notification signal env is not available')
    return env
}

/** Firebase Auth uid for a PW2 user. Must match `firebase/pw2-database-rules.json`. */
export function signalUid(userId: number | string): string {
    return `pw2_${requireEnv()}_${userId}`
}

export function userSignalPath(userId: number | string): string {
    return `pw2/${requireEnv()}/u/${userId}`
}

export function userSignalParentPath(): string {
    return `pw2/${requireEnv()}/u`
}

export function broadcastSignalPath(): string {
    return `pw2/${requireEnv()}/broadcast`
}
