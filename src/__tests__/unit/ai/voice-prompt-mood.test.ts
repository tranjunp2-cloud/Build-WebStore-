/**
 * Snapshot-style tests for buildUserPrompt voice injection (Phase 02).
 *
 * Coverage: TC-F01-W.10 — when mood is supplied, prompt contains a
 * COPY VOICE block with mood label, copyTone, and bulleted voice rules.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-02-theme-moods-system.md
 */

import { describe, it, expect } from 'vitest'
import { buildUserPrompt } from '@/lib/ai/system-prompt'
import { THEME_MOODS, ALL_MOOD_IDS } from '@/lib/ai/theme-moods'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

function baseInfo(overrides: Partial<BusinessInfoInput> = {}): BusinessInfoInput {
  return {
    businessName: 'Zen Ramen',
    industry: 'restaurant',
    products: 'ramen, sushi',
    shortDescription: 'Japanese food.',
    ...overrides,
  }
}

describe('TC-F01-W.10 — buildUserPrompt mood voice injection', () => {
  it('includes COPY VOICE header when mood supplied', () => {
    const prompt = buildUserPrompt(baseInfo(), { mood: THEME_MOODS.elegant })
    expect(prompt).toContain('COPY VOICE')
    expect(prompt).toContain('Elegant')
    expect(prompt).toContain('aspirational')
  })

  it('injects bulleted voice rules', () => {
    const prompt = buildUserPrompt(baseInfo(), { mood: THEME_MOODS.playful })
    // playful voice rules contain "texting a close friend"
    expect(prompt).toContain('texting a close friend')
    // Bulleted format: lines starting with "  - "
    expect(prompt.split('\n').filter((l) => l.startsWith('  - ')).length).toBeGreaterThanOrEqual(4)
  })

  it('includes imagery mood hint', () => {
    const prompt = buildUserPrompt(baseInfo(), { mood: THEME_MOODS.serene })
    expect(prompt).toMatch(/Imagery mood:/)
    // serene imagery includes "minimalist" or "natural light"
    expect(prompt).toMatch(/minimalist|natural light|calm/)
  })

  it.each(ALL_MOOD_IDS)('mood "%s" injects voice block', (moodId) => {
    const prompt = buildUserPrompt(baseInfo(), { mood: THEME_MOODS[moodId] })
    expect(prompt).toContain('COPY VOICE')
    expect(prompt).toContain(THEME_MOODS[moodId].label)
  })

  it('falls back to legacy personality when mood is NOT supplied', () => {
    const prompt = buildUserPrompt(baseInfo(), { mood: undefined })
    // Should contain either "Design personality:" (legacy path) OR still work
    expect(prompt).toContain('Zen Ramen')
    // Should NOT contain COPY VOICE header
    expect(prompt).not.toContain('COPY VOICE')
  })

  it('backward compat — legacy string arg still works', () => {
    const prompt = buildUserPrompt(baseInfo(), 'Focus on vegan options', 'en')
    expect(prompt).toContain('Focus on vegan options')
    expect(prompt).toContain('Zen Ramen')
  })

  it('different moods produce different voice bullets (TC-F01-W.10 distinctness)', () => {
    const elegant = buildUserPrompt(baseInfo(), { mood: THEME_MOODS.elegant })
    const bold = buildUserPrompt(baseInfo(), { mood: THEME_MOODS.bold })
    // Elegant has "measured, never showy"
    expect(elegant).toMatch(/measured/)
    // Bold has "Lead with the verb"
    expect(bold).toMatch(/Lead with the verb/)
    // They should differ
    expect(elegant).not.toBe(bold)
  })

  it('preserves user contact fields (phase-01 regression)', () => {
    const prompt = buildUserPrompt(
      baseInfo({ phone: '+60 12-345', email: 'a@b.my' }),
      { mood: THEME_MOODS.playful },
    )
    expect(prompt).toContain('+60 12-345')
    expect(prompt).toContain('a@b.my')
    expect(prompt).toContain('COPY VOICE')
  })
})
