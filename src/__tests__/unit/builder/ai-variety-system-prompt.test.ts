/**
 * Unit Tests: AI Variety — System Prompt (Phase 02)
 * TC-IDs: TC-F01-V.01 → TC-F01-V.07
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/blocks/registry', () => ({
  blockRegistry: {
    getAllMeta: vi.fn(() => [
      { type: 'hero', name: 'Hero', description: 'Hero section', variants: ['centered', 'split-left'], defaultVariant: 'centered', editableFields: ['headline'] },
      { type: 'features', name: 'Features', description: 'Features section', variants: ['grid-3', 'list'], defaultVariant: 'grid-3', editableFields: ['features'] },
    ]),
    has: vi.fn(() => true),
    getBlockMeta: vi.fn(() => ({ type: 'hero', variants: ['centered', 'split-left'], defaultVariant: 'centered' })),
    validate: vi.fn(() => ({ success: true, data: {} })),
  },
}))

import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai/system-prompt'
import { THEME_MOODS } from '@/lib/ai/theme-moods'

const businessInfo = {
  businessName: 'Nasi Kandar Pelita',
  industry: 'restaurant',
  products: 'nasi kandar, roti canai, teh tarik',
  shortDescription: 'Traditional Malaysian restaurant in Kuala Lumpur',
}

// ── TC-F01-V.01: buildUserPrompt() injects mood COPY VOICE ──────────────
// Plan 260414-2249 phase-02 (theme-moods) deprecated the legacy
// "Design personality:" single-line personality injection in favour of a
// mood-driven `COPY VOICE (...):` block that only fires when the caller
// passes a mood option. Legacy no-mood calls now add no personality hint
// at all — the previous STYLE_PERSONALITIES fallback was removed with
// commit da3c2c74 ("close phase-02 gaps 3 + 4 — deprecate legacy mood
// paths").

describe('TC-F01-V.01: buildUserPrompt — inject mood COPY VOICE', () => {
  it('should contain "COPY VOICE" block when mood is provided', () => {
    // Arrange + Act
    const prompt = buildUserPrompt(businessInfo, { mood: THEME_MOODS.elegant })

    // Assert — mood-driven voice block injected with tone label
    expect(prompt).toContain('COPY VOICE')
    expect(prompt).toContain(THEME_MOODS.elegant.label)
  })

  it('should not add any personality block when mood is not provided (legacy callers)', () => {
    // Arrange + Act
    const prompt = buildUserPrompt(businessInfo)

    // Assert — no legacy "Design personality:" line and no COPY VOICE block
    expect(prompt).not.toContain('Design personality:')
    expect(prompt).not.toContain('COPY VOICE')
  })
})

// ── TC-F01-V.02: buildUserPrompt() — NO personality in reference mode ────

describe('TC-F01-V.02: buildUserPrompt — no personality in reference mode', () => {
  it('should NOT contain "Design personality:" when referencePrompt provided', () => {
    // Arrange + Act
    const prompt = buildUserPrompt(businessInfo, undefined, 'auto', 'REFERENCE CONTENT: Hero headline is XYZ')

    // Assert
    expect(prompt).not.toContain('Design personality:')
    expect(prompt).toContain('REFERENCE CONTENT')
  })
})

// ── TC-F01-V.03: buildUserPrompt() — language 'vi' ──────────────────────

describe('TC-F01-V.03: buildUserPrompt — Vietnamese language', () => {
  it('should contain "Vietnamese" instruction when language = vi', () => {
    const prompt = buildUserPrompt(businessInfo, undefined, 'vi')
    expect(prompt).toContain('Vietnamese')
    // Language instruction should mention Vietnamese specifically
    expect(prompt).toContain('Generate in Vietnamese')
  })
})

// ── TC-F01-V.04: buildSystemPrompt() — includes block registry ──────────

describe('TC-F01-V.04: buildSystemPrompt — includes block registry', () => {
  it('should contain block types from registry in system prompt', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('hero')
    expect(prompt).toContain('features')
    expect(prompt).toContain('(2 total)')
  })
})

// ── TC-F01-V.05: buildUserPrompt() — appends referencePrompt ────────────

describe('TC-F01-V.05: buildUserPrompt — referencePrompt appended', () => {
  it('should contain reference content and IMPORTANT instruction', () => {
    const prompt = buildUserPrompt(businessInfo, undefined, 'auto', 'REFERENCE CONTENT: Hero headline is XYZ')
    expect(prompt).toContain('REFERENCE CONTENT: Hero headline is XYZ')
    expect(prompt).toContain('IMPORTANT: Use the EXACT text')
  })
})

// ── TC-F01-V.06: buildUserPrompt() — language 'ms' ──────────────────────

describe('TC-F01-V.06: buildUserPrompt — Malay language', () => {
  it('should contain "Malay (Bahasa Melayu)" instruction', () => {
    const prompt = buildUserPrompt(businessInfo, undefined, 'ms')
    expect(prompt).toContain('Malay (Bahasa Melayu)')
  })
})

// ── TC-F01-V.07: buildUserPrompt() — extraInstructions ──────────────────

describe('TC-F01-V.07: buildUserPrompt — extraInstructions', () => {
  it('should contain extra instructions in output', () => {
    const prompt = buildUserPrompt(businessInfo, 'Focus on halal certification')
    expect(prompt).toContain('Additional instructions: Focus on halal certification')
  })
})

// ── Additional: System prompt design quality rules ──────────────────────

describe('buildSystemPrompt — design quality rules', () => {
  it('should contain VARIETY RULES section', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('VARIETY RULES')
  })

  it('should contain PROFESSIONAL DESIGN RULES section', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('PROFESSIONAL DESIGN RULES')
  })

  it('should contain anti-pattern blocklist', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('Anti-Patterns')
  })

  it('should not contain legacy composition hint (replaced by RHYTHM recipes)', () => {
    const prompt = buildUserPrompt(businessInfo)
    expect(prompt).not.toContain('Suggested block composition')
  })
})
