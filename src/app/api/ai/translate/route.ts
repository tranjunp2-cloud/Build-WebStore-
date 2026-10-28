/**
 * POST /api/ai/translate
 * F26-04: AI translate fallback — translates block template content EN → target locale.
 *
 * Body: { blockType: string, targetLocale: string, content: Record<string, unknown> }
 * Returns: { translated: Record<string, unknown>, cached: boolean }
 * On fail: a non-2xx `{ ok: false, status: 'fallback', error }` and NO `translated`: a failed
 * translation is never answered with the original text, because a caller would store that as
 * the translation (staging answered 200 + the original, and the editor kept the template
 * defaults it showed instead). 429 keeps the legacy rate-limit shape.
 *
 * The model call is the AI platform task `i18n.translate-blocks`; without the
 * platform configured the answer is 503.
 * The cache key is derived on the server (workspace + prompt version + locale +
 * content hash); `blockType` is validated but no longer part of the key.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { applyTranslatedStrings, flattenTranslatableStrings, I18N_TRANSLATE_BLOCKS_PROMPT_VERSION } from '@ech/ai-contracts'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { parseRequest } from '@/lib/validations/helpers'
import { getCachedTranslation, setCachedTranslation, translationCacheKey } from '@/lib/ai/translate-cache'
import { describeAiTaskFailure, resolveSiteBillingTenant } from '@/lib/ai-platform/ai-tasks'
import { isAiTasksEnabled } from '@/lib/ai-platform/config'
import { type AgentActor, resolveActorForUser } from '@/lib/ai-platform/context'
import { getAiTaskClient } from '@/lib/ai-platform/task-client'
import type { User } from 'payload'
import type { PlatformUser } from '@/types/user'
import { sanitizeText } from '@/utils/sanitize'

// Allowlisted locales — F26 Phase 1 is EN + BM only (BR-06). Reject anything else with 400.
const SUPPORTED_TARGET_LOCALES = ['en', 'ms'] as const

// Recursively strip HTML from every string leaf of the AI-translated output before it is
// cached / returned / persisted — defence against XSS in model output (TC-F26-04-08).
function sanitizeTranslated(value: unknown): unknown {
    if (typeof value === 'string') return sanitizeText(value)
    if (Array.isArray(value)) return value.map(sanitizeTranslated)
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeTranslated(v)]))
    }
    return value
}

const translateSchema = z.object({
    // A site-scoped caller names its site so the usage and the cache scope are that site's workspace.
    siteId: z.union([z.string().min(1), z.number()]).optional().transform((v) => (v != null ? String(v) : undefined)),
    blockType: z.string().min(1).max(64),
    targetLocale: z.enum(SUPPORTED_TARGET_LOCALES),
    // Bound total serialized size to ~10KB to cap OpenAI input tokens (cost attack).
    // Values can be nested objects/arrays — z.string() would reject ctaButtons, faq.items, etc.
    content: z.record(z.unknown()).refine(
        obj => JSON.stringify(obj).length <= 10_000,
        { message: 'Content exceeds 10KB limit' },
    ),
})

type TargetLocale = (typeof SUPPORTED_TARGET_LOCALES)[number]

/** The verified workspace, or the access error that stopped it (no workspace → user-scoped cache). */
async function resolveWorkspace(user: User | PlatformUser, req: Request, tenantId?: string): Promise<{ actor: AgentActor | null; error: unknown }> {
    try {
        return { actor: await resolveActorForUser(user as PlatformUser, req, { tenantId }), error: null }
    } catch (error) {
        return { actor: null, error }
    }
}

/** A translation that could not be made: `status: 'fallback'` stays for older clients, `translated` is never sent. */
function translationFailed(status: 502 | 503, error: string) {
    return NextResponse.json({ ok: false, status: 'fallback', error }, { status })
}

/** Runs i18n.translate-blocks; returns the merged content or the failure response. */
async function translateOnPlatform(
    workspace: { actor: AgentActor | null; error: unknown },
    content: Record<string, unknown>,
    targetLocale: TargetLocale,
): Promise<Record<string, unknown> | NextResponse> {
    const { fields, paths } = flattenTranslatableStrings(content)
    if (Object.keys(fields).length === 0) return content
    try {
        if (!workspace.actor) throw workspace.error
        const { output } = await getAiTaskClient(workspace.actor).runTask('i18n.translate-blocks', { targetLocale, fields })
        return applyTranslatedStrings(content, paths, output.fields)
    } catch (error) {
        const failure = describeAiTaskFailure(error)
        // Workspace quota keeps the legacy rate-limit shape; anything else never crashes (AC-3).
        if (failure.status === 429) return NextResponse.json({ error: failure.message }, { status: 429 })
        console.warn('[translate] platform task failed:', failure.status, failure.message)
        return translationFailed(502, failure.message)
    }
}

export const POST = withAuth(async (user, req) => {
    try {
        const { data, errorResponse } = await parseRequest(req, translateSchema)
        if (errorResponse) return errorResponse

        const { targetLocale, content, siteId } = data!

        let siteTenantId: string | undefined
        if (siteId) {
            const billing = await resolveSiteBillingTenant(user, siteId)
            if (!billing.ok) return NextResponse.json({ error: billing.error }, { status: billing.status })
            siteTenantId = billing.tenantId
        }

        if (!isAiTasksEnabled()) {
            // No AI configured — nothing was translated, so there is nothing to return
            return translationFailed(503, 'Translation is not available right now.')
        }
        const workspace = await resolveWorkspace(user, req, siteTenantId)
        const cacheKey = translationCacheKey({
            scope: workspace.actor ? `org:${workspace.actor.organizationId}` : `user:${user.id}`,
            promptVersion: I18N_TRANSLATE_BLOCKS_PROMPT_VERSION,
            locale: targetLocale,
            content,
        })

        // AC-4: Cache hit → skip AI call. Checked before the rate limit so hits cost no quota.
        const cached = getCachedTranslation(cacheKey)
        if (cached) {
            return NextResponse.json({ translated: cached, cached: true })
        }

        // Rate limit: 30 translate calls per hour (cheaper than generate-site)
        const rateLimit = await checkRateLimit(`ai:translate:${user.id}`, 30)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 },
            )
        }

        const result = await translateOnPlatform(workspace, content, targetLocale)
        if (result instanceof NextResponse) return result
        const translated = sanitizeTranslated(result) as Record<string, unknown>
        setCachedTranslation(cacheKey, translated)
        return NextResponse.json({ translated, cached: false })
    } catch (err) {
        console.error('[translate] error:', err)
        // AC-3: Never crash — answer the failure; the original text is not a translation
        return translationFailed(502, 'The translation could not be made right now. Try again in a moment.')
    }
}, { csrf: true, requireMfa: true })
