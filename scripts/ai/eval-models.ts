/**
 * Phase-01 eval harness — A/B compare 4 models on site generation quality.
 *
 * Runs identical BusinessInfoInput across:
 *   - gpt-4o (baseline, current prod)
 *   - gpt-4.1-mini (proposed primary)
 *   - gpt-5.4-mini (proposed fallback)
 *   - gpt-4o-mini (for completeness — not recommended)
 *
 * For each (model × input × run), captures:
 *   - valid: did output parse as JSON + have blocks array
 *   - blocks: count + block types (for combo diversity)
 *   - tokens: prompt/completion/total
 *   - cost_usd: computed from model pricing table
 *   - latency_ms
 *   - finish_reason
 *
 * Writes:
 *   plans/260414-0914-ai-model-optimization/reports/eval-<date>.json (raw)
 *   plans/260414-0914-ai-model-optimization/reports/eval-<date>.md   (summary)
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... pnpm exec tsx scripts/ai/eval-models.ts
 *
 * Optional env:
 *   EVAL_RUNS_PER_MODEL=10   (override runs, default 10)
 *   EVAL_SKIP_5_4_MINI=1     (skip gpt-5.4-mini if not available on account)
 */

import OpenAI from 'openai'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { buildSystemPrompt, buildUserPrompt, type BusinessInfoInput } from '../../src/lib/ai/system-prompt'

// ── Config ───────────────────────────────────────────────────────────────────

type ModelId = 'gpt-4o' | 'gpt-4.1-mini' | 'gpt-5.4-mini' | 'gpt-4o-mini'

// Pricing per 1M tokens (input / output) — source: research-01-openai-models-2026.md
const PRICING: Record<ModelId, { input: number; output: number }> = {
    'gpt-4o':         { input: 2.50,  output: 10.00 },
    'gpt-4.1-mini':   { input: 0.20,  output: 0.80 },
    'gpt-5.4-mini':   { input: 0.75,  output: 4.50 },
    'gpt-4o-mini':    { input: 0.15,  output: 0.60 },
}

const CANONICAL_INPUTS: Array<{ id: string; info: BusinessInfoInput; language: 'en' | 'ms' | 'vi' | 'auto' }> = [
    {
        id: 'restaurant-my',
        language: 'en',
        info: {
            businessName: 'Nasi Lemak Corner',
            industry: 'restaurant',
            products: 'nasi lemak, teh tarik, roti canai, satay',
            shortDescription: 'Family restaurant in KL Sentral serving traditional Malay breakfast and lunch since 2015',
        },
    },
    {
        id: 'tech-startup-vn',
        language: 'en',
        info: {
            businessName: 'TaskFlow',
            industry: 'tech saas',
            products: 'task management app, team collaboration, automation workflows',
            shortDescription: 'SaaS task management for solo founders, $19/month, integrates with Slack and GitHub',
        },
    },
    {
        id: 'fashion-boutique-en',
        language: 'en',
        info: {
            businessName: 'Ember Boutique',
            industry: 'fashion ecommerce',
            products: 'handmade dresses, organic cotton tees, sustainable denim',
            shortDescription: 'Sustainable handmade fashion in London, organic materials, ethical production',
        },
    },
]

const RUNS_PER_MODEL = Number(process.env.EVAL_RUNS_PER_MODEL || 10)
const SKIP_5_4_MINI = process.env.EVAL_SKIP_5_4_MINI === '1'

const MODELS: ModelId[] = SKIP_5_4_MINI
    ? ['gpt-4o', 'gpt-4.1-mini', 'gpt-4o-mini']
    : ['gpt-4o', 'gpt-4.1-mini', 'gpt-5.4-mini', 'gpt-4o-mini']

// ── Result capture ───────────────────────────────────────────────────────────

type RunResult = {
    model: ModelId
    inputId: string
    run: number
    valid: boolean
    blockCount: number
    blockTypes: string[]
    comboHash: string
    pageCount: number
    tokensIn: number
    tokensOut: number
    costUsd: number
    latencyMs: number
    finishReason: string | null
    error?: string
}

function hashCombo(blockTypes: string[]): string {
    // Sort + join so "same set different order" still matches
    return blockTypes.slice().sort().join('|')
}

function estimateCost(model: ModelId, tokensIn: number, tokensOut: number): number {
    const p = PRICING[model]
    return (tokensIn * p.input + tokensOut * p.output) / 1_000_000
}

// ── Single call ──────────────────────────────────────────────────────────────

async function runOnce(
    openai: OpenAI,
    model: ModelId,
    input: (typeof CANONICAL_INPUTS)[number],
    run: number,
): Promise<RunResult> {
    const start = Date.now()
    const systemPrompt = buildSystemPrompt(input.language)
    const userPrompt = buildUserPrompt(input.info, undefined, input.language)

    try {
        const completion = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
        })

        const latencyMs = Date.now() - start
        const content = completion.choices[0]?.message?.content ?? ''
        const finishReason = completion.choices[0]?.finish_reason ?? null
        const tokensIn = completion.usage?.prompt_tokens ?? 0
        const tokensOut = completion.usage?.completion_tokens ?? 0
        const costUsd = estimateCost(model, tokensIn, tokensOut)

        let parsed: unknown
        let valid = false
        let blockCount = 0
        let blockTypes: string[] = []
        let pageCount = 0
        try {
            parsed = JSON.parse(content)
            const obj = parsed as Record<string, unknown>

            // Multi-page format: pages[].blocks[]
            if (Array.isArray(obj.pages)) {
                pageCount = obj.pages.length
                const allBlocks: Record<string, unknown>[] = []
                for (const page of obj.pages) {
                    const pageBlocks = (page as Record<string, unknown>).blocks
                    if (Array.isArray(pageBlocks)) allBlocks.push(...(pageBlocks as Record<string, unknown>[]))
                }
                blockCount = allBlocks.length
                blockTypes = allBlocks
                    .map((b) => (typeof b.blockType === 'string' ? b.blockType : ''))
                    .filter(Boolean)
                valid = blockCount > 0
            }
            // Single-page backward compat: blocks[]
            else if (Array.isArray(obj.blocks)) {
                pageCount = 1
                blockCount = (obj.blocks as unknown[]).length
                blockTypes = (obj.blocks as Record<string, unknown>[])
                    .map((b) => (typeof b.blockType === 'string' ? b.blockType : ''))
                    .filter(Boolean)
                valid = blockCount > 0
            }
        } catch {
            valid = false
        }

        return {
            model,
            inputId: input.id,
            run,
            valid,
            blockCount,
            blockTypes,
            comboHash: hashCombo(blockTypes),
            pageCount,
            tokensIn,
            tokensOut,
            costUsd,
            latencyMs,
            finishReason,
        }
    } catch (err) {
        const latencyMs = Date.now() - start
        return {
            model,
            inputId: input.id,
            run,
            valid: false,
            blockCount: 0,
            blockTypes: [],
            comboHash: '',
            pageCount: 0,
            tokensIn: 0,
            tokensOut: 0,
            costUsd: 0,
            latencyMs,
            finishReason: null,
            error: err instanceof Error ? err.message : String(err),
        }
    }
}

// ── Aggregation ──────────────────────────────────────────────────────────────

type ModelAggregate = {
    model: ModelId
    totalRuns: number
    validRuns: number
    validityPct: number
    avgBlockCount: number
    uniqueCombos: number
    diversityPct: number
    avgLatencyMs: number
    p95LatencyMs: number
    totalTokensIn: number
    totalTokensOut: number
    totalCostUsd: number
    avgCostPerRun: number
    errors: string[]
}

function aggregate(results: RunResult[], model: ModelId): ModelAggregate {
    const rows = results.filter((r) => r.model === model)
    const valid = rows.filter((r) => r.valid)
    const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b)
    const p95Idx = Math.floor(latencies.length * 0.95)
    const uniqueCombos = new Set(rows.filter((r) => r.valid).map((r) => r.comboHash))
    const totalIn = rows.reduce((s, r) => s + r.tokensIn, 0)
    const totalOut = rows.reduce((s, r) => s + r.tokensOut, 0)
    const totalCost = rows.reduce((s, r) => s + r.costUsd, 0)
    const errors = rows.filter((r) => r.error).map((r) => `${r.inputId}#${r.run}: ${r.error}`)

    return {
        model,
        totalRuns: rows.length,
        validRuns: valid.length,
        validityPct: rows.length > 0 ? (valid.length / rows.length) * 100 : 0,
        avgBlockCount: valid.length > 0 ? valid.reduce((s, r) => s + r.blockCount, 0) / valid.length : 0,
        uniqueCombos: uniqueCombos.size,
        diversityPct: rows.length > 0 ? (uniqueCombos.size / rows.length) * 100 : 0,
        avgLatencyMs: rows.length > 0 ? rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length : 0,
        p95LatencyMs: latencies[p95Idx] ?? 0,
        totalTokensIn: totalIn,
        totalTokensOut: totalOut,
        totalCostUsd: totalCost,
        avgCostPerRun: rows.length > 0 ? totalCost / rows.length : 0,
        errors,
    }
}

// ── Report ───────────────────────────────────────────────────────────────────

function buildMarkdownReport(aggregates: ModelAggregate[], runDate: string): string {
    const sorted = aggregates.slice().sort((a, b) => b.validityPct - a.validityPct)

    const table = sorted
        .map((a) =>
            `| ${a.model} | ${a.validityPct.toFixed(1)}% | ${a.avgBlockCount.toFixed(1)} | ${a.uniqueCombos}/${a.totalRuns} | ${a.avgLatencyMs.toFixed(0)}ms | ${a.p95LatencyMs.toFixed(0)}ms | $${a.avgCostPerRun.toFixed(5)} | $${a.totalCostUsd.toFixed(4)} |`,
        )
        .join('\n')

    const errorList = sorted
        .filter((a) => a.errors.length > 0)
        .map((a) => `### ${a.model}\n${a.errors.map((e) => `- \`${e}\``).join('\n')}`)
        .join('\n\n')

    const recommendation = buildRecommendation(sorted)

    return `# AI Model Eval Report — ${runDate}

Source: plans/260414-0914-ai-model-optimization/phase-01-eval-harness.md
Runs per model: ${sorted[0]?.totalRuns ?? 0}
Inputs: ${CANONICAL_INPUTS.map((i) => i.id).join(', ')}

## Summary table

| Model | Validity | Avg blocks | Diversity | Avg latency | p95 latency | Cost/run | Total cost |
|---|---|---|---|---|---|---|---|
${table}

## Thresholds (per plan phase-01)
- Validity ≥ 95% ✓ / ✗
- Diversity ≥ 6/10 unique combos ✓ / ✗
- p95 latency < 30s ✓ / ✗

## Recommendation

${recommendation}

${errorList ? `## Errors\n\n${errorList}\n` : ''}
---
Generated by scripts/ai/eval-models.ts
`
}

function buildRecommendation(sorted: ModelAggregate[]): string {
    const thresholds = (a: ModelAggregate) =>
        a.validityPct >= 95 && a.diversityPct >= 60 && a.p95LatencyMs < 30_000

    const passed = sorted.filter(thresholds)

    if (passed.length === 0) {
        return '❌ **No model passed all thresholds.** Manual review required.'
    }

    // Pick cheapest passing model as primary, 2nd cheapest as fallback
    const byCost = passed.slice().sort((a, b) => a.avgCostPerRun - b.avgCostPerRun)
    const primary = byCost[0]!
    const fallback = byCost[1]

    const lines: string[] = []
    lines.push(`✅ **Primary: \`${primary.model}\`** — passes all thresholds, cheapest.`)
    lines.push(`   - Validity ${primary.validityPct.toFixed(1)}%, diversity ${primary.uniqueCombos}/${primary.totalRuns}, $${primary.avgCostPerRun.toFixed(5)}/run`)
    if (fallback) {
        lines.push(`\n✅ **Fallback: \`${fallback.model}\`** — 2nd cheapest passing model.`)
        lines.push(`   - Validity ${fallback.validityPct.toFixed(1)}%, diversity ${fallback.uniqueCombos}/${fallback.totalRuns}, $${fallback.avgCostPerRun.toFixed(5)}/run`)
    }
    return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY not set. Export it or put in .env.local and source.')
        process.exit(1)
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    console.log(`🔬 Eval starting — ${MODELS.length} models × ${CANONICAL_INPUTS.length} inputs × ${RUNS_PER_MODEL} runs`)
    console.log(`   Models: ${MODELS.join(', ')}`)
    console.log(`   Inputs: ${CANONICAL_INPUTS.map((i) => i.id).join(', ')}`)
    console.log(`   Total calls: ${MODELS.length * CANONICAL_INPUTS.length * RUNS_PER_MODEL}`)
    console.log('')

    const results: RunResult[] = []
    let callNum = 0
    const totalCalls = MODELS.length * CANONICAL_INPUTS.length * RUNS_PER_MODEL

    for (const model of MODELS) {
        for (const input of CANONICAL_INPUTS) {
            for (let run = 1; run <= RUNS_PER_MODEL; run++) {
                callNum++
                process.stdout.write(`  [${callNum}/${totalCalls}] ${model} × ${input.id} × run ${run}... `)
                const result = await runOnce(openai, model, input, run)
                if (result.valid) {
                    console.log(`✓ ${result.blockCount} blocks, ${result.latencyMs}ms, $${result.costUsd.toFixed(5)}`)
                } else if (result.error) {
                    console.log(`✗ ERROR: ${result.error.slice(0, 80)}`)
                } else {
                    console.log(`✗ INVALID JSON, ${result.latencyMs}ms`)
                }
                results.push(result)
            }
        }
    }

    // Aggregate per model
    const aggregates = MODELS.map((m) => aggregate(results, m))

    // Write JSON + Markdown
    const runDate = new Date().toISOString().slice(0, 10)
    const reportsDir = 'plans/260414-0914-ai-model-optimization/reports'
    await mkdir(reportsDir, { recursive: true })

    const jsonPath = join(reportsDir, `eval-${runDate}.json`)
    const mdPath = join(reportsDir, `eval-${runDate}.md`)

    await writeFile(
        jsonPath,
        JSON.stringify({ runDate, config: { models: MODELS, inputs: CANONICAL_INPUTS.map((i) => i.id), runsPerModel: RUNS_PER_MODEL }, aggregates, rawResults: results }, null, 2),
    )
    await writeFile(mdPath, buildMarkdownReport(aggregates, runDate))

    console.log('')
    console.log(`📊 Aggregates:`)
    for (const agg of aggregates) {
        console.log(`   ${agg.model.padEnd(16)} validity=${agg.validityPct.toFixed(0)}% blocks=${agg.avgBlockCount.toFixed(1)} diversity=${agg.uniqueCombos}/${agg.totalRuns} p95=${agg.p95LatencyMs}ms $${agg.totalCostUsd.toFixed(4)}`)
    }

    const totalCost = aggregates.reduce((s, a) => s + a.totalCostUsd, 0)
    console.log('')
    console.log(`💰 Total spend: $${totalCost.toFixed(4)}`)
    console.log(`📝 Report: ${mdPath}`)
    console.log(`📝 Raw:    ${jsonPath}`)
}

main().catch((err) => {
    console.error('❌ Eval crashed:', err)
    process.exit(1)
})
