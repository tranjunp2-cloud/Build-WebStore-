/**
 * A2 theme fallback hardening — verify fallback is light neutral (not dark
 * cyan/magenta) and dev warn fires when resolver has to fill ≥2 critical
 * fields.
 *
 * Coverage: TC-F01-W.A2
 * Plan: plans/260417-0817-wave1-wix-detailed-plan/phase-02-A2-theme-fallback.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveTheme } from '@/lib/theme/resolve'

describe('TC-F01-W.A2 — fallback is light neutral', () => {
  it('empty input falls back to light slate, not dark cyan/magenta', () => {
    const result = resolveTheme({})
    expect(result.primaryColor).not.toBe('#0ea5e9')
    expect(result.secondaryColor).not.toBe('#d946ef')
    expect(result.colorMode).toBe('light')
    expect(result.primaryColor).toBe('#111827')
    expect(result.secondaryColor).toBe('#374151')
  })

  it('light-mode derived tokens render over white background', () => {
    const result = resolveTheme({})
    expect(result.backgroundColor).toBe('#ffffff')
    expect(result.textColor).toBe('#09090b')
    expect(result.surfaceColor).toBe('#f8f8f8')
  })

  it('explicit dark colorMode still works', () => {
    const result = resolveTheme({ colorMode: 'dark', primaryColor: '#9333ea' })
    expect(result.colorMode).toBe('dark')
    expect(result.primaryColor).toBe('#9333ea')
    expect(result.backgroundColor).toBe('#09090b')
  })
})

describe('TC-F01-W.A2 — dev warn on partial palette', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  beforeEach(() => { warnSpy.mockClear() })
  afterEach(() => { vi.restoreAllMocks() })

  it('warns when resolver fills ≥2 critical fields', () => {
    resolveTheme({ primaryColor: '#ff0000' })
    const themeWarnings = warnSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((msg) => msg.includes('[theme]'))
    expect(themeWarnings.length).toBeGreaterThan(0)
    expect(themeWarnings[0]).toContain('secondaryColor')
    expect(themeWarnings[0]).toContain('colorMode')
  })

  it('does not warn when palette is mostly complete', () => {
    resolveTheme({ primaryColor: '#ff0000', colorMode: 'light', backgroundColor: '#fff' })
    const themeWarnings = warnSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((msg) => msg.includes('[theme] resolveTheme filling'))
    expect(themeWarnings).toHaveLength(0)
  })
})
