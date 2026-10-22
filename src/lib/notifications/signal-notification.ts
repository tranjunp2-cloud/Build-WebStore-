import { getFirebaseAccessToken, getFirebaseServerConfig } from '@/lib/firebase/firebase-admin-app'
import { broadcastSignalPath, userSignalParentPath } from './notification-signal-env'

const TIMEOUT_MS = 3000
// RTDB server-side timestamp placeholder.
const NOW = { '.sv': 'timestamp' }

/** Reject if `p` does not settle in time (a hung OAuth call must not stall push). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), ms)
        p.then(
            (v) => { clearTimeout(timer); resolve(v) },
            (e) => { clearTimeout(timer); reject(e) },
        )
    })
}

async function write(method: 'PATCH' | 'PUT', path: string, body: unknown): Promise<void> {
    const cfg = getFirebaseServerConfig()
    const tokenPromise = getFirebaseAccessToken()
    if (!cfg || !tokenPromise) return
    try {
        const token = await withTimeout(tokenPromise, TIMEOUT_MS)
        const res = await fetch(`${cfg.databaseURL}/${path}.json`, {
            method,
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!res.ok) console.error(`[Signal] RTDB ${method} ${path} -> ${res.status}`)
    } catch (err) {
        console.error('[Signal] RTDB write failed:', err instanceof Error ? err.message : 'unknown')
    }
}

/**
 * Ring the doorbell for the given users with ONE request. Never throws:
 * a Firebase outage must not fail notification creation (clients fall back to
 * fetch-on-focus / fallback polling).
 */
export async function signalNotificationUsers(userIds: Array<number | string>): Promise<void> {
    const ids = [...new Set(userIds.map(Number))].filter((n) => Number.isInteger(n) && n > 0)
    if (ids.length === 0) return
    const body: Record<string, { at: typeof NOW }> = {}
    for (const id of ids) body[String(id)] = { at: NOW }
    await write('PATCH', userSignalParentPath(), body)
}

/** Ring the shared broadcast doorbell. Never throws. */
export async function signalNotificationBroadcast(): Promise<void> {
    await write('PUT', broadcastSignalPath(), { at: NOW })
}
