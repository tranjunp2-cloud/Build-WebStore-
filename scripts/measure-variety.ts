/**
 * E2E variety measurement harness — Plan 2253 Phase 04
 *
 * Generates N sites across 5 categories against the local dev server and
 * computes 5 distribution metrics per category to quantify "gen website vẫn
 * giống template" (sites still collapse to same variants / themes / content).
 *
 * Usage:
 *   pnpm tsx scripts/measure-variety.ts [--category=beauty] [--runs=20] [--label=baseline]
 *
 * Prereqs:
 *   - Dev server on http://localhost:3000 (or PORT env var)
 *   - ALLOW_E2E_TEST_UTILS=true in .env.local (enables /api/e2e/ensure-test-user)
 *   - E2E_TEST_BEARER=local-test-secret-12345 (or .env.local value)
 *   - `next dev` (NODE_ENV=development): the test user signs in through verify-otp, which accepts any
 *     six-digit code there (scripts/perf/otp-session.ts)
 *   - AI_PLATFORM_URL + AI_PLATFORM_CONTEXT_SECRET (ai-platform) + PIXABAY_API_KEY set so AI happy path runs
 *
 * Output:
 *   - plans/260414-2253-ai-gen-variety-root-cause/reports/variety-{label}.json
 *   - plans/260414-2253-ai-gen-variety-root-cause/reports/variety-{label}.md
 *
 * Metrics computed per category:
 *   1. Variant share — top variant share per block type (target: ≤35%)
 *   2. Skeleton entropy — distinct block sequences (target: ≥3 per 20 gens)
 *   3. Content collision — testimonial text overlap % (target: <20%)
 *   4. Theme distribution — distinct (primaryColor, fontPairingId) combos (target: ≥6)
 *   5. Image uniqueness — distinct hero photo IDs (target: ≥12 per 20 gens)
 *
 * NOT run in CI. Local dev only. Costs ~$1/run (OpenAI + Unsplash quota).
 */

import fs from 'node:fs'
import path from 'node:path'
import { createOtpSession, type OtpSession } from './perf/otp-session'

const BASE = process.env.MEASURE_BASE ?? `http://localhost:${process.env.PORT ?? 3000}`
const BEARER = process.env.E2E_SETUP_SECRET ?? ''
const REPORT_DIR = 'plans/260414-2253-ai-gen-variety-root-cause/reports'
const FIXTURES_PATH = 'scripts/fixtures/variety-business-names.json'
const DEFAULT_RUNS_PER_CAT = 20
const REQUEST_TIMEOUT_MS = 180_000

// ─── Types ──────────────────────────────────────────────────────────────

export interface GenBlock {
    blockType: string
    variant?: string
    testimonials?: Array<{ quote?: string; name?: string }>
    image?: number | string | null
    [key: string]: unknown
}

export interface GenResult {
    siteName: string
    blocks: GenBlock[]
    theme?: { primaryColor?: string; fontPairingId?: string; fontHeading?: string }
    error?: string
}

export interface CategoryMetrics {
    category: string
    runs: number
    variantShare: Record<string, { top: string; share: number; distinct: number }>
    skeletonEntropy: { distinct: number; sequences: string[] }
    contentCollision: {
        testimonialOverlapPct: number
        /** Plan 2253 Phase 03 v3 — adds coverage for R4 oversight: hardcoded
         * library blocks (service-cards/features/stats/team) previously
         * returned identical [0] items across all gens. Metric measures
         * distinct count of first-item title per block type. */
        libraryBlockFirstItem?: Record<string, { distinct: number; runs: number }>
    }
    themeDistribution: { distinctCombos: number; combos: string[] }
    imageUniqueness: { distinctHeroImages: number }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function die(msg: string): never {
    console.error(`[measure-variety] ERROR: ${msg}`)
    process.exit(1)
}

function parseArgs(): { category?: string; runs: number; label: string } {
    const args = process.argv.slice(2)
    const out: { category?: string; runs: number; label: string } = {
        runs: DEFAULT_RUNS_PER_CAT,
        label: new Date().toISOString().slice(0, 10),
    }
    for (const arg of args) {
        if (arg.startsWith('--category=')) out.category = arg.slice(11)
        else if (arg.startsWith('--runs=')) out.runs = parseInt(arg.slice(7), 10)
        else if (arg.startsWith('--label=')) out.label = arg.slice(8)
    }
    return out
}

const TEST_USER_EMAIL = 'measure-variety@primeweb.app'

async function ensureTestUser(): Promise<OtpSession> {
    const res = await fetch(`${BASE}/api/e2e/ensure-test-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${BEARER}`,
        },
        body: JSON.stringify({
            email: TEST_USER_EMAIL,
            password: 'TestPass123!',
        }),
    })
    if (!res.ok) die(`ensure-test-user failed: ${res.status} ${await res.text()}`)
    // ensure-test-user sets no session; sign in through the OTP step (the password step opens nothing, TC-PERF-142).
    return createOtpSession(BASE, TEST_USER_EMAIL)
}

async function generateSite(session: OtpSession, name: string, category: string): Promise<GenResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const res = await fetch(`${BASE}/api/ai/generate-site`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: session.cookie,
                Origin: session.origin,
            },
            body: JSON.stringify({
                businessInfo: {
                    businessName: name,
                    industry: category,
                    shortDescription: `${name} is a ${category} business in Malaysia.`,
                    products: '',
                },
                language: 'en',
            }),
            signal: controller.signal,
        })
        if (!res.ok) return { siteName: name, blocks: [], error: `${res.status}` }
        const data = (await res.json()) as {
            site?: { name?: string; blocks?: GenBlock[]; theme?: GenResult['theme'] }
        }
        return {
            siteName: data.site?.name ?? name,
            blocks: data.site?.blocks ?? [],
            theme: data.site?.theme,
        }
    } catch (e) {
        return { siteName: name, blocks: [], error: String(e) }
    } finally {
        clearTimeout(timer)
    }
}

// ─── Metric functions ──────────────────────────────────────────────────

export function computeVariantShare(results: GenResult[]): CategoryMetrics['variantShare'] {
    const byBlock = new Map<string, Map<string, number>>()
    for (const r of results) {
        for (const b of r.blocks) {
            if (!b.blockType || !b.variant) continue
            let counts = byBlock.get(b.blockType)
            if (!counts) {
                counts = new Map()
                byBlock.set(b.blockType, counts)
            }
            counts.set(b.variant, (counts.get(b.variant) ?? 0) + 1)
        }
    }
    const out: CategoryMetrics['variantShare'] = {}
    for (const [blockType, counts] of byBlock) {
        let top = ''
        let topCount = 0
        let total = 0
        for (const [variant, count] of counts) {
            total += count
            if (count > topCount) {
                topCount = count
                top = variant
            }
        }
        out[blockType] = {
            top,
            share: total > 0 ? topCount / total : 0,
            distinct: counts.size,
        }
    }
    return out
}

export function computeSkeletonEntropy(results: GenResult[]): CategoryMetrics['skeletonEntropy'] {
    const sequences = new Set<string>()
    for (const r of results) {
        const seq = r.blocks.map((b) => b.blockType).join('→')
        if (seq) sequences.add(seq)
    }
    return { distinct: sequences.size, sequences: [...sequences] }
}

export function computeContentCollision(
    results: GenResult[],
): CategoryMetrics['contentCollision'] {
    const allQuotes: string[] = []
    for (const r of results) {
        for (const b of r.blocks) {
            if (b.blockType !== 'testimonials') continue
            for (const t of b.testimonials ?? []) {
                if (t.quote) allQuotes.push(t.quote.toLowerCase().trim())
            }
        }
    }
    const testimonialOverlapPct = (() => {
        if (allQuotes.length === 0) return 0
        const counts = new Map<string, number>()
        for (const q of allQuotes) counts.set(q, (counts.get(q) ?? 0) + 1)
        const duplicates = [...counts.values()].filter((c) => c > 1).reduce((a, b) => a + b, 0)
        return Math.round((duplicates / allQuotes.length) * 100)
    })()

    // Plan 2253 Phase 03 v3 — library block first-item diversity
    // Catches the R4 oversight on hardcoded service-cards/features/stats/team.
    const BLOCK_FIELD: Record<string, string> = {
        'service-cards': 'services',
        features: 'features',
        stats: 'stats',
        team: 'members',
    }
    const libraryBlockFirstItem: Record<string, { distinct: number; runs: number }> = {}
    for (const [blockType, field] of Object.entries(BLOCK_FIELD)) {
        const firstTitles: string[] = []
        for (const r of results) {
            const block = r.blocks.find((b) => b.blockType === blockType) as Record<string, unknown> | undefined
            if (!block) continue
            const arr = block[field]
            if (!Array.isArray(arr) || arr.length === 0) continue
            const first = arr[0] as Record<string, unknown>
            const title = String(
                first?.title ?? first?.name ?? first?.label ?? '',
            ).toLowerCase().trim()
            if (title) firstTitles.push(title)
        }
        if (firstTitles.length > 0) {
            libraryBlockFirstItem[blockType] = {
                distinct: new Set(firstTitles).size,
                runs: firstTitles.length,
            }
        }
    }
    return { testimonialOverlapPct, libraryBlockFirstItem }
}

export function computeThemeDistribution(
    results: GenResult[],
): CategoryMetrics['themeDistribution'] {
    const combos = new Set<string>()
    for (const r of results) {
        const primary = r.theme?.primaryColor ?? ''
        const font = r.theme?.fontPairingId ?? r.theme?.fontHeading ?? ''
        if (primary || font) combos.add(`${primary}|${font}`)
    }
    return { distinctCombos: combos.size, combos: [...combos] }
}

export function computeImageUniqueness(
    results: GenResult[],
): CategoryMetrics['imageUniqueness'] {
    const ids = new Set<string>()
    for (const r of results) {
        const hero = r.blocks.find((b) => b.blockType === 'hero')
        if (!hero) continue
        const imgId = hero.image
        if (imgId != null && imgId !== '') ids.add(String(imgId))
    }
    return { distinctHeroImages: ids.size }
}

// ─── Report rendering ──────────────────────────────────────────────────

function renderMarkdown(metrics: CategoryMetrics[], label: string): string {
    const lines: string[] = []
    lines.push(`# Variety Measurement — ${label}`)
    lines.push('')
    lines.push(`> Generated: ${new Date().toISOString()}`)
    lines.push('')
    lines.push('## Summary')
    lines.push('')
    lines.push('| Category | Runs | Top Variant Share | Skeletons | Testimonial Collision | Theme Combos | Hero Images |')
    lines.push('|---|---|---|---|---|---|---|')
    for (const m of metrics) {
        const topShare = Object.values(m.variantShare)
            .map((v) => v.share)
            .reduce((a, b) => Math.max(a, b), 0)
        lines.push(
            `| ${m.category} | ${m.runs} | ${(topShare * 100).toFixed(0)}% | ${m.skeletonEntropy.distinct} | ${m.contentCollision.testimonialOverlapPct}% | ${m.themeDistribution.distinctCombos} | ${m.imageUniqueness.distinctHeroImages} |`,
        )
    }
    lines.push('')
    lines.push('## Targets (Plan 2253 success metrics)')
    lines.push('')
    lines.push('- Top variant share: **≤35%** (baseline ~60%)')
    lines.push('- Skeletons distinct: **≥3** per 20 gens (baseline 1)')
    lines.push('- Content collision: **<20%** (baseline ~80%)')
    lines.push('- Theme combos: **≥6** per 20 gens (baseline ~2-3)')
    lines.push('- Hero images: **≥12** per 20 gens (baseline ~4-5)')
    lines.push('')
    lines.push('## Per-category details')
    lines.push('')
    for (const m of metrics) {
        lines.push(`### ${m.category}`)
        lines.push('')
        lines.push('**Variant share per block type:**')
        lines.push('')
        for (const [block, info] of Object.entries(m.variantShare)) {
            lines.push(`- \`${block}\`: top=\`${info.top}\` (${(info.share * 100).toFixed(0)}%), distinct=${info.distinct}`)
        }
        lines.push('')
        lines.push(`**Skeleton sequences** (${m.skeletonEntropy.distinct}):`)
        lines.push('')
        for (const s of m.skeletonEntropy.sequences) {
            lines.push(`- \`${s}\``)
        }
        lines.push('')
        lines.push(`**Theme combos** (${m.themeDistribution.distinctCombos}):`)
        lines.push('')
        for (const c of m.themeDistribution.combos) {
            lines.push(`- \`${c}\``)
        }
        lines.push('')
    }
    return lines.join('\n')
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs()
    const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')) as Record<
        string,
        string[]
    >
    const categories = args.category ? [args.category] : Object.keys(fixtures)

    console.log(`[measure-variety] Starting runs across ${categories.length} categories, ${args.runs}/cat`)
    console.log(`[measure-variety] Base URL: ${BASE}`)

    const session = await ensureTestUser()
    console.log('[measure-variety] Test user ready')

    const allResults: Record<string, GenResult[]> = {}

    for (const cat of categories) {
        const names = (fixtures[cat] ?? []).slice(0, args.runs)
        if (names.length === 0) {
            console.warn(`[measure-variety] No fixture names for category: ${cat}`)
            continue
        }
        console.log(`[measure-variety] ${cat}: generating ${names.length} sites...`)
        const results: GenResult[] = []
        for (let i = 0; i < names.length; i++) {
            const name = names[i]!
            process.stdout.write(`  [${i + 1}/${names.length}] ${name}... `)
            const r = await generateSite(session, name, cat)
            if (r.error) {
                console.log(`ERROR ${r.error}`)
            } else {
                console.log(`ok (${r.blocks.length} blocks)`)
            }
            results.push(r)
        }
        allResults[cat] = results
    }

    // Compute metrics
    const metrics: CategoryMetrics[] = []
    for (const cat of categories) {
        const results = allResults[cat] ?? []
        if (results.length === 0) continue
        metrics.push({
            category: cat,
            runs: results.length,
            variantShare: computeVariantShare(results),
            skeletonEntropy: computeSkeletonEntropy(results),
            contentCollision: computeContentCollision(results),
            themeDistribution: computeThemeDistribution(results),
            imageUniqueness: computeImageUniqueness(results),
        })
    }

    // Write reports
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true })
    const jsonPath = path.join(REPORT_DIR, `variety-${args.label}.json`)
    const mdPath = path.join(REPORT_DIR, `variety-${args.label}.md`)
    fs.writeFileSync(jsonPath, JSON.stringify({ label: args.label, metrics, rawResults: allResults }, null, 2))
    fs.writeFileSync(mdPath, renderMarkdown(metrics, args.label))

    console.log(`\n[measure-variety] Reports written:`)
    console.log(`  ${jsonPath}`)
    console.log(`  ${mdPath}`)
}

// Only run main when invoked as a script (not on import from tests or the
// sibling offline runner). Match the exact basename, not substrings.
const isDirectRun =
    typeof process !== 'undefined' &&
    (() => {
        const arg = process.argv[1] ?? ''
        return arg.endsWith('/measure-variety.ts') || arg.endsWith('/measure-variety.js')
    })()
if (isDirectRun) {
    main().catch((e) => die(String(e)))
}
