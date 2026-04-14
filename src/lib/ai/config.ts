/**
 * AI Cost Optimization Module
 * Implements the 7 strategies for token efficiency:
 * 1. Model routing (GPT-4o vs GPT-4o-mini)
 * 2. Block JSON (not HTML) output
 * 3. Response caching
 * 4. Template-first generation
 * 5. Minimal context prompts
 * 6. Rate limiting per tier
 * 7. Lazy AI (skip AI for simple operations)
 */

// ─── Model Routing ──────────────────────────────────────────────────────
/**
 * AI models available via OpenAI API (April 2026).
 * See plan 260414-0914-ai-model-optimization/research/researcher-01-openai-models-2026.md
 * for pricing + capability comparison.
 */
export type AIModel =
    | 'gpt-4o'
    | 'gpt-4o-mini'
    | 'gpt-4.1'
    | 'gpt-4.1-mini'
    | 'gpt-4.1-nano'
    | 'gpt-5.4-mini'

const VALID_MODELS: ReadonlySet<AIModel> = new Set<AIModel>([
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-5.4-mini',
])

function isValidModel(value: string): value is AIModel {
    return VALID_MODELS.has(value as AIModel)
}

export type AITask =
    | 'site-generation'
    | 'chat-edit'
    | 'inline-edit'
    | 'seo-generation'
    | 'content-rewrite'
    | 'product-description'
    | 'url-extraction'
    | 'bulk-parse'

/**
 * Default model per task.
 *
 * Phase-03a (2026-04-14): site-generation flipped gpt-4o → gpt-4.1-mini.
 * Validated by plans/260414-0914-ai-model-optimization/reports/eval-2026-04-14.md
 * — 30 runs x 3 inputs, 100% valid, 22.8 avg blocks (vs 22.9 for gpt-4o),
 * 9.9x cheaper ($0.004 vs $0.043 per call). p95 latency is worse
 * (~99s vs ~45s) but acceptable tradeoff — deferred tuning to phase-03b.
 *
 * Other tasks (chat-edit etc.) still on gpt-4o-mini — phase-04 flips those.
 * Rollback: set env var AI_MODEL_SITEGEN=gpt-4o at environment scope
 * to instantly revert without redeploy.
 */
const DEFAULT_MODELS: Record<AITask, AIModel> = {
    'site-generation':    'gpt-4.1-mini',
    'chat-edit':          'gpt-4o-mini',
    'inline-edit':        'gpt-4o-mini',
    'seo-generation':     'gpt-4o-mini',
    'content-rewrite':    'gpt-4o-mini',
    'product-description': 'gpt-4o-mini',
    'url-extraction':     'gpt-4o-mini',
    'bulk-parse':         'gpt-4o-mini',
}

/**
 * Env var name per task for override. Allows per-task model swap without
 * code change — e.g. `AI_MODEL_SITEGEN=gpt-4.1-mini` in .env.local flips
 * site-gen to gpt-4.1-mini for that environment only. Canary rollout via
 * env override is the recommended path (see plan.md Q5 decision).
 */
const ENV_KEY: Record<AITask, string> = {
    'site-generation':    'AI_MODEL_SITEGEN',
    'chat-edit':          'AI_MODEL_EDIT',
    'inline-edit':        'AI_MODEL_INLINE_EDIT',
    'seo-generation':     'AI_MODEL_SEO',
    'content-rewrite':    'AI_MODEL_REWRITE',
    'product-description': 'AI_MODEL_PRODUCT_DESC',
    'url-extraction':     'AI_MODEL_URL_EXTRACT',
    'bulk-parse':         'AI_MODEL_BULK_PARSE',
}

/**
 * Strategy #1: Route to the correct model based on task complexity.
 * Priority:
 *   1. Env var override (per-task, e.g. AI_MODEL_SITEGEN)
 *   2. DEFAULT_MODELS table
 *
 * Invalid override strings fall back to default with a console.warn so
 * typos don't silently downgrade production.
 */
export function selectModel(task: AITask): AIModel {
    const envKey = ENV_KEY[task]
    const override = process.env[envKey]
    if (override) {
        if (isValidModel(override)) return override
        console.warn(`[ai-config] ${envKey}="${override}" is not a valid AIModel — falling back to default "${DEFAULT_MODELS[task]}"`)
    }
    return DEFAULT_MODELS[task]
}

/** Exported for tests. Do not mutate. */
export const __DEFAULT_MODELS_FOR_TEST = DEFAULT_MODELS
export const __ENV_KEY_FOR_TEST = ENV_KEY

// ─── Rate Limiting ──────────────────────────────────────────────────────
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business'

/**
 * Strategy #6: Rate limits per subscription tier
 */
export const RATE_LIMITS: Record<SubscriptionPlan, Record<AITask, number>> = {
    free: {
        'site-generation': 1,        // 1 total (lifetime)
        'chat-edit': 20,             // per day
        'inline-edit': 10,           // per day
        'seo-generation': 3,         // per day
        'content-rewrite': 5,        // per day
        'product-description': 5,    // per day
        'url-extraction': 10,        // per day
        'bulk-parse': 5,             // per day
    },
    starter: {
        'site-generation': 5,        // per month
        'chat-edit': 100,            // per day
        'inline-edit': 50,           // per day
        'seo-generation': 10,        // per day
        'content-rewrite': 20,       // per day
        'product-description': 20,   // per day
        'url-extraction': 30,        // per day
        'bulk-parse': 20,            // per day
    },
    pro: {
        'site-generation': 20,       // per month
        'chat-edit': 500,            // per day
        'inline-edit': 200,          // per day
        'seo-generation': 50,        // per day
        'content-rewrite': 100,      // per day
        'product-description': 100,  // per day
        'url-extraction': 100,       // per day
        'bulk-parse': 100,           // per day
    },
    business: {
        'site-generation': 999999,   // unlimited
        'chat-edit': 999999,
        'inline-edit': 999999,
        'seo-generation': 999999,
        'content-rewrite': 999999,
        'product-description': 999999,
        'url-extraction': 999999,
        'bulk-parse': 999999,
    },
}

/**
 * Check if a tenant has remaining AI credits for a given task
 */
export function checkRateLimit(
    plan: SubscriptionPlan,
    task: AITask,
    currentUsage: number
): { allowed: boolean; remaining: number; limit: number } {
    const limit = RATE_LIMITS[plan][task]
    const remaining = Math.max(0, limit - currentUsage)
    return {
        allowed: currentUsage < limit,
        remaining,
        limit,
    }
}

// ─── Prompt Optimization ────────────────────────────────────────────────

/**
 * Strategy #5: System prompts are static and cached
 * Keep them short and reusable across requests
 */
export const SYSTEM_PROMPTS = {
    'site-generation': `You are an AI specialised in creating websites for SMEs. Output JSON format for the block system.
Blocks: hero, navigation, about, features, testimonials, contact, gallery, footer, pricing, faq, cta, stats, team, blog-list, video, logo-cloud.
Each block has: blockType, variant, and content fields.
Theme has: primaryColor (hex), secondaryColor (hex), fontHeading, fontBody, colorMode (light/dark).
DO NOT generate HTML/CSS. ONLY generate JSON config for blocks.`,

    'chat-edit': `You are an AI editor for a website builder. Users request changes to their website.
Return JSON: { "changes": [{ "type": "UPDATE_BLOCK"|"ADD_BLOCK"|"REMOVE_BLOCK"|"UPDATE_THEME", "blockId"?: string, "data": {} }], "message": "Short change description" }
DO NOT generate HTML. ONLY generate JSON changes for the block system.`,

    'inline-edit': `You edit a single text element. Preserve the original tone and style.
Input: current text + editing instructions. Output: new text (plain text, NOT JSON).`,

    'seo-generation': `You are an SEO expert. Generate metadata for a website.
Output JSON: { "metaTitle": "<60 chars", "metaDescription": "150-160 chars", "keywords": ["..."], "ogTitle": "...", "ogDescription": "..." }`,

    'content-rewrite': `Rewrite content as requested. Preserve meaning, change phrasing.
Output: new text (plain text).`,

    'product-description': `Write compelling, SEO-friendly product descriptions. 2-3 concise sentences, highlighting features and benefits.
Output: product description (plain text).`,
} as const

// ─── Cost Estimation ────────────────────────────────────────────────────

/**
 * Estimated cost per AI call (USD)
 * Used for internal tracking and billing decisions
 */
export const ESTIMATED_COSTS: Record<AITask, number> = {
    'site-generation': 0.04,      // GPT-4o, ~4K in + 3K out (phase-03 flips to 4.1-mini → ~$0.004)
    'chat-edit': 0.0005,          // GPT-4o-mini, ~1.5K in + 500 out
    'inline-edit': 0.0002,        // GPT-4o-mini, ~500 in + 200 out
    'seo-generation': 0.0004,     // GPT-4o-mini, ~800 in + 400 out
    'content-rewrite': 0.0003,    // GPT-4o-mini, ~600 in + 300 out
    'product-description': 0.0003,
    'url-extraction': 0.001,      // GPT-4o-mini, ~2.3K in + 500 out
    'bulk-parse': 0.001,          // GPT-4o-mini, ~2K in + 1K out
}
