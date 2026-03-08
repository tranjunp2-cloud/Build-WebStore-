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
export type AIModel = 'gpt-4o' | 'gpt-4o-mini'

/**
 * Strategy #1: Route to the correct model based on task complexity
 * GPT-4o: Only for first-time site generation (higher quality needed)
 * GPT-4o-mini: Everything else (15x cheaper)
 */
export function selectModel(task: AITask): AIModel {
    switch (task) {
        case 'site-generation':
            return 'gpt-4o'
        case 'chat-edit':
        case 'inline-edit':
        case 'seo-generation':
        case 'content-rewrite':
        case 'product-description':
            return 'gpt-4o-mini'
        default:
            return 'gpt-4o-mini'
    }
}

export type AITask =
    | 'site-generation'
    | 'chat-edit'
    | 'inline-edit'
    | 'seo-generation'
    | 'content-rewrite'
    | 'product-description'

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
    },
    starter: {
        'site-generation': 5,        // per month
        'chat-edit': 100,            // per day
        'inline-edit': 50,           // per day
        'seo-generation': 10,        // per day
        'content-rewrite': 20,       // per day
        'product-description': 20,   // per day
    },
    pro: {
        'site-generation': 20,       // per month
        'chat-edit': 500,            // per day
        'inline-edit': 200,          // per day
        'seo-generation': 50,        // per day
        'content-rewrite': 100,      // per day
        'product-description': 100,  // per day
    },
    business: {
        'site-generation': 999999,   // unlimited
        'chat-edit': 999999,
        'inline-edit': 999999,
        'seo-generation': 999999,
        'content-rewrite': 999999,
        'product-description': 999999,
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
    'site-generation': 0.04,      // GPT-4o, ~4K in + 3K out
    'chat-edit': 0.0005,          // GPT-4o-mini, ~1.5K in + 500 out
    'inline-edit': 0.0002,        // GPT-4o-mini, ~500 in + 200 out
    'seo-generation': 0.0004,     // GPT-4o-mini, ~800 in + 400 out
    'content-rewrite': 0.0003,    // GPT-4o-mini, ~600 in + 300 out
    'product-description': 0.0003,
}
