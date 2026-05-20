/**
 * Block schema version tests — ensures `computeBlockSchemaVersion()` is
 * deterministic and produces valid short-sha256 hex.
 *
 * Coverage: TC-F01-D.02 (template-first gen per-template staleness)
 * Plan: plans/260419-2022-GH-1-harness-template-block-sync-flow/phase-05-template-versioning.md
 */

import { describe, expect, it } from 'vitest'

import { computeBlockSchemaVersion } from '@/lib/ai/block-schema-version'

describe('TC-F01-D.02 — block schema version', () => {
  it('returns a 16-char lowercase hex string', () => {
    const v = computeBlockSchemaVersion()
    expect(v).toMatch(/^[0-9a-f]{16}$/)
  })

  it('is deterministic across repeated calls (same registry snapshot)', () => {
    // Arrange
    const first = computeBlockSchemaVersion()
    // Act
    const second = computeBlockSchemaVersion()
    const third = computeBlockSchemaVersion()
    // Assert — pure read from module-level registry, so all calls match.
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('is non-empty and stable within the process', () => {
    const v = computeBlockSchemaVersion()
    expect(v.length).toBe(16)
    // Hash covers all registered blocks; the registry is never empty.
    expect(v).not.toBe('0000000000000000')
  })
})
