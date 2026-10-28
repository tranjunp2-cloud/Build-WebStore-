import { checkRateLimit } from '@/lib/rateLimit'
import { redis } from '@/lib/redis'

/** SUBMIT_LIMIT successful submits from one store within SUBMIT_WINDOW_MS block the store for BLOCK_SECONDS (10 min). */
export const SUBMIT_LIMIT = 5
export const SUBMIT_WINDOW_MS = 5 * 60_000
export const BLOCK_SECONDS = 10 * 60

const memoryBlocks = new Map<string, number>()

/** Feedback is limited per store (tenant); users without a tenant fall back to their own id. */
export const feedbackGuardKey = (tenantId: string | null, userId: string | number) =>
    tenantId ? `tenant:${tenantId}` : `user:${userId}`

const blockKey = (key: string) => `feedback:block:${key}`

/** Seconds left on the block, or null when the store may submit. */
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

async function blockStore(key: string): Promise<void> {
    memoryBlocks.set(key, Date.now() + BLOCK_SECONDS * 1000)
    if (!redis) return
    try {
        await redis.set(blockKey(key), '1', { ex: BLOCK_SECONDS })
    } catch {
        // The in-memory block above still applies on this instance.
    }
}

/**
 * Counts one *successful* submit for the store and blocks it once SUBMIT_LIMIT is reached, so the
 * next request is rejected. Failed attempts (bad input, Lark outage) never count against the store.
 */
export async function recordFeedbackSubmit(key: string): Promise<void> {
    const rate = await checkRateLimit(`feedback:submit:${key}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS)
    if (!rate.allowed || rate.remaining <= 0) await blockStore(key)
}

/** Test helper. */
export function clearFeedbackBlocks(): void {
    memoryBlocks.clear()
}
