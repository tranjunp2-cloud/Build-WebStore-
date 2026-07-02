import crypto from 'crypto'
import type { BasePayload } from 'payload'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16
// 30s — shipping-config/route.ts has the tightest maxDuration (60s). Two sequential
// fetchWithTimeout calls (login + PATCH) worst-case to 60s of fetch time alone; after()
// shares that same maxDuration budget with the handler work done before it (payload
// reads/writes), so real headroom is a bit under 60s. In the rare case both calls hang
// their full 30s, Vercel can kill the invocation before the catch branch's
// persistStepEvent('pending', ...) runs — no retry-queue row gets written for that
// attempt (worse than "delayed retry": no row exists for the cron to find). Accepted:
// low-likelihood (both calls would need to hang simultaneously) and no worse than any
// other single failed attempt from the user's perspective (still requires a manual retry).
const SSO_FETCH_TIMEOUT_MS = 30_000

function getEncryptionKey(): Buffer {
    const key = process.env.SSO_ENCRYPTION_KEY
    if (!key) throw new Error('SSO_ENCRYPTION_KEY env var missing')
    if (key.length !== 64) throw new Error(`SSO_ENCRYPTION_KEY must be 64 hex chars (32 bytes), got ${key.length}`)
    return Buffer.from(key, 'hex')
}

export function encryptPassword(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPassword(ciphertext: string): string {
    const [ivHex, encHex] = ciphertext.split(':')
    if (!ivHex || !encHex) throw new Error('Invalid keyString format')
    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SSO_FETCH_TIMEOUT_MS)
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

async function getSSOToken(email: string, keyString: string): Promise<string> {
    const password = decryptPassword(keyString)
    const base = (process.env.SSO_API_BASE_URL ?? '').replace(/\/$/, '')
    if (!base) throw new Error('SSO_API_BASE_URL env var not configured')
    const res = await fetchWithTimeout(`${base}/api/v1/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // SSO API: `username` field maps to email; `is_system: 1` bypasses MFA OTP check
        body: JSON.stringify({ username: email, password, is_system: 1 }),
    })
    if (!res.ok) {
        // Never log the response body here — this request's own body carries the
        // user's real plaintext password, and a Hub-side error page (e.g. a debug-mode
        // stack trace) could echo the submitted payload back, leaking it into our logs.
        // Still drain (never read into a variable) so the connection can return to
        // undici's keep-alive pool instead of waiting on GC/timeout.
        await res.body?.cancel().catch(() => {})
        throw new Error(`SSO login failed: ${res.status}`)
    }
    const body = await res.json()
    // SSO API returns HTTP 200 for all responses; check envelope status for real errors
    if (body?.status && body.status !== 200) {
        throw new Error(`SSO login failed: ${body.status} — ${body.message ?? 'unknown'}`)
    }
    // Token is nested inside data envelope: { status, message, data: { access_token } }
    const token = body?.data?.access_token ?? body?.data?.token ?? body?.access_token ?? body?.token
    if (!token) throw new Error('SSO login: no access_token in response')
    return token as string
}

async function persistStepEvent(
    payload: BasePayload,
    userId: number | string,
    step: 1 | 2 | 3,
    status: 'completed' | 'pending',
    error?: string,
): Promise<void> {
    const db = (payload.db as any)?.drizzle
    if (!db) return
    const { sql } = await import('drizzle-orm')
    // ON CONFLICT (user_id, step): each user has exactly 3 rows in this table (one per
    // step) — a retry updates its existing row instead of accumulating duplicates.
    // retry_count always resets to 0 here: this upsert only fires from a fresh
    // user-triggered attempt, a distinct cycle from the cron's own retry bookkeeping.
    await db.execute(sql`
        INSERT INTO sso_step_events (user_id, step, status, last_error, retry_count)
        VALUES (${Number(userId)}, ${step}, ${status}, ${error ?? null}, 0)
        ON CONFLICT (user_id, step)
        DO UPDATE SET status = EXCLUDED.status, last_error = EXCLUDED.last_error, retry_count = 0, updated_at = now()
    `)
}

/**
 * Core SSO step notification — throws on any failure.
 * Called by the retry cron (which manages its own retry/failure state).
 * Also the inner implementation for notifyStepComplete.
 */
export async function sendSSOStepNotification(
    payload: BasePayload,
    userId: number | string,
    step: 1 | 2 | 3,
): Promise<void> {
    // overrideAccess:true required — keyString has access:{read:()=>false} which Local API
    // enforces unless bypassed. Same pattern as xenditSecretKey reads elsewhere.
    const user = await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
        overrideAccess: true,
    })

    if (!user?.keyString) {
        // User provisioned before keyString was introduced — skip silently
        console.warn(`[SSO Step] User ${userId} has no keyString — step ${step} not notified`)
        return
    }

    const token = await getSSOToken(user.email as string, user.keyString as string)

    const base = (process.env.SSO_API_BASE_URL ?? '').replace(/\/$/, '')
    const res = await fetchWithTimeout(`${base}/api/v1/product/8/step-status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [`step${step}_status`]: 1 }),
    })

    if (!res.ok) {
        const bodyText = await res.text().catch(() => '')
        // Redact our own bearer token in case Hub's error response ever echoes request
        // context/headers back (same class of risk as the login call above) — unlike
        // that call, this request body carries no secret, only the Authorization header
        // does, so the response body itself is still safe and useful to surface.
        const safeBodyText = bodyText.split(token).join('[redacted]')
        throw new Error(`step-status PATCH failed: ${res.status} — ${safeBodyText.slice(0, 500)}`)
    }
    console.info(`[SSO Step] step${step}_status=1 sent for user ${userId}`)
}

/**
 * Fire-and-forget wrapper for use in onboarding step triggers.
 * On failure: logs the error and persists a retry event to sso_step_events.
 * Never throws — callers do not need to handle errors.
 *
 * @param payload - Payload instance (for DB access on failure)
 * @param userId  - PWv2 user ID
 * @param step    - 1 (Pick Template) | 2 (Setup Shipping) | 3 (Add Product)
 */
export async function notifyStepComplete(
    payload: BasePayload,
    userId: number | string,
    step: 1 | 2 | 3,
): Promise<void> {
    // Guard: skip if already completed — prevents duplicate SSO calls on repeat actions
    try {
        const db = (payload.db as any)?.drizzle
        if (db) {
            const { sql } = await import('drizzle-orm')
            const existing = await db.execute(
                sql`SELECT 1 FROM sso_step_events WHERE user_id = ${Number(userId)} AND step = ${step} AND status = 'completed' LIMIT 1`,
            )
            if (existing.rows?.length > 0) {
                console.info(`[SSO Step] step${step} already completed for user ${userId} — skipping`)
                return
            }
        }
    } catch (checkErr) {
        // Fail-open: if check errors, proceed with notification
        console.warn(`[SSO Step] completed-check failed for user ${userId} step ${step}:`, checkErr)
    }

    try {
        await sendSSOStepNotification(payload, userId, step)
        // Awaited so callers wrapping notifyStepComplete in after() (or similar
        // keep-alive mechanisms) actually cover this write, not just the network call.
        await persistStepEvent(payload, userId, step, 'completed').catch((e) =>
            console.error('[SSO Step] Failed to persist completed event:', e),
        )
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[SSO Step] notifyStepComplete failed for user ${userId} step ${step}:`, errMsg)
        await persistStepEvent(payload, userId, step, 'pending', errMsg).catch((e) =>
            console.error('[SSO Step] Failed to persist step event:', e),
        )
    }
}
