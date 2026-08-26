/**
 * Shared Upstash Redis singleton.
 * Import this instead of instantiating Redis directly to avoid duplicate connections.
 */
import { Redis } from '@upstash/redis'

const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

export const redis = hasUpstash
    ? new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null
