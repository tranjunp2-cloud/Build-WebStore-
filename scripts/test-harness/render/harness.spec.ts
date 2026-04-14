/**
 * Playwright spec — Phase 03 visual harness loop.
 *
 * Contract:
 *  - Reads `.harness-out/matrix.json` (written by `npm run harness:gen`).
 *  - For each fixture × project (desktop / mobile), navigates to the harness
 *    route `/test-harness/{fixtureId}`, waits for fonts + network idle, takes
 *    a full-page screenshot, runs the empty-hole detector, and pushes a
 *    record into the visual report.
 *  - On project teardown the report is flushed to
 *    `.harness-out/visual-report.json` so the report merger can pick it up.
 *
 * The dev server is NOT started here — Phase 05 workflow handles that
 * (so does the local `npm run harness:render` after a `npm run dev &`).
 */

import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { detectEmptyHole } from './empty-hole-detector'
import type { MatrixReport, HarnessResult } from '../types'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const MATRIX_PATH = path.resolve(REPO_ROOT, '.harness-out/matrix.json')
const SCREENSHOT_DIR = path.resolve(REPO_ROOT, '.harness-out/screenshots')

type VisualRecord = {
  fixtureId: string
  category: string
  variant: string
  project: string
  screenshotPath: string
  hasHole: boolean
  largestRegionRatio: number
  largestRegionHeightPx: number
  imageWidth: number
  imageHeight: number
}

function loadMatrix(): MatrixReport {
  if (!fs.existsSync(MATRIX_PATH)) {
    throw new Error(
      `[harness:render] matrix not found at ${MATRIX_PATH} — run \`npm run harness:gen\` first`,
    )
  }
  return JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8')) as MatrixReport
}

/** Skip composer-failed fixtures — there's nothing to render. */
function isRenderable(r: HarnessResult): boolean {
  return !r.composerError && r.blocks.length > 0
}

const matrix = loadMatrix()
const renderable = matrix.results.filter(isRenderable)

// In-memory accumulator. Each Playwright worker is its OWN process, so this
// `records` array is per-worker. We flush to a per-project + per-worker file
// in afterAll; visual-report.ts (the merger) globs them all together.
const records: VisualRecord[] = []

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
})

test.afterAll(async ({}, testInfo) => {
  // Per-project + per-worker filename to avoid races when multiple workers
  // (or projects) write concurrently. The merger picks them all up.
  const projectName = testInfo.project.name
  const workerIdx = testInfo.workerIndex
  const outPath = path.resolve(
    REPO_ROOT,
    `.harness-out/visual-report.${projectName}.w${workerIdx}.json`,
  )
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        project: projectName,
        workerIndex: workerIdx,
        records,
      },
      null,
      2,
    ),
    'utf8',
  )
})

for (const result of renderable) {
  const { fixture } = result
  test(`render ${fixture.id}`, async ({ page }, testInfo) => {
    const viewport = page.viewportSize()
    const viewportHeight = viewport?.height ?? 800

    await page.goto(`/test-harness/${fixture.id}`, { waitUntil: 'networkidle' })
    // Actually await fonts.ready (returning the Promise to evaluate works;
    // waitForFunction would not — it would resolve immediately because a
    // returned Promise is truthy on first poll).
    await page.evaluate(() => document.fonts.ready)
    // Force layout settle: scroll to bottom then top to trigger lazy images.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(150)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(150)

    const screenshotPath = path.resolve(
      SCREENSHOT_DIR,
      `${fixture.id}.${testInfo.project.name}.png`,
    )
    const buffer = await page.screenshot({ fullPage: true, path: screenshotPath })

    const detected = detectEmptyHole(buffer, { viewportHeight })
    records.push({
      fixtureId: fixture.id,
      category: fixture.category,
      variant: fixture.variant,
      project: testInfo.project.name,
      screenshotPath: path.relative(REPO_ROOT, screenshotPath),
      hasHole: detected.hasHole,
      largestRegionRatio: detected.largestRegionRatio,
      largestRegionHeightPx: detected.largestRegionHeightPx,
      imageWidth: detected.imageWidth,
      imageHeight: detected.imageHeight,
    })

    // Soft assertion — we want the full matrix to render even with holes,
    // and let the merger / report layer surface the failures. Use expect.soft
    // so a hole flags the test as failed but doesn't stop the loop.
    expect.soft(detected.hasHole, `empty hole detected in ${fixture.id} (${testInfo.project.name})`).toBe(false)
  })
}
