import { currentAiActor } from '@/lib/ai-platform/actor-scope'
import { type BrandEvidence } from './pw1-brand-evidence'

/**
 * Visual interpretation is isolated from layout generation. Never accepts blocks or page structure.
 * Runs the AI platform task `migration.pw1-brand-palette` as the migration's actor
 * (`runWithAiActor` in pw1-batch); without one the CSS evidence is kept.
 */
export async function analyzePw1Brand(evidence: BrandEvidence, signal?: AbortSignal): Promise<BrandEvidence> {
    if (!evidence.screenshot && !evidence.logoScreenshot) return evidence
    const actor = currentAiActor()
    if (!actor) return { ...evidence, status: evidence.colors.length ? 'observed' : 'unavailable', warning: [evidence.warning, 'Brand visual analysis unavailable: AI platform not configured for this run; using CSS evidence'].filter(Boolean).join('; ') }
    try {
        const images = [evidence.screenshot, evidence.logoScreenshot].filter((s): s is string => Boolean(s))
        const { getAiTaskClient } = await import('@/lib/ai-platform/task-client')
        const { output, usage } = await getAiTaskClient(actor).runTask('migration.pw1-brand-palette', {
            url: evidence.url,
            cssColors: evidence.colors,
            hasWebsite: Boolean(evidence.screenshot),
            hasLogo: Boolean(evidence.logoScreenshot),
            images,
        }, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(50_000)]) : AbortSignal.timeout(50_000) })
        const { usable, ...palette } = output
        return { ...evidence, status: usable ? 'observed' : 'unavailable', palette: usable ? palette : undefined,
            analysisTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0), analysisModel: usage.model,
            ...(!usable ? { colors: [], warning: [evidence.warning, `Visual source rejected: ${palette.reason}; using contextual palette`].filter(Boolean).join('; ') } : {}) }
    } catch (error) {
        signal?.throwIfAborted()
        // Failures (quota, timeout, transport) are recorded in the AI platform ledger.
        return { ...evidence, status: evidence.colors.length ? 'observed' : 'unavailable', warning: [evidence.warning, `Brand visual analysis failed: ${error instanceof Error ? error.message.slice(0, 160) : 'unknown error'}; using CSS evidence`].filter(Boolean).join('; ') }
    }
}
