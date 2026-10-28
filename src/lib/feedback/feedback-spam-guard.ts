import { checkRateLimit } from '@/lib/rateLimit'
import { redis } from '@/lib/redis'

/** PRD §10.4: at most SUBMIT_LIMIT feedbacks per user in a sliding SUBMIT_WINDOW_MS; the next one gets 429. */
export const SUBMIT_LIMIT = 5
export const SUBMIT_WINDOW_MS = 15 * 60_000

const memoryBlocks = new Map<string, number>()

/** Feedback is limited per user (`created_by`). */
export const feedbackGuardKey = (userId: string | number) => `user:${userId}`

const blockKey = (key: string) => `feedback:block:${key}`

/** Seconds until the user may submit again, or null when they may submit now. */
export async function getFeedbackBlockSeconds(key: string): Promise<number | null> {
    if (redis) {
        try {
            const ttl = await redis.ttl(blockKey(key))
            return ttl > 0 ? ttl : null
        } catch {
            // Redis down: fall through to the per-instance map.
        }
    }
    const until = memoryBlocks.get(key)
    if (!until || until <= Date.now()) return null
    return Math.ceil((until - Date.now()) / 1000)
}

async function blockUntil(key: string, resetAt: number): Promise<void> {
    const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
    memoryBlocks.set(key, Date.now() + seconds * 1000)
    if (!redis) return
    try {
        await redis.set(blockKey(key), '1', { ex: seconds })
    } catch {
        // The in-memory block above still applies on this instance.
    }
}

/**
 * Counts one *successful* new submit and blocks the user once SUBMIT_LIMIT is reached, until the
 * window frees up. Failed attempts (bad input, Lark outage) and idempotent replays never count.
 */
export async function recordFeedbackSubmit(key: string): Promise<void> {
    const rate = await checkRateLimit(`feedback:submit:${key}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS)
    if (!rate.allowed || rate.remaining <= 0) await blockUntil(key, rate.resetAt)
}

/** Test helper. */
export function clearFeedbackBlocks(): void {
    memoryBlocks.clear()
}
