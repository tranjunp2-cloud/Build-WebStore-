/**
 * AI usage logger — fire-and-forget helper that writes a row to the
 * `ai-usage-logs` Payload collection after every OpenAI API call.
 *
 * Usage:
 *   const start = Date.now()
 *   try {
 *     const completion = await openai.chat.completions.create({...})
 *     logAiUsage({
 *       endpoint: 'site-generation',
 *       model: completion.model,
 *       tokensIn: completion.usage?.prompt_tokens ?? 0,
 *       tokensOut: completion.usage?.completion_tokens ?? 0,
 *       durationMs: Date.now() - start,
 *       success: true,
 *       userId, tenantId,
 *     })
 *   } catch (err) {
 *     logAiUsage({ ..., success: false, errorCode: err.code })
 *     throw err
 *   }
 *
 * CRITICAL: never await this. It catches its own errors. A failed log must
 * not block or break the AI request that triggered it.
 *
 * Source: plans/260414-0914-ai-model-optimization/phase-05-gateway-observability.md
 */

import type { AITask } from './config'

// Per-1M-token pricing used to estimate cost. Sourced from
// plans/260414-0914-ai-model-optimization/research/researcher-01-openai-models-2026.md
// Updated whenever we add a new model to config.ts.
const PRICING_PER_1M: Record<string, { input: number; output: number }> = {
    'gpt-4o':           { input: 2.50, output: 10.00 },
    'gpt-4o-mini':      { input: 0.15, output: 0.60 },
    'gpt-4.1':          { input: 2.00, output: 8.00 },
    'gpt-4.1-mini':     { input: 0.20, output: 0.80 },
    'gpt-4.1-nano':     { input: 0.05, output: 0.20 },
    'gpt-5.4-mini':     { input: 0.75, output: 4.50 },
}

/**
 * Estimate cost in USD from model name + token counts.
 * Strips date suffixes (e.g. "gpt-4.1-mini-2025-04-14" → "gpt-4.1-mini").
 * Returns 0 for unknown models (so the log row is still written).
 */
export function estimateCostUsd(modelRaw: string, tokensIn: number, tokensOut: number): number {
    if (!modelRaw) return 0
    // Normalize by stripping date suffix
    const stripped = modelRaw.replace(/-\d{4}-\d{2}-\d{2}$/, '')
    const price = PRICING_PER_1M[stripped] ?? PRICING_PER_1M[modelRaw]
    if (!price) return 0
    return (tokensIn * price.input + tokensOut * price.output) / 1_000_000
}

export type LogAiUsageInput = {
    endpoint: AITask
    model: string
    tokensIn: number
    tokensOut: number
    durationMs: number
    success: boolean
    /** Payload user id — accepts string (UUID) or number (serial) */
    userId?: number | string | null
    /** Payload tenant id — accepts string (UUID) or number (serial) */
    tenantId?: number | string | null
    errorCode?: string | null
}

/**
 * Fire-and-forget log write. Caller must NOT await — returns a Promise<void>
 * that catches its own errors and resolves undefined.
 */
export function logAiUsage(input: LogAiUsageInput): void {
    void (async () => {
        try {
            // Dynamic import to avoid pulling Payload into cold-start bundle of
            // every route that calls AI. Payload is heavy — only load when we
            // actually have a log row to write.
            const { getPayload } = await import('payload')
            const configPromise = (await import('@/payload.config')).default
            const payload = await getPayload({ config: configPromise })

            const costUsd = estimateCostUsd(input.model, input.tokensIn, input.tokensOut)

            await payload.create({
                collection: 'ai-usage-logs',
                data: {
                    user: input.userId ?? undefined,
                    tenant: input.tenantId ?? undefined,
                    endpoint: input.endpoint,
                    model: input.model,
                    tokensIn: input.tokensIn,
                    tokensOut: input.tokensOut,
                    costUsd,
                    durationMs: input.durationMs,
                    success: input.success,
                    errorCode: input.errorCode ?? undefined,
                },
            })
        } catch (err) {
            // Never throw — logging is best-effort observability, not a critical path.
            console.warn('[logAiUsage] write failed:', err instanceof Error ? err.message : String(err))
        }
    })()
}
