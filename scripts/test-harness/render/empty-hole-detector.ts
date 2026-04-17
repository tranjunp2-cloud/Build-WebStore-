/**
 * Empty-hole detector — Phase 03
 *
 * Pure function: take a PNG buffer, find vertical regions where the page is
 * suspiciously flat (low pixel variance + extreme brightness). Such regions
 * are the "Ben Ben" failure mode: middle blocks failed to render and we ship
 * a giant blank stripe between hero and footer.
 *
 * Algorithm (heuristic v1, will iterate):
 *   1. Decode PNG → RGB pixel grid.
 *   2. Skip a configurable top zone (the hero is intentionally fullscreen and
 *      often dark — false positives if we scan it).
 *   3. Slide a vertical window of `windowHeight` px over the remaining height,
 *      stride `stride` px. For each window:
 *        - sample 1 pixel per `sampleStride` columns × all rows,
 *        - compute mean brightness + variance over the sampled pixels.
 *   4. A window is "flat" when:
 *        variance < `flatVarianceThreshold`
 *        AND (mean < `darkMeanCutoff` OR mean > `brightMeanCutoff`)
 *   5. Merge contiguous flat windows → measure their total height.
 *   6. Hole detected when the largest contiguous flat run exceeds
 *      `holeRatio` × viewportHeight.
 *
 * The detector is intentionally simple and dependency-light (only `pngjs`).
 * It runs after each Playwright screenshot and is also unit-tested with
 * synthetic PNGs (see `empty-hole-detector.test.ts`).
 */

import { PNG } from 'pngjs'

export type DetectorOptions = {
  /** Skip this many top pixels — typical hero zone. Default 1× viewportHeight. */
  topSkipPx?: number
  /** Window height in px. Default 200. */
  windowHeight?: number
  /** Stride between window starts in px. Default 50. */
  stride?: number
  /** Sample 1 px per N columns. Default 8 (cheap). */
  sampleStride?: number
  /** A window is flat when its sample variance < this. Default 50. */
  flatVarianceThreshold?: number
  /** Below this mean brightness (0-255) the window counts as dark-flat. Default 30. */
  darkMeanCutoff?: number
  /** Above this mean brightness the window counts as bright-flat. Default 225. */
  brightMeanCutoff?: number
  /** Hole detected when largest flat run / viewportHeight > this ratio. Default 0.30. */
  holeRatio?: number
  /** The visible viewport height the screenshot was taken at — used for ratio
   *  calculation. If omitted, falls back to image height. */
  viewportHeight?: number
}

export type DetectorResult = {
  hasHole: boolean
  /** Largest contiguous flat run in pixels. */
  largestRegionHeightPx: number
  /** largestRegionHeightPx / viewportHeight (or image height). */
  largestRegionRatio: number
  /** Total flat px (sum of all flat regions, may overlap merged windows). */
  totalFlatPx: number
  /** The image dimensions for traceability. */
  imageWidth: number
  imageHeight: number
  /** The options actually used (after defaults applied). */
  effectiveOptions: Required<DetectorOptions>
}

const DEFAULTS: Required<DetectorOptions> = {
  topSkipPx: 0, // resolved below
  windowHeight: 200,
  stride: 50,
  sampleStride: 8,
  flatVarianceThreshold: 50,
  darkMeanCutoff: 30,
  brightMeanCutoff: 225,
  holeRatio: 0.3,
  viewportHeight: 0,
}

export function detectEmptyHole(
  pngBuffer: Buffer,
  opts: DetectorOptions = {},
): DetectorResult {
  const png = PNG.sync.read(pngBuffer)
  const width = png.width
  const height = png.height
  const data = png.data // RGBA, length = width * height * 4

  const viewportHeight = opts.viewportHeight ?? height
  // Default topSkipPx = 1 viewport (hero zone) but never more than 50% of the
  // image — otherwise callers that pass a giant viewportHeight by mistake (or
  // omit viewportHeight on a full-page screenshot) would skip the entire
  // image and silently return hasHole:false (footgun).
  const defaultTopSkip = Math.min(viewportHeight, Math.floor(height * 0.5))
  const effective: Required<DetectorOptions> = {
    ...DEFAULTS,
    ...opts,
    viewportHeight,
    topSkipPx: opts.topSkipPx ?? defaultTopSkip,
  }

  // Clamp scan range
  const scanStart = Math.max(0, Math.min(effective.topSkipPx, height))
  const scanEnd = height
  if (scanStart >= scanEnd || scanEnd - scanStart < effective.windowHeight) {
    return zeroResult(width, height, effective)
  }

  // Walk windows
  const flatStarts: Array<{ start: number; end: number }> = []
  for (let y = scanStart; y + effective.windowHeight <= scanEnd; y += effective.stride) {
    if (isFlatWindow(data, width, y, effective)) {
      flatStarts.push({ start: y, end: y + effective.windowHeight })
    }
  }

  // Merge contiguous/overlapping flat windows
  const merged = mergeWindows(flatStarts)
  let largest = 0
  let totalFlat = 0
  for (const m of merged) {
    const h = m.end - m.start
    if (h > largest) largest = h
    totalFlat += h
  }

  const ratio = viewportHeight > 0 ? largest / viewportHeight : 0
  return {
    hasHole: ratio > effective.holeRatio,
    largestRegionHeightPx: largest,
    largestRegionRatio: ratio,
    totalFlatPx: totalFlat,
    imageWidth: width,
    imageHeight: height,
    effectiveOptions: effective,
  }
}

function zeroResult(
  width: number,
  height: number,
  effective: Required<DetectorOptions>,
): DetectorResult {
  return {
    hasHole: false,
    largestRegionHeightPx: 0,
    largestRegionRatio: 0,
    totalFlatPx: 0,
    imageWidth: width,
    imageHeight: height,
    effectiveOptions: effective,
  }
}

function isFlatWindow(
  data: Buffer,
  width: number,
  yStart: number,
  effective: Required<DetectorOptions>,
): boolean {
  // Sample every sampleStride column × every row in window. Compute brightness
  // mean + variance via Welford for stability + speed.
  let n = 0
  let mean = 0
  let m2 = 0
  const yEnd = yStart + effective.windowHeight
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < width; x += effective.sampleStride) {
      const i = (y * width + x) * 4
      // Luma approximation — eye-weighted RGB → brightness 0..255
      const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
      n++
      const delta = luma - mean
      mean += delta / n
      m2 += delta * (luma - mean)
    }
  }
  if (n < 2) return false
  const variance = m2 / (n - 1)

  const isDarkFlat = mean < effective.darkMeanCutoff
  const isBrightFlat = mean > effective.brightMeanCutoff
  return variance < effective.flatVarianceThreshold && (isDarkFlat || isBrightFlat)
}

function mergeWindows(
  windows: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  if (windows.length === 0) return []
  // Already in y-ascending order by construction. Merge overlaps.
  const out: Array<{ start: number; end: number }> = []
  let cur = { ...windows[0]! }
  for (let i = 1; i < windows.length; i++) {
    const w = windows[i]!
    if (w.start <= cur.end) {
      // overlap or touching → extend
      cur.end = Math.max(cur.end, w.end)
    } else {
      out.push(cur)
      cur = { ...w }
    }
  }
  out.push(cur)
  return out
}
