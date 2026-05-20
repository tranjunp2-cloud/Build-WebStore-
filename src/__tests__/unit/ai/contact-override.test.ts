/**
 * Unit tests for buildContact user-first override via composeFallbackResult.
 *
 * Coverage: TC-F01-W.02 — when BusinessInfoInput provides phone/email/address,
 * the contact block emits those verbatim instead of canned sample data.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'
import type { GenerationResult } from '@/lib/ai/generate-blocks'

/**
 * Contact blocks live on the Contact page (pages[]), not the home `blocks` array.
 * Walk all pages + top-level blocks to find the first `contact` block.
 */
function findContactBlock(result: GenerationResult): Record<string, unknown> | undefined {
  type Page = { title: string; blocks?: Array<Record<string, unknown>>; layout?: Array<Record<string, unknown>> }
  const pages = (result.pages ?? []) as unknown as Page[]
  for (const page of pages) {
    const blocks = page.blocks ?? page.layout ?? []
    const hit = blocks.find((b) => b.blockType === 'contact')
    if (hit) return hit
  }
  // Fallback: top-level blocks (in case contact is ever inlined on home).
  const topBlocks = (result.blocks ?? []) as unknown as Array<Record<string, unknown>>
  return topBlocks.find((b) => b.blockType === 'contact')
}

function ramenShopInfo(overrides: Partial<BusinessInfoInput> = {}): BusinessInfoInput {
  return {
    businessName: 'Ramen Ichiban',
    industry: 'restaurant',
    products: 'ramen, sushi, gyoza',
    shortDescription: 'Authentic Japanese ramen in Kuala Lumpur.',
    phone: '+60 12-345 6789',
    email: 'hello@ramenichiban.my',
    address: '123 Jalan Bukit Bintang, 55100 KL',
    ...overrides,
  }
}

describe('TC-F01-W.02 — buildContact user-first override', () => {
  it('uses user-supplied phone verbatim in contact block', () => {
    const info = ramenShopInfo()
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)
    const contact = findContactBlock(result)

    expect(contact).toBeDefined()
    expect(contact?.phone).toBe('+60 12-345 6789')
  })

  it('uses user-supplied email verbatim (lowercased)', () => {
    const info = ramenShopInfo({ email: 'HELLO@RamenIchiban.MY' })
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)
    const contact = findContactBlock(result)

    expect(contact?.email).toBe('hello@ramenichiban.my')
  })

  it('uses user-supplied address verbatim', () => {
    const info = ramenShopInfo()
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)
    const contact = findContactBlock(result)

    expect(contact?.address).toBe('123 Jalan Bukit Bintang, 55100 KL')
  })

  it('falls back to canned contact when user fields are empty', () => {
    const info: BusinessInfoInput = {
      businessName: 'Solo Cafe',
      industry: 'restaurant',
      products: 'coffee',
      shortDescription: 'Small neighborhood cafe.',
      // no phone/email/address
    }
    const result = composeFallbackResult('cafe', 42, 'en', info)
    const contact = findContactBlock(result)

    // Canned content kicks in — must be non-empty strings (some @, some digits).
    expect(contact?.phone).toBeTruthy()
    expect(typeof contact?.email).toBe('string')
    expect((contact?.email as string).length).toBeGreaterThan(0)
    expect((contact?.address as string).length).toBeGreaterThan(0)
  })

  it('legacy string overload still works (backward compat)', () => {
    const result = composeFallbackResult('dental clinic', 1, 'en', 'Smile Studio')
    expect(result.siteName).toBe('Smile Studio')
    const blocksJson = JSON.stringify(result.blocks)
    expect(blocksJson).toContain('Smile Studio')
  })

  it('bizOverride deep-clone prevents cache pollution (Risk 1)', () => {
    // Two back-to-back calls with different user info must not leak into each other.
    const info1 = ramenShopInfo({ phone: '+60 11-111 1111' })
    const info2 = ramenShopInfo({ phone: '+60 22-222 2222' })

    const result1 = composeFallbackResult('ramen restaurant', 42, 'en', info1)
    const result2 = composeFallbackResult('ramen restaurant', 42, 'en', info2)

    const contact1 = findContactBlock(result1)
    const contact2 = findContactBlock(result2)

    expect(contact1?.phone).toBe('+60 11-111 1111')
    expect(contact2?.phone).toBe('+60 22-222 2222')
  })

  it('uses user-supplied name in siteName + hero', () => {
    const info = ramenShopInfo()
    const result = composeFallbackResult('ramen restaurant', 42, 'en', info)

    expect(result.siteName).toBe('Ramen Ichiban')
    const blocksJson = JSON.stringify(result.blocks)
    expect(blocksJson).toContain('Ramen Ichiban')
  })
})
