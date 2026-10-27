import { checkRateLimit } from '@/lib/rateLimit'
import { redis } from '@/lib/redis'

/** More than SUBMIT_LIMIT submits from one store within SUBMIT_WINDOW_MS blocks the store for BLOCK_SECONDS (10 min). */
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
 * Counts one submit for the store. Returns the seconds the store is blocked for
 * (already blocked, or this submit tripped the limit), or null when the submit is allowed.
 */
export async function registerFeedbackSubmit(key: string): Promise<number | null> {
    const existing = await getFeedbackBlockSeconds(key)
    if (existing) return existing

    const rate = await checkRateLimit(`feedback:submit:${key}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS)
    if (rate.allowed) return null

    await blockStore(key)
    return BLOCK_SECONDS
}

/** Test helper. */
export function clearFeedbackBlocks(): void {
    memoryBlocks.clear()
}
