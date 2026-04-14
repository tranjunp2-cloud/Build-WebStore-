/**
 * Offline variety measurement — calls generateSiteWithAI() directly.
 *
 * Unlike measure-variety.ts (HTTP-based, needs dev server + E2E secret),
 * this script imports the generator in-process. No auth, no rate limit,
 * no dev server, no media pipeline (image uniqueness metric is skipped).
 *
 * Prereqs:
 *   - OPENAI_API_KEY in env
 *   - Node 20+ (tsx)
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... pnpm tsx scripts/measure-variety-offline.ts \
 *     --category=beauty --runs=20 --label=baseline
 */

import fs from 'node:fs'
import path from 'node:path'
import { generateSiteWithAI } from '../src/lib/ai/openai-generator'
import {
    computeVariantShare,
    computeSkeletonEntropy,
    computeContentCollision,
    computeThemeDistribution,
    type GenResult,
    type CategoryMetrics,
} from './measure-variety'

const REPORT_DIR = 'plans/260414-2253-ai-gen-variety-root-cause/reports'
const FIXTURES_PATH = 'scripts/fixtures/variety-business-names.json'
const DEFAULT_RUNS = 20

function parseArgs(): { category?: string; runs: number; label: string } {
    const args = process.argv.slice(2)
    const out: { category?: string; runs: number; label: string } = {
        runs: DEFAULT_RUNS,
        label: new Date().toISOString().slice(0, 10),
    }
    for (const arg of args) {
        if (arg.startsWith('--category=')) out.category = arg.slice(11)
        else if (arg.startsWith('--runs=')) out.runs = parseInt(arg.slice(7), 10)
        else if (arg.startsWith('--label=')) out.label = arg.slice(8)
    }
    return out
}

async function generateOne(name: string, category: string): Promise<GenResult> {
    try {
        const { result } = await generateSiteWithAI(
            {
                businessName: name,
                industry: category,
                shortDescription: `${name} is a ${category} business in Malaysia.`,
                products: '',
            },
            undefined,
            'en',
        )
        // Flatten multi-page result: use homepage blocks (first page) for metric.
        const homepage = result.pages?.[0]
        const blocks = (homepage?.blocks ?? result.blocks ?? []) as GenResult['blocks']
        return {
            siteName: result.siteName ?? name,
            blocks,
            theme: result.theme,
        }
    } catch (e) {
        return { siteName: name, blocks: [], error: String(e) }
    }
}

function renderMarkdown(metrics: CategoryMetrics[], label: string): string {
    const lines: string[] = []
    lines.push(`# Variety Measurement — ${label}`)
    lines.push('')
    lines.push(`> Generated: ${new Date().toISOString()}`)
    lines.push('> Mode: offline (direct generateSiteWithAI call, no media pipeline)')
    lines.push('')
    lines.push('## Summary')
    lines.push('')
    lines.push('| Category | Runs | Errors | Top Variant Share | Skeletons | Testim. Collision | Theme Combos | Lib Block Diversity |')
    lines.push('|---|---|---|---|---|---|---|---|')
    for (const m of metrics) {
        const topShare = Object.values(m.variantShare)
            .map((v) => v.share)
            .reduce((a, b) => Math.max(a, b), 0)
        const errs = (m as CategoryMetrics & { errors?: number }).errors ?? 0
        const libBlocks = m.contentCollision.libraryBlockFirstItem ?? {}
        const libSummary = Object.entries(libBlocks)
            .map(([k, v]) => `${k.slice(0, 3)}=${v.distinct}/${v.runs}`)
            .join(' ')
        lines.push(
            `| ${m.category} | ${m.runs} | ${errs} | ${(topShare * 100).toFixed(0)}% | ${m.skeletonEntropy.distinct} | ${m.contentCollision.testimonialOverlapPct}% | ${m.themeDistribution.distinctCombos} | ${libSummary || '—'} |`,
        )
    }
    lines.push('')
    lines.push('## Targets (Plan 2253)')
    lines.push('')
    lines.push('- Top variant share: **≤35%** (baseline ~60%)')
    lines.push('- Skeletons distinct: **≥3** per 20 gens')
    lines.push('- Content collision: **<20%**')
    lines.push('- Theme combos: **≥6** per 20 gens (baseline ~2-3)')
    lines.push('- Image uniqueness: **N/A** (offline mode, no media pipeline)')
    lines.push('')
    lines.push('## Per-category details')
    lines.push('')
    for (const m of metrics) {
        lines.push(`### ${m.category}`)
        lines.push('')
        lines.push('**Variant share per block type:**')
        lines.push('')
        for (const [block, info] of Object.entries(m.variantShare)) {
            lines.push(
                `- \`${block}\`: top=\`${info.top}\` (${(info.share * 100).toFixed(0)}%), distinct=${info.distinct}`,
            )
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

async function main() {
    const args = parseArgs()
    const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')) as Record<
        string,
        string[]
    >
    const categories = args.category ? [args.category] : Object.keys(fixtures)

    console.log(`[measure-variety-offline] Starting runs across ${categories.length} categories, ${args.runs}/cat`)
    console.log(`[measure-variety-offline] Model: ${process.env.OPENAI_API_KEY ? 'OpenAI enabled' : 'NO API KEY — falling back'}`)

    const allResults: Record<string, GenResult[]> = {}

    for (const cat of categories) {
        const names = (fixtures[cat] ?? []).slice(0, args.runs)
        if (names.length === 0) {
            console.warn(`[measure-variety-offline] No fixture names for category: ${cat}`)
            continue
        }
        console.log(`[measure-variety-offline] ${cat}: generating ${names.length} sites...`)
        const results: GenResult[] = []
        // Run 3 concurrent to balance speed + OpenAI rate limit
        const CONCURRENCY = 3
        for (let i = 0; i < names.length; i += CONCURRENCY) {
            const batch = names.slice(i, i + CONCURRENCY)
            const batchResults = await Promise.all(
                batch.map(async (name, j) => {
                    const idx = i + j + 1
                    process.stdout.write(`  [${idx}/${names.length}] ${name}... `)
                    const r = await generateOne(name, cat)
                    if (r.error) {
                        console.log(`ERROR ${r.error.slice(0, 80)}`)
                    } else {
                        console.log(`ok (${r.blocks.length} blocks)`)
                    }
                    return r
                }),
            )
            results.push(...batchResults)
        }
        allResults[cat] = results
    }

    const metrics: Array<CategoryMetrics & { errors: number }> = []
    for (const cat of categories) {
        const results = allResults[cat] ?? []
        if (results.length === 0) continue
        const errors = results.filter((r) => r.error).length
        const valid = results.filter((r) => !r.error)
        metrics.push({
            category: cat,
            runs: valid.length,
            errors,
            variantShare: computeVariantShare(valid),
            skeletonEntropy: computeSkeletonEntropy(valid),
            contentCollision: computeContentCollision(valid),
            themeDistribution: computeThemeDistribution(valid),
            imageUniqueness: { distinctHeroImages: 0 }, // N/A offline
        })
    }

    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true })
    const jsonPath = path.join(REPORT_DIR, `variety-${args.label}.json`)
    const mdPath = path.join(REPORT_DIR, `variety-${args.label}.md`)
    fs.writeFileSync(
        jsonPath,
        JSON.stringify({ label: args.label, metrics, rawResults: allResults }, null, 2),
    )
    fs.writeFileSync(mdPath, renderMarkdown(metrics, args.label))

    console.log(`\n[measure-variety-offline] Reports written:`)
    console.log(`  ${jsonPath}`)
    console.log(`  ${mdPath}`)
}

main().catch((e) => {
    console.error('[measure-variety-offline] fatal:', e)
    process.exit(1)
})
