/**
 * Template drift validator tests — ensures TEMPLATE_PRESETS block refs
 * stay in sync with the live block registry.
 *
 * Coverage: TC-F01-D.01 (template-first gen drift detection)
 * Plan: plans/260419-2022-GH-1-harness-template-block-sync-flow/phase-02-extend-drift-detection.md
 */

import { describe, expect, it } from 'vitest'

import { scanTsTemplates, validateBlockRef } from '@/lib/ai/template-drift-validator'
import { blockRegistry } from '@/blocks/registry'

describe('TC-F01-D.01 — template drift validator', () => {
  // ── validateBlockRef — unit checks ─────────────────────────────────────────

  it('returns unknown-block finding when blockType is not registered', () => {
    const finding = validateBlockRef(
      { blockType: 'nonexistent-block' },
      { source: 'ts', templateId: 'fake:/home' },
    )
    expect(finding).not.toBeNull()
    expect(finding?.issue).toBe('unknown-block')
    expect(finding?.blockType).toBe('nonexistent-block')
    expect(finding?.source).toBe('ts')
    expect(finding?.templateId).toBe('fake:/home')
  })

  it('returns unknown-variant finding with expected variants populated', () => {
    const finding = validateBlockRef(
      { blockType: 'hero', variant: 'not-a-real-variant' },
      { source: 'ts', templateId: 'fake:/home' },
    )
    expect(finding).not.toBeNull()
    expect(finding?.issue).toBe('unknown-variant')
    expect(finding?.variant).toBe('not-a-real-variant')
    expect(Array.isArray(finding?.expected)).toBe(true)
    expect(finding?.expected?.length ?? 0).toBeGreaterThan(0)
    // Known valid variants per src/blocks/hero/config.ts heroMeta
    expect(finding?.expected).toContain('centered')
  })

  it('returns schema-drift finding when required props are missing', () => {
    // CTA requires `headline`, `ctaLabel`, `ctaUrl`. Provide only blockType
    // so Zod reports invalid_type (expected string, got undefined).
    const finding = validateBlockRef(
      { blockType: 'cta', variant: 'banner' },
      { source: 'ts', templateId: 'fake:/home' },
    )
    expect(finding).not.toBeNull()
    expect(finding?.issue).toBe('schema-drift')
    expect(Array.isArray(finding?.zodIssues)).toBe(true)
    expect(finding?.zodIssues?.length ?? 0).toBeGreaterThan(0)
  })

  it('returns null for a valid ref with all required props supplied', () => {
    // Minimal valid CTA — all required strings present.
    const finding = validateBlockRef(
      {
        blockType: 'cta',
        variant: 'banner',
        headline: 'Start now',
        ctaLabel: 'Sign up',
        ctaUrl: '/signup',
      },
      { source: 'ts', templateId: 'fake:/home' },
    )
    expect(finding).toBeNull()
  })

  it('returns null for a valid hero ref with variant + required headline', () => {
    const finding = validateBlockRef(
      {
        blockType: 'hero',
        variant: 'centered',
        headline: 'Welcome',
      },
      { source: 'ts', templateId: 'fake:/home' },
    )
    expect(finding).toBeNull()
  })

  // ── scanTsTemplates — codebase-wide check ──────────────────────────────────

  // Baseline of known pre-existing drift on `main` when Phase 02 landed
  // (plan 260419-2022 — harness-template-block-sync-flow). This gate holds
  // the line: the count may only DECREASE as later phases fix templates.
  // When count drops, lower this number; never raise it without plan sign-off.
  const BASELINE_DRIFT_COUNT = 800

  it('TEMPLATE_PRESETS drift count does not exceed baseline', () => {
    const findings = scanTsTemplates()

    if (findings.length > BASELINE_DRIFT_COUNT) {
      const sample = findings
        .slice(0, 20)
        .map(
          (f) =>
            `  [${f.templateId}] ${f.blockType}${f.variant ? `@${f.variant}` : ''} — ${f.issue}` +
            (f.expected ? ` (expected one of: ${f.expected.join(', ')})` : ''),
        )
        .join('\n')
      throw new Error(
        `Drift regression: ${findings.length} findings (baseline ${BASELINE_DRIFT_COUNT}).\n` +
          `First 20:\n${sample}`,
      )
    }

    expect(findings.length).toBeLessThanOrEqual(BASELINE_DRIFT_COUNT)
  })

  it('every drift finding has stable shape', () => {
    const findings = scanTsTemplates()
    for (const f of findings) {
      expect(f.source).toBe('ts')
      expect(typeof f.templateId).toBe('string')
      expect(typeof f.blockType).toBe('string')
      expect(['unknown-block', 'unknown-variant', 'schema-drift', 'stale-version']).toContain(
        f.issue,
      )
    }
  })

  // ── Sanity: registry coverage ──────────────────────────────────────────────

  it('registry exposes required API surface used by validator', () => {
    expect(typeof blockRegistry.has).toBe('function')
    expect(typeof blockRegistry.getBlockMeta).toBe('function')
    expect(typeof blockRegistry.getSchema).toBe('function')
    expect(blockRegistry.count).toBeGreaterThan(10)
  })
})
