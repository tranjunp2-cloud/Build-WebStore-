/**
 * Harness CLI — Phase 01 entry point.
 *
 * Usage:
 *   pnpm tsx scripts/test-harness/cli.ts --mode=quick
 *   pnpm tsx scripts/test-harness/cli.ts --mode=full
 *   pnpm tsx scripts/test-harness/cli.ts --categories=restaurant,tech --seeds=3
 *
 * Output: .harness-out/matrix.json
 */

// Must run before registry/composer imports in standalone Node.
import './register-css.cjs'

import * as fs from 'node:fs'
import * as path from 'node:path'
import { buildMatrix, type BuildMatrixOpts } from './matrix'
import { invokeComposer } from './compose-runner'
import { validateAllPresets } from './validate-presets'
import type { HarnessMode, HarnessResult, MatrixReport } from './types'

type CliArgs = {
  mode: HarnessMode
  categories?: string[]
  variants?: Array<'starter' | 'professional' | 'premium'>
  seeds?: number
  out: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {}
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) args[m[1]!] = m[2] ?? 'true'
  }
  const mode = (args.mode as HarnessMode) ?? 'quick'
  return {
    mode,
    categories: args.categories?.split(',').map((s) => s.trim()),
    variants: args.variants?.split(',') as CliArgs['variants'],
    seeds: args.seeds ? Number(args.seeds) : undefined,
    out: args.out ?? path.resolve(process.cwd(), '.harness-out/matrix.json'),
  }
}

async function main() {
  const args = parseArgs(process.argv)
  console.log(
    `[harness] mode=${args.mode} categories=${args.categories ?? 'all'} seeds=${args.seeds ?? 'default'}`,
  )

  const opts: BuildMatrixOpts = {
    mode: args.mode,
    categories: args.categories,
    variants: args.variants,
    seedsPerCell: args.seeds,
  }
  // Fail fast: catch invalid/default variants before generating 280 fixtures
  validateAllPresets()

  const fixtures = buildMatrix(opts)
  console.log(`[harness] built ${fixtures.length} fixtures`)

  const results: HarnessResult[] = []
  const startedAt = Date.now()
  let composed = 0
  let errors = 0

  for (const fixture of fixtures) {
    const r = invokeComposer(fixture)
    results.push(r)
    if (r.composerError) {
      errors++
      console.warn(
        `[harness] FAIL ${fixture.id} — ${r.composerError.slice(0, 140)}`,
      )
    } else {
      composed++
      if (composed % 20 === 0 || args.mode === 'quick') {
        console.log(
          `[harness] ok ${fixture.id} (${r.blocks.length} blocks, ${r.durationMs}ms)`,
        )
      }
    }
  }

  const totalDurationMs = Date.now() - startedAt

  const report: MatrixReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: args.mode,
    opts: {
      categories: args.categories ?? [],
      variants: args.variants ?? [],
      seedsPerCell: args.seeds ?? 0,
    },
    summary: {
      total: fixtures.length,
      composed,
      composerErrors: errors,
      totalDurationMs,
    },
    results,
  }

  // Ensure output dir exists
  fs.mkdirSync(path.dirname(args.out), { recursive: true })
  fs.writeFileSync(args.out, JSON.stringify(report, null, 2), 'utf8')

  console.log(
    `\n[harness] summary: total=${fixtures.length} composed=${composed} errors=${errors} durationMs=${totalDurationMs}`,
  )
  console.log(`[harness] wrote ${args.out}`)

  if (errors > 0) {
    console.error(
      `[harness] ${errors} fixtures failed to compose — matrix.json still written for Phase 02 to analyse`,
    )
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[harness] fatal:', err)
  process.exit(2)
})
