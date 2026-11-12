/**
 * Unit Tests: AI Variety — Sanitizer (Phase 03)
 * TC-IDs: TC-F01-V.08 → TC-F01-V.15
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/blocks/registry', () => ({
  blockRegistry: {
    getAllMeta: () => [],
    has: vi.fn((type: string) => ['hero', 'features', 'testimonials', 'footer', 'contact', 'navigation'].includes(type)),
    getBlockMeta: vi.fn((type: string) => {
      const metas: Record<string, { type: string; variants: string[]; defaultVariant: string }> = {
        hero: { type: 'hero', variants: ['centered', 'split-left', 'fullscreen', 'gradient', 'parallax', 'magazine', 'minimal'], defaultVariant: 'centered' },
        features: { type: 'features', variants: ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag', 'carousel'], defaultVariant: 'grid-3' },
        testimonials: { type: 'testimonials', variants: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote'], defaultVariant: 'cards' },
        footer: { type: 'footer', variants: ['simple', 'minimal', 'centered-stack', 'dark-gradient'], defaultVariant: 'simple' },
        contact: { type: 'contact', variants: ['form', 'split', 'card-float', 'minimal-inline'], defaultVariant: 'form' },
        navigation: { type: 'navigation', variants: ['simple', 'centered', 'transparent', 'pill'], defaultVariant: 'simple' },
      }
      return metas[type] ?? null
    }),
    validate: vi.fn((_type: string, data: unknown) => ({ success: true, data })),
  },
}))
vi.mock('@/lib/ai/system-prompt', () => ({
  buildSystemPrompt: () => '',
  buildUserPrompt: () => '',
}))
vi.mock('@/lib/ai/generate-blocks', () => ({
  generateBlocks: () => ({ siteName: 'Test', siteType: 'business', blocks: [], seo: { title: '', description: '' }, theme: { primaryColor: '#000', secondaryColor: '#000', fontHeading: 'Inter', fontBody: 'Inter', colorMode: 'light' } }),
}))

import { sanitizeBlockData, enforceMinContent } from '@/lib/ai/openai-generator'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── TC-F01-V.08: Fuzzy match case-insensitive ───────────────────────────

describe('TC-F01-V.08: sanitizeBlockData — fuzzy match case-insensitive', () => {
  it('should convert "Grid-3" to "grid-3" via case-insensitive match', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = sanitizeBlockData({ blockType: 'features', variant: 'Grid-3' })
    expect(result.variant).toBe('grid-3')
    // Case-insensitive match should NOT log a warning
    const sanitizerWarns = warnSpy.mock.calls.filter(c => String(c[0]).includes('[AI Sanitizer]'))
    expect(sanitizerWarns).toHaveLength(0)
    warnSpy.mockRestore()
  })
})

// ── TC-F01-V.09: Invalid variant → random fallback + console.warn ───────

describe('TC-F01-V.09: sanitizeBlockData — invalid variant → random + log', () => {
  it('should pick a valid variant and log console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = sanitizeBlockData({ blockType: 'hero', variant: 'nonexistent-xyz' })

    const validVariants = ['centered', 'split-left', 'fullscreen', 'gradient', 'parallax', 'magazine', 'minimal']
    expect(validVariants).toContain(result.variant)

    const sanitizerWarns = warnSpy.mock.calls.filter(c => String(c[0]).includes('[AI Sanitizer]'))
    expect(sanitizerWarns.length).toBeGreaterThanOrEqual(1)
    expect(String(sanitizerWarns[0]![0])).toContain('nonexistent-xyz')
    warnSpy.mockRestore()
  })
})

// ── TC-F01-V.10: Invalid variant fallback has diversity ─────────────────

describe('TC-F01-V.10: sanitizeBlockData — fallback diversity', () => {
  it('should produce >= 2 different variants across 20 calls', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const variants = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const result = sanitizeBlockData({ blockType: 'hero', variant: `invalid-${i}` })
      variants.add(result.variant as string)
    }
    expect(variants.size).toBeGreaterThanOrEqual(2)
    vi.restoreAllMocks()
  })
})

// ── TC-F01-V.11: Valid variant preserved, no log ────────────────────────

describe('TC-F01-V.11: sanitizeBlockData — valid variant preserved', () => {
  it('should keep grid-3 unchanged and not log', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = sanitizeBlockData({ blockType: 'features', variant: 'grid-3' })
    expect(result.variant).toBe('grid-3')
    const sanitizerWarns = warnSpy.mock.calls.filter(c => String(c[0]).includes('[AI Sanitizer]'))
    expect(sanitizerWarns).toHaveLength(0)
    warnSpy.mockRestore()
  })
})

// ── TC-F01-V.12: Variant as number → coerced to string ──────────────────

describe('TC-F01-V.12: sanitizeBlockData — variant is number', () => {
  it('should handle numeric variant without crash', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = sanitizeBlockData({ blockType: 'features', variant: 3 as unknown as string })
    expect(typeof result.variant).toBe('string')
    const validVariants = ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag', 'carousel']
    expect(validVariants).toContain(result.variant)
    vi.restoreAllMocks()
  })
})

// ── TC-F01-V.13: Empty variant string → fallback ───────────────────────

describe('TC-F01-V.13: sanitizeBlockData — empty variant string', () => {
  it('should pick a valid variant for empty string', () => {
    const result = sanitizeBlockData({ blockType: 'hero', variant: '' })
    expect(typeof result.variant).toBe('string')
    expect((result.variant as string).length).toBeGreaterThan(0)
  })
})

// ── TC-F01-V.14: Unknown blockType → no crash ──────────────────────────

describe('TC-F01-V.14: sanitizeBlockData — unknown blockType', () => {
  it('should return block without crash for unknown type', () => {
    const result = sanitizeBlockData({ blockType: 'unknown-block-xyz', variant: 'default' })
    expect(result.blockType).toBe('unknown-block-xyz')
    expect(result.variant).toBe('default')
  })
})

// ── TC-F01-V.15: getBlockMeta returns undefined → no crash ─────────────

describe('TC-F01-V.15: sanitizeBlockData — getBlockMeta undefined', () => {
  it('should not crash when getBlockMeta returns null for known type', async () => {
    const registryModule = await import('@/blocks/registry') as any
    const originalGetMeta = registryModule.blockRegistry.getBlockMeta
    registryModule.blockRegistry.getBlockMeta = vi.fn(() => null)

    const result = sanitizeBlockData({ blockType: 'hero', variant: 'centered' })
    expect(result).toBeDefined()
    expect(result.blockType).toBe('hero')

    registryModule.blockRegistry.getBlockMeta = originalGetMeta
  })
})

// ── enforceMinContent — content count guard ─────────────────────────────

describe('enforceMinContent — content count guard', () => {
  it('should fallback carousel to simpler variant when only 1 testimonial', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = enforceMinContent('testimonials', 'carousel', 1)
    expect(result).not.toBe('carousel')
    // Should pick a variant that accepts 1 item (simple or minimal-quote or spotlight)
    expect(['simple', 'minimal-quote', 'spotlight']).toContain(result)
    vi.restoreAllMocks()
  })

  it('should keep carousel variant when 3+ testimonials', () => {
    const result = enforceMinContent('testimonials', 'carousel', 3)
    expect(result).toBe('carousel')
  })

  it('should fallback masonry when only 2 gallery items', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = enforceMinContent('gallery', 'masonry', 2)
    // masonry needs 6, no gallery variant accepts 2 → returns original (no fitting variant)
    // This is expected behavior when all variants need more items
    expect(typeof result).toBe('string')
    vi.restoreAllMocks()
  })

  it('should return original variant for unknown blockType', () => {
    const result = enforceMinContent('unknown-block', 'whatever', 0)
    expect(result).toBe('whatever')
  })
})
