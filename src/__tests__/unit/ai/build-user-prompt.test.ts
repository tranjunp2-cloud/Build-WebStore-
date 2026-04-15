/**
 * Unit tests for buildUserPrompt user-data serialization.
 *
 * Coverage: TC-F01-W.07 — happy-path GPT prompt includes phone/email/address/
 * tagline when provided, mirroring the composer fallback envelope.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import { describe, it, expect } from 'vitest'
import { buildUserPrompt } from '@/lib/ai/system-prompt'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

function baseInfo(overrides: Partial<BusinessInfoInput> = {}): BusinessInfoInput {
  return {
    businessName: 'Ramen Ichiban',
    industry: 'restaurant',
    products: 'ramen, sushi, gyoza',
    shortDescription: 'Authentic Japanese ramen in KL.',
    ...overrides,
  }
}

describe('TC-F01-W.07 — buildUserPrompt serialization', () => {
  it('includes core 4 fields (legacy behavior)', () => {
    const prompt = buildUserPrompt(baseInfo(), undefined, 'en')
    expect(prompt).toContain('Ramen Ichiban')
    expect(prompt).toContain('restaurant')
    expect(prompt).toContain('ramen, sushi, gyoza')
    expect(prompt).toContain('Authentic Japanese ramen in KL.')
  })

  it('injects phone when provided', () => {
    const prompt = buildUserPrompt(baseInfo({ phone: '+60 12-345 6789' }), undefined, 'en')
    expect(prompt).toContain('+60 12-345 6789')
    expect(prompt).toMatch(/phone/i)
  })

  it('injects email when provided', () => {
    const prompt = buildUserPrompt(baseInfo({ email: 'hello@ramen.my' }), undefined, 'en')
    expect(prompt).toContain('hello@ramen.my')
  })

  it('injects address when provided', () => {
    const prompt = buildUserPrompt(
      baseInfo({ address: '123 Jalan Bukit Bintang, 55100 KL' }),
      undefined,
      'en',
    )
    expect(prompt).toContain('123 Jalan Bukit Bintang, 55100 KL')
  })

  it('injects tagline when provided', () => {
    const prompt = buildUserPrompt(
      baseInfo({ tagline: 'Tokyo flavor in every bowl' }),
      undefined,
      'en',
    )
    expect(prompt).toContain('Tokyo flavor in every bowl')
  })

  it('omits optional fields cleanly when empty', () => {
    const prompt = buildUserPrompt(baseInfo(), undefined, 'en')
    expect(prompt).not.toMatch(/^Contact phone:/m)
    expect(prompt).not.toMatch(/^Contact email:/m)
    expect(prompt).not.toMatch(/^Physical address:/m)
    expect(prompt).not.toMatch(/^Tagline:/m)
  })

  it('preserves extraInstructions ordering', () => {
    const prompt = buildUserPrompt(
      baseInfo({ phone: '+60 12' }),
      'Focus on mobile UX',
      'en',
    )
    const phoneIdx = prompt.indexOf('+60 12')
    const extraIdx = prompt.indexOf('Focus on mobile UX')
    expect(phoneIdx).toBeGreaterThan(-1)
    expect(extraIdx).toBeGreaterThan(-1)
    expect(extraIdx).toBeGreaterThan(phoneIdx)
  })

  it('kitchen sink — all fields present', () => {
    const prompt = buildUserPrompt(
      baseInfo({
        phone: '+60 12-345 6789',
        email: 'hello@ramen.my',
        address: '123 Jalan KL',
        tagline: 'Best ramen in town',
      }),
      undefined,
      'en',
    )
    expect(prompt).toContain('+60 12-345 6789')
    expect(prompt).toContain('hello@ramen.my')
    expect(prompt).toContain('123 Jalan KL')
    expect(prompt).toContain('Best ramen in town')
  })
})
