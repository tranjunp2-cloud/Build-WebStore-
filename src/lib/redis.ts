/**
 * Shared Upstash Redis singleton.
 * Import this instead of instantiating Redis directly to avoid duplicate connections.
 *
 * Every command gets one retry (100 ms later) and a 1 s budget for both tries together: a slow Upstash must not hold
 * a request. Callers decide what a failure means (the rate limiter fails open to memory, or closed for outbound email;
 * the shared cache computes the value instead). Settings: src/lib/upstash-config.ts.
 */
import { Redis } from '@upstash/redis'
import { REDIS_RETRY, REDIS_TIMEOUT_MS } from './upstash-config'

const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

export const redis = hasUpstash
    ? new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
          retry: REDIS_RETRY,
          // a function: a fresh 1 s timeout per command (a plain signal would be spent after the first one)
          signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
      })
    : null
