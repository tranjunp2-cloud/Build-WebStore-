import crypto from 'crypto'
import type { BasePayload } from 'payload'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16
const SSO_FETCH_TIMEOUT_MS = 10_000 // 10s — SSO API should respond well within this

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
    if (!res.ok) throw new Error(`SSO login failed: ${res.status}`)
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
    await db.execute(sql`
        INSERT INTO sso_step_events (user_id, step, status, last_error)
        VALUES (${Number(userId)}, ${step}, ${status}, ${error ?? null})
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
        throw new Error(`step-status PATCH failed: ${res.status}`)
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
        persistStepEvent(payload, userId, step, 'completed').catch((e) =>
            console.error('[SSO Step] Failed to persist completed event:', e),
        )
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[SSO Step] notifyStepComplete failed for user ${userId} step ${step}:`, errMsg)
        persistStepEvent(payload, userId, step, 'pending', errMsg).catch((e) =>
            console.error('[SSO Step] Failed to persist step event:', e),
        )
    }
}
