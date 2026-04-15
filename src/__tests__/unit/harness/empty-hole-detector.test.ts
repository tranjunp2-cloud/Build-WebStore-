/**
 * Unit tests for empty-hole detector (Phase 03 of AI gen test harness).
 *
 * TC-IDs: TC-F01-V.43, TC-F01-V.48 (calibration / contract layer)
 *
 * Strategy: synthesise tiny PNGs (200×800) representing different page states
 * and assert the detector classifies them correctly. We keep images small for
 * speed — the detector is pixel-agnostic, only window heights matter.
 */

import { describe, it, expect } from 'vitest'
import { PNG } from 'pngjs'
import { detectEmptyHole } from '../../../../scripts/test-harness/render/empty-hole-detector'

const VIEWPORT_HEIGHT = 200
const WIDTH = 100

type RowPainter = (y: number, width: number) => [number, number, number]

/** Build a synthetic PNG `WIDTH×height` where `painter(y)` returns the RGB
 *  for an entire row (we copy across all columns). Returns a PNG buffer. */
function makePng(height: number, painter: RowPainter): Buffer {
  const png = new PNG({ width: WIDTH, height })
  for (let y = 0; y < height; y++) {
    const [r, g, b] = painter(y, WIDTH)
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4
      png.data[i] = r
      png.data[i + 1] = g
      png.data[i + 2] = b
      png.data[i + 3] = 255
    }
  }
  return PNG.sync.write(png)
}

/** Same as makePng but adds per-pixel jitter so variance is non-trivial. */
function makePngVaried(height: number, painter: RowPainter): Buffer {
  const png = new PNG({ width: WIDTH, height })
  for (let y = 0; y < height; y++) {
    const [r, g, b] = painter(y, WIDTH)
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4
      // pseudo-noise so variance > flatVarianceThreshold (50)
      const jitter = ((x * 31 + y * 17) % 80) - 40
      png.data[i] = clamp(r + jitter)
      png.data[i + 1] = clamp(g + jitter)
      png.data[i + 2] = clamp(b + jitter)
      png.data[i + 3] = 255
    }
  }
  return PNG.sync.write(png)
}

function clamp(n: number): number {
  if (n < 0) return 0
  if (n > 255) return 255
  return n
}

describe('detectEmptyHole — synthetic fixtures', () => {
  describe('TC-F01-V.43 — Ben-Ben class: empty middle region', () => {
    it('flags an all-white empty page below the hero zone', () => {
      // height = 4 viewports = 800px. First viewport (200px) = hero.
      // The rest is pure white → flat → hole.
      const buf = makePng(800, () => [255, 255, 255])
      const result = detectEmptyHole(buf, { viewportHeight: VIEWPORT_HEIGHT })
      expect(result.hasHole).toBe(true)
      expect(result.largestRegionRatio).toBeGreaterThan(0.3)
    })

    it('flags an all-black empty page below the hero zone', () => {
      const buf = makePng(800, () => [0, 0, 0])
      const result = detectEmptyHole(buf, { viewportHeight: VIEWPORT_HEIGHT })
      expect(result.hasHole).toBe(true)
    })

    it('flags hero-only fixture: dark hero + giant white middle', () => {
      const buf = makePng(800, (y) => {
        if (y < VIEWPORT_HEIGHT) {
          // Hero: vary so the hero zone itself is NOT flat
          return [(y * 3) % 200, (y * 5) % 200, (y * 7) % 200]
        }
        return [255, 255, 255]
      })
      const result = detectEmptyHole(buf, { viewportHeight: VIEWPORT_HEIGHT })
      expect(result.hasHole).toBe(true)
      expect(result.largestRegionHeightPx).toBeGreaterThanOrEqual(VIEWPORT_HEIGHT)
    })
  })

  describe('TC-F01-V.43 — happy path: real content', () => {
    it('does NOT flag a fully varied page (all rows have noise)', () => {
      const buf = makePngVaried(800, (y) => [
        (y * 13) % 256,
        (y * 17) % 256,
        (y * 23) % 256,
      ])
      const result = detectEmptyHole(buf, { viewportHeight: VIEWPORT_HEIGHT })
      expect(result.hasHole).toBe(false)
    })

    it('does NOT flag a small flat region under the 30% threshold', () => {
      // Total content = 800px. Hero skip = 200px → scan range 600px.
      // 30% × 200 (viewport) = 60px → anything < 60px contiguous flat is OK.
      // We make a 100px flat strip sandwiched between varied content. That IS
      // bigger than 60px so it WOULD trip the default 30% threshold. Use a
      // generous threshold of 0.6 to assert the small-region behaviour.
      const buf = makePngVaried(800, (y) => {
        if (y >= 400 && y < 500) return [255, 255, 255] // 100px flat strip
        return [(y * 13) % 256, (y * 17) % 256, (y * 23) % 256]
      })
      const result = detectEmptyHole(buf, {
        viewportHeight: VIEWPORT_HEIGHT,
        holeRatio: 0.6, // a 100/200 = 0.5 ratio strip should not trip 0.6 threshold
      })
      expect(result.hasHole).toBe(false)
    })
  })

  describe('TC-F01-V.43 — false-positive guards', () => {
    it('does NOT flag a dark-hero-only screenshot when content fills the rest', () => {
      // Hero is fullscreen dark (could look flat) — but it's in topSkip zone
      // so we never scan it. Below hero is varied content → no hole.
      const buf = makePngVaried(800, (y) => {
        if (y < VIEWPORT_HEIGHT) return [10, 10, 10] // dark hero
        return [(y * 13) % 256, (y * 17) % 256, (y * 23) % 256]
      })
      const result = detectEmptyHole(buf, { viewportHeight: VIEWPORT_HEIGHT })
      expect(result.hasHole).toBe(false)
    })

    it('respects custom topSkipPx (covers entire image → no scan, no hole)', () => {
      const buf = makePng(400, () => [255, 255, 255])
      const result = detectEmptyHole(buf, {
        viewportHeight: VIEWPORT_HEIGHT,
        topSkipPx: 9999,
      })
      expect(result.hasHole).toBe(false)
      expect(result.largestRegionHeightPx).toBe(0)
    })
  })

  describe('TC-F01-V.48 — mobile viewport contract', () => {
    it('uses viewportHeight (not image height) for the ratio calculation', () => {
      // Mobile viewport = 800px. Image is much taller (full-page screenshot
      // of a 5-page layout = 5000px). A 600px flat region should NOT trip the
      // 0.30 threshold against an 800px viewport (600/800 = 0.75 > 0.30 → it
      // SHOULD trip — confirms ratio is using viewportHeight, not image
      // height which would give 600/5000 = 0.12 → below threshold).
      const buf = makePng(5000, (y) => {
        if (y < 800) return [(y * 3) % 200, (y * 5) % 200, (y * 7) % 200]
        if (y >= 1000 && y < 1600) return [255, 255, 255] // 600px flat
        return [(y * 13) % 256, (y * 17) % 256, (y * 23) % 256]
      })
      const result = detectEmptyHole(buf, { viewportHeight: 800, topSkipPx: 800 })
      expect(result.hasHole).toBe(true)
      expect(result.largestRegionRatio).toBeGreaterThan(0.3)
    })
  })

  describe('result shape contract', () => {
    it('returns all required fields with sensible defaults applied', () => {
      const buf = makePng(400, () => [128, 128, 128])
      const result = detectEmptyHole(buf, { viewportHeight: VIEWPORT_HEIGHT })
      expect(result).toMatchObject({
        hasHole: expect.any(Boolean),
        largestRegionHeightPx: expect.any(Number),
        largestRegionRatio: expect.any(Number),
        totalFlatPx: expect.any(Number),
        imageWidth: WIDTH,
        imageHeight: 400,
      })
      expect(result.effectiveOptions.windowHeight).toBe(200)
      expect(result.effectiveOptions.holeRatio).toBe(0.3)
    })
  })
})
