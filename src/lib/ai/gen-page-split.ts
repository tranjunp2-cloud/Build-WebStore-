/**
 * Phase 05 (plan 260703-1341-gen-perf-async-parallel) — parallel GPT split.
 * Splits the single mega-call (home + 4 subpages in one JSON response, ~60-80s)
 * into 3 parallel calls: home ∥ subpages batch 1 (About+Services) ∥ batch 2
 * (Contact+Blog). Wall-clock drops to ~max of the three. Started as a 2-call
 * split, escalated per plan after measurement showed the 4-subpage call was
 * both the long pole AND truncating at max_tokens. Behind env flag
 * GEN_PARALLEL_PAGES — flag OFF (default) leaves the single-call path untouched.
 *
 * Brand consistency (palette/tone/CTA labels) is already shared automatically
 * because both calls reuse the SAME base systemPrompt + userPromptText. Only
 * nav labels can diverge between two independent completions — `buildBrief`
 * resolves them deterministically (when known) and both prompts inject them.
 */

import type OpenAI from 'openai'
import { getNavLabels, type NavLabels } from './block-i18n'
import { selectModel } from './config'
import { buildNavigation } from './template-composer'
import { resolveComposerCategory } from './composer-category-resolver'
import type { BusinessSample } from './content/types'
import { composeTemplateResult } from './fallback-adapter'
import type { BusinessInfoInput } from './system-prompt'
import type { GenerationResult } from './generate-blocks'
import { logAiUsage } from './log-usage'

const HOME_MAX_TOKENS = 5000
const SUBPAGE_BATCH_MAX_TOKENS = 6000
// 3-call split (home ∥ batch1 ∥ batch2). Measured 2026-07-03: a single
// 4-subpage call produced ~6000+ output tokens for vi content — it truncated
// at max_tokens AND was the long pole (~80s ≈ no win over the mega-call,
// since home is only ~2k of the ~7.5k total tokens). Two 2-page batches
// halve the long pole and keep per-call output well under the token cap.
// gen-perf phase-08: batch 2 (Contact + Blog) is the most formulaic content
// → runs on the cheaper/faster 'site-generation-subpages-light' model (nano
// by default; revert per-env via AI_MODEL_SITEGEN_SUB_LIGHT=gpt-4.1-mini).
// Home + About/Services (brand-voice-heavy) stay on the main model.
const SUBPAGE_BATCHES: ReadonlyArray<{ pages: readonly string[]; light: boolean }> = [
    { pages: ['About', 'Services/Products'], light: false },
    { pages: ['Contact', 'Blog'], light: true },
]

export type PageSplitBrief = { navLabels: NavLabels | null }

/** Deterministic, no GPT round-trip. Page plan (5 fixed pages/slugs) is
 *  already baked into the system prompt's STRUCTURE RULES — this only
 *  resolves the one field (nav labels) that must be shared explicitly. */
export function buildBrief(blockLang: string): PageSplitBrief {
    return { navLabels: getNavLabels(blockLang) }
}

function navLabelsHint(brief: PageSplitBrief): string {
    if (!brief.navLabels) return ''
    const { home, about, services, contact } = brief.navLabels
    return `\nFor brand consistency, use these EXACT navigation link labels on every page (already decided, do not re-translate): Home="${home}", About="${about}", Services="${services}", Contact="${contact}".`
}

// gen-perf phase-09 (token diet): navigation is injected deterministically
// post-merge (buildNavigation) and subpage footers are cloned from the home
// footer — GPT must not spend output tokens on them. Copy caps trim the
// long-tail verbosity that put subpage batches near the token ceiling.
const CONCISE_RULE = '\nKeep copy tight: headlines <= 8 words, subheadlines <= 18 words, item descriptions and quotes <= 25 words. Do not pad.'
const OMIT_NAV_RULE = '\nDo NOT include any "navigation" block on any page — navigation is injected automatically after generation.'

export function buildHomeSystemPrompt(base: string, brief: PageSplitBrief): string {
    return `${base}\n\n## SCOPE OVERRIDE — THIS CALL GENERATES THE HOMEPAGE ONLY\nReturn the "pages" array with EXACTLY ONE entry: the Homepage ("isHomepage": true, "slug": "/", 8-14 blocks per STRUCTURE RULES). Do NOT include About, Services, Contact, or Blog pages — they are generated in a separate parallel call.${OMIT_NAV_RULE} DO include the "footer" block on the Homepage.${CONCISE_RULE}${navLabelsHint(brief)}`
}

export function buildSubpagesSystemPrompt(base: string, brief: PageSplitBrief, batch: readonly string[]): string {
    const blogNote = batch.includes('Blog') ? ' (Blog page needs blog-list block with >=3 posts)' : ''
    return `${base}\n\n## SCOPE OVERRIDE — THIS CALL GENERATES ${batch.length} SUBPAGES ONLY (NO HOMEPAGE)\nThe 5-page STRUCTURE RULES above describe the FULL site, which is being produced by several parallel calls. THIS call's output is only a slice of it: return the "pages" array with EXACTLY ${batch.length} entries, in this order: ${batch.join(', ')} — each 4-6 blocks per STRUCTURE RULES${blogNote}. Set "isHomepage": false on every entry. Do NOT include a Homepage or any other page in this response.${OMIT_NAV_RULE}\nDo NOT include any "footer" block — the site-wide footer is applied automatically.${CONCISE_RULE}${navLabelsHint(brief)}`
}

/** Scope repeated at the END of the user message — measured 2026-07-03 that
 *  a system-prompt-only override loses to the base STRUCTURE RULES: both
 *  subpage calls wrote the whole 5-page site and truncated at max_tokens. */
export function scopedUserPrompt(baseUser: string, scopeLine: string): string {
    return `${baseUser}\n\nIMPORTANT — OUTPUT SCOPE FOR THIS RESPONSE: ${scopeLine} Any additional page in the output is an error and will be discarded.`
}

/** Same parse-with-repair as the legacy single-call path: truncated JSON is
 *  trimmed to the last complete `}` before giving up. Null-valued keys are
 *  stripped recursively: GPT emits `"badge": null` for optional fields it
 *  skipped, but Zod block schemas expect ABSENT, not null — every null
 *  produced a noisy "Block validation warning" per gen (seen live
 *  2026-07-03). Nulls inside arrays are preserved (positional). */
export function safeParseJson(content: string): Record<string, unknown> {
    try {
        return stripNullsDeep(JSON.parse(content)) as Record<string, unknown>
    } catch {
        const lastBrace = content.lastIndexOf('}')
        if (lastBrace <= 0) throw new Error('Invalid JSON response from AI')
        return stripNullsDeep(JSON.parse(content.slice(0, lastBrace + 1))) as Record<string, unknown>
    }
}

function stripNullsDeep(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripNullsDeep)
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) {
            if (v === null) continue
            out[k] = stripNullsDeep(v)
        }
        return out
    }
    return value
}

type SplitCallOutcome = {
    parsed: Record<string, unknown> | null
    model: string
    tokensIn: number
    tokensOut: number
    durationMs: number
    errorMessage?: string
}

async function runSplitCall(
    openai: OpenAI,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
): Promise<SplitCallOutcome> {
    const start = Date.now()
    try {
        const completion = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
        })
        const content = completion.choices[0]?.message?.content
        if (!content) throw new Error('Empty AI response')
        const usage = completion.usage
        return { parsed: safeParseJson(content), model: completion.model, tokensIn: usage?.prompt_tokens ?? 0, tokensOut: usage?.completion_tokens ?? 0, durationMs: Date.now() - start }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        return { parsed: null, model, tokensIn: 0, tokensOut: 0, durationMs: Date.now() - start, errorMessage }
    }
}

function logOutcome(outcome: SplitCallOutcome): void {
    logAiUsage({
        endpoint: 'site-generation',
        model: outcome.model,
        tokensIn: outcome.tokensIn,
        tokensOut: outcome.tokensOut,
        durationMs: outcome.durationMs,
        success: outcome.parsed !== null,
        errorCode: outcome.errorMessage,
    })
}

/** Supports both the scoped `pages: [home]` shape and the legacy root-level
 *  `blocks` shape, in case GPT ignores the scoped hint. */
function extractHomePage(parsed: Record<string, unknown>): Record<string, unknown> | null {
    const pages = Array.isArray(parsed.pages) ? (parsed.pages as Record<string, unknown>[]) : null
    if (pages && pages.length > 0) return { ...pages[0], isHomepage: true, slug: pages[0]!.slug || '/' }
    if (Array.isArray(parsed.blocks)) {
        return { title: parsed.siteName ?? 'Homepage', slug: '/', isHomepage: true, blocks: parsed.blocks, seo: parsed.seo ?? {} }
    }
    return null
}

function extractSubPages(parsed: Record<string, unknown>): Record<string, unknown>[] {
    const pages = Array.isArray(parsed.pages) ? (parsed.pages as Record<string, unknown>[]) : []
    return pages.map((p) => ({ ...p, isHomepage: false }))
}

/** Merges the 2 independently-resolved responses into the shape the legacy
 *  single-call path produced: top-level fields from the home call (owns site
 *  identity + homepage SEO), `pages` = [home, ...subpages]. */
export function mergeSplitParsed(homeParsed: Record<string, unknown>, subsParsed: Record<string, unknown>): Record<string, unknown> {
    const homePage = extractHomePage(homeParsed)
    const subPages = extractSubPages(subsParsed)
    return {
        siteName: homeParsed.siteName,
        category: homeParsed.category,
        theme: homeParsed.theme,
        seo: homeParsed.seo,
        language: homeParsed.language,
        pages: homePage ? [homePage, ...subPages] : subPages,
    }
}

/**
 * gen-perf phase-09: deterministic "chrome" — navigation on every page from
 * buildNavigation (i18n, links guaranteed correct), footer cloned from the
 * home page onto subpages (single source, no per-page GPT drift). Strips any
 * stray nav/footer the model emitted despite the omit rules, and any
 * composer-fallback chrome, so every path converges on the same shape.
 * Exported for tests.
 */
export function applyDeterministicChrome(
    merged: Record<string, unknown>,
    businessInfo: BusinessInfoInput,
    blockLang: string,
): void {
    const pages = Array.isArray(merged.pages) ? (merged.pages as Record<string, unknown>[]) : []
    if (pages.length === 0) return

    const slugs = pages.map((p) => (typeof p.slug === 'string' && p.slug ? p.slug : '/'))
    const nav = buildNavigation(
        { name: businessInfo.businessName } as BusinessSample,
        slugs,
        resolveComposerCategory(businessInfo.industry ?? ''),
        undefined,
        blockLang,
    )

    const homeBlocks = Array.isArray(pages[0]?.blocks) ? (pages[0]!.blocks as Record<string, unknown>[]) : []
    const homeFooter = homeBlocks.find((b) => b.blockType === 'footer') ?? null

    pages.forEach((page, i) => {
        const blocks = Array.isArray(page.blocks) ? (page.blocks as Record<string, unknown>[]) : []
        const body = blocks.filter((b) => b.blockType !== 'navigation' && (i === 0 || b.blockType !== 'footer'))
        const footer = i === 0 ? [] : homeFooter ? [{ ...homeFooter }] : []
        page.blocks = [nav, ...body, ...footer]
    })
}

/** composeTemplateResult is pure/synchronous (fallback-adapter.ts) — safe to
 *  call inline as a per-call fallback without an extra async round-trip. */
function composerFallback(gr: GenerationResult, scope: 'home' | 'subpages'): Record<string, unknown> | null {
    if (!gr.pages || gr.pages.length === 0) return null
    if (scope === 'home') {
        return { siteName: gr.siteName, category: gr.siteType, theme: gr.theme, seo: gr.seo, language: gr.language, pages: [gr.pages[0]] }
    }
    return gr.pages.length > 1 ? { pages: gr.pages.slice(1) } : null
}

export type ParallelSplitInput = {
    openai: OpenAI
    model: string
    systemPrompt: string
    userPromptText: string
    promptText: string
    businessInfo: BusinessInfoInput
    seed: number
    language: 'en' | 'ms' | 'vi'
    blockLang: string
}

/** Call A (home) ∥ Call B/C (subpage batches), logs usage for all, falls
 *  back per-scope to the deterministic composer (never the whole gen).
 *  If ANY subpage batch fails, ALL subpages come from the composer — mixing
 *  GPT pages with composer pages would produce an inconsistent page set
 *  (composer uses its own page plan, e.g. /menu + /gallery). */
export async function runParallelPageSplit(input: ParallelSplitInput): Promise<Record<string, unknown>> {
    const brief = buildBrief(input.blockLang)
    const [homeOutcome, ...batchOutcomes] = await Promise.all([
        runSplitCall(
            input.openai, input.model,
            buildHomeSystemPrompt(input.systemPrompt, brief),
            scopedUserPrompt(input.userPromptText, 'generate ONLY the Homepage page (pages array with exactly 1 entry).'),
            HOME_MAX_TOKENS,
        ),
        ...SUBPAGE_BATCHES.map((batch) =>
            runSplitCall(
                input.openai,
                batch.light ? selectModel('site-generation-subpages-light') : input.model,
                buildSubpagesSystemPrompt(input.systemPrompt, brief, batch.pages),
                scopedUserPrompt(input.userPromptText, `generate ONLY these ${batch.pages.length} pages (pages array with exactly ${batch.pages.length} entries): ${batch.pages.join(', ')}. No Homepage.`),
                SUBPAGE_BATCH_MAX_TOKENS,
            ),
        ),
    ])
    logOutcome(homeOutcome)
    batchOutcomes.forEach(logOutcome)
    console.info(
        `[AI][GEN_PARALLEL_PAGES] home=${homeOutcome.durationMs}ms ` +
            batchOutcomes.map((o, i) => `subs${i + 1}=${o.durationMs}ms`).join(' ') +
            ` ok=${[homeOutcome, ...batchOutcomes].filter((o) => o.parsed).length}/${1 + batchOutcomes.length}`,
    )

    let homeParsed = homeOutcome.parsed
    // Scope enforcement in CODE, not just prompt: a scope-ignoring batch (the
    // measured failure mode) may emit a stray homepage or extra pages.
    // - a real homepage duplicate (slug '/') is discarded;
    // - a batch page merely MIS-FLAGGED isHomepage:true is kept and coerced
    //   (dropping it produced 4-page sites — seen live 2026-07-03 16:42);
    // - each batch is capped at its requested page count;
    // - a batch missing pages (nano sometimes returns 1 of 2) counts as
    //   FAILED → composer fallback for ALL subpages. Never a short site.
    const batchPages = batchOutcomes.map((o, i) => {
        const pages = Array.isArray(o.parsed?.pages) ? (o.parsed!.pages as Record<string, unknown>[]) : []
        return pages
            .filter((p) => p.slug !== '/')
            .map((p): Record<string, unknown> => ({ ...p, isHomepage: false }))
            .slice(0, SUBPAGE_BATCHES[i]!.pages.length)
    })
    // Slug sanity across ALL batch pages: non-empty string, unique after
    // normalization. A dup/empty slug would fail Payload's unique-per-site
    // validation at page-create time ("field is invalid: site_id, slug" —
    // seen intermittently live 2026-07-03 17:02) → composer fallback instead.
    const seenSlugs = new Set<string>(['/'])
    const slugsOk = batchPages.flat().every((p) => {
        const slug = typeof p.slug === 'string' ? p.slug.trim().toLowerCase() : ''
        if (!slug || seenSlugs.has(slug)) return false
        seenSlugs.add(slug)
        return true
    })
    if (!slugsOk) {
        console.warn('[AI][GEN_PARALLEL_PAGES] duplicate/empty subpage slug detected — composer fallback for subpages')
    }
    const allBatchesOk = slugsOk && batchOutcomes.every(
        (o, i) => o.parsed !== null && batchPages[i]!.length === SUBPAGE_BATCHES[i]!.pages.length,
    )
    if (!allBatchesOk) {
        console.warn(
            '[AI][GEN_PARALLEL_PAGES] batch page counts: ' +
                batchPages.map((p, i) => `subs${i + 1}=${p.length}/${SUBPAGE_BATCHES[i]!.pages.length}`).join(' '),
        )
    }
    let subsParsed: Record<string, unknown> | null = allBatchesOk ? { pages: batchPages.flat() } : null

    if (!homeParsed || !subsParsed) {
        // Lazy, computed at most once — covers any scope failing. Seed matches
        // the deterministic theme/category choice already made in
        // generateSiteWithAI so the fallback page set stays on-brand.
        const composerResult = composeTemplateResult(input.promptText, input.seed, input.language, input.businessInfo)
        if (!homeParsed) {
            homeParsed = (composerResult && composerFallback(composerResult, 'home')) ??
                { siteName: input.businessInfo.businessName, category: 'business', theme: {}, seo: {}, language: input.language, pages: [] }
            console.warn(`[AI][GEN_PARALLEL_PAGES] home call failed (${homeOutcome.errorMessage ?? 'unknown'}) — composer fallback applied`)
        }
        if (!subsParsed) {
            const failed = batchOutcomes.filter((o) => !o.parsed).map((o) => o.errorMessage ?? 'unknown').join('; ')
            subsParsed = (composerResult && composerFallback(composerResult, 'subpages')) ?? { pages: [] }
            console.warn(`[AI][GEN_PARALLEL_PAGES] subpage batch(es) failed (${failed}) — composer fallback applied for ALL subpages`)
        }
    }

    const merged = mergeSplitParsed(homeParsed, subsParsed)
    applyDeterministicChrome(merged, input.businessInfo, input.blockLang)
    return merged
}
