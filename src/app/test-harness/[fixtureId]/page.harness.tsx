/**
 * AI Gen Test Harness — visual render route (Phase 03)
 *
 * Loads .harness-out/matrix.json from disk, finds the result matching
 * params.fixtureId, and renders it via SiteRenderer. Used by Playwright
 * to capture screenshots → empty-hole detector → visual-report.json.
 *
 * Route GATING: this file uses extension `.harness.tsx`. It is included in
 * Next's pageExtensions ONLY when `ENABLE_HARNESS=1` (see next.config.ts).
 * Production / staging builds never see this file → 0 risk of route exposure.
 *
 * To run locally:
 *   npm run harness:gen           # writes .harness-out/matrix.json
 *   ENABLE_HARNESS=1 npm run dev  # boots Next with route enabled
 *   curl http://localhost:3000/test-harness/<fixtureId>
 */

import fs from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import type { MatrixReport, HarnessResult } from '../../../../scripts/test-harness/types'

export const dynamic = 'force-dynamic'

type Params = { fixtureId: string }

let cachedMatrix: MatrixReport | null = null
let cachedMtimeMs = 0

function loadMatrix(): { matrix: MatrixReport | null; error?: string } {
  const matrixPath = path.resolve(process.cwd(), '.harness-out/matrix.json')
  if (!fs.existsSync(matrixPath)) return { matrix: null }
  const stat = fs.statSync(matrixPath)
  if (cachedMatrix && stat.mtimeMs === cachedMtimeMs) return { matrix: cachedMatrix }
  try {
    const raw = fs.readFileSync(matrixPath, 'utf8')
    cachedMatrix = JSON.parse(raw) as MatrixReport
    cachedMtimeMs = stat.mtimeMs
    return { matrix: cachedMatrix }
  } catch (err) {
    return { matrix: null, error: (err as Error).message }
  }
}

function findResult(matrix: MatrixReport, fixtureId: string): HarnessResult | null {
  return matrix.results.find((r) => r.fixture.id === fixtureId) ?? null
}

/** Flatten harness block shape (`{blockType, variant, data}`) → SiteRenderer
 *  expected shape (`{blockType, variant, ...data}`). Spread `data` first so a
 *  rogue `blockType`/`variant` key inside `data` cannot shadow ours. */
function flattenBlocks(result: HarnessResult): Record<string, unknown>[] {
  return result.blocks.map((b) => ({
    ...b.data,
    blockType: b.blockType,
    variant: b.variant,
  }))
}

export default async function HarnessFixturePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { fixtureId } = await params
  const { matrix, error } = loadMatrix()
  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: '#b91c1c' }}>
        <h1>harness matrix unreadable</h1>
        <pre>{error}</pre>
        <p>Re-run <code>npm run harness:gen</code> to rewrite <code>.harness-out/matrix.json</code>.</p>
      </div>
    )
  }
  if (!matrix) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace' }}>
        <h1>harness matrix not found</h1>
        <p>Run <code>npm run harness:gen</code> first to generate <code>.harness-out/matrix.json</code>.</p>
      </div>
    )
  }
  const result = findResult(matrix, fixtureId)
  if (!result) notFound()
  if (result.composerError) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: '#b91c1c' }}>
        <h1>composer error for {fixtureId}</h1>
        <pre>{result.composerError}</pre>
      </div>
    )
  }

  const layout = flattenBlocks(result)
  const site = { theme: result.theme as Record<string, unknown> }
  const page = { layout }

  return (
    <div data-harness-fixture={fixtureId}>
      <SiteRenderer site={site as never} page={page as never} />
    </div>
  )
}
