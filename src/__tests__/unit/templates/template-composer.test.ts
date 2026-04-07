import { describe, it, expect } from 'vitest'

import { composeTemplate } from '@/lib/ai/template-composer'
import type { ComposerInput } from '@/lib/ai/template-composer'
import { RESTAURANT_PRESETS, ECOMMERCE_PRESETS, TECH_PRESETS } from '@/lib/ai/theme-presets'
import { blockRegistry } from '@/blocks/registry'

// ── TC-S3-010: Template composer generates valid templates ───────────────

const starterInput: ComposerInput = {
  category: 'restaurant',
  businessIndex: 0,
  variant: 'starter',
  themePreset: RESTAURANT_PRESETS[0]!,
}

const professionalInput: ComposerInput = {
  category: 'ecommerce',
  businessIndex: 1,
  variant: 'professional',
  themePreset: ECOMMERCE_PRESETS[1]!,
}

const premiumInput: ComposerInput = {
  category: 'tech',
  businessIndex: 0,
  variant: 'premium',
  themePreset: TECH_PRESETS[0]!,
}

describe('[TC-S3-010] composeTemplate — starter tier', () => {
  it('returns exactly 1 page', () => {
    // Act
    const template = composeTemplate(starterInput)

    // Assert
    expect(template.pages).toHaveLength(1)
  })

  it('home page has 5-7 blocks', () => {
    // Act
    const template = composeTemplate(starterInput)
    const homePage = template.pages[0]!

    // Assert
    expect(homePage.layout.length).toBeGreaterThanOrEqual(5)
    expect(homePage.layout.length).toBeLessThanOrEqual(7)
  })

  it('isPremium is false', () => {
    // Act
    const template = composeTemplate(starterInput)

    // Assert
    expect(template.isPremium).toBe(false)
  })

  it('tier is starter', () => {
    // Act
    const template = composeTemplate(starterInput)

    // Assert
    expect(template.tier).toBe('starter')
  })
})

describe('[TC-S3-010] composeTemplate — professional tier', () => {
  it('returns 3 pages', () => {
    // Act
    const template = composeTemplate(professionalInput)

    // Assert
    expect(template.pages).toHaveLength(3)
  })

  it('isPremium is false', () => {
    // Act
    const template = composeTemplate(professionalInput)

    // Assert
    expect(template.isPremium).toBe(false)
  })

  it('has home, about, and contact pages', () => {
    // Act
    const template = composeTemplate(professionalInput)
    const slugs = template.pages.map((p) => p.slug)

    // Assert
    expect(slugs).toContain('/')
    expect(slugs).toContain('/about')
    expect(slugs).toContain('/contact')
  })
})

describe('[TC-S3-010] composeTemplate — premium tier', () => {
  it('returns 5 pages', () => {
    // Act
    const template = composeTemplate(premiumInput)

    // Assert
    expect(template.pages).toHaveLength(5)
  })

  it('isPremium is true', () => {
    // Act
    const template = composeTemplate(premiumInput)

    // Assert
    expect(template.isPremium).toBe(true)
  })

  it('has home, about, services, contact, blog pages', () => {
    // Act
    const template = composeTemplate(premiumInput)
    const slugs = template.pages.map((p) => p.slug)

    // Assert
    expect(slugs).toContain('/')
    expect(slugs).toContain('/about')
    expect(slugs).toContain('/services')
    expect(slugs).toContain('/contact')
    expect(slugs).toContain('/blog')
  })
})

describe('[TC-S3-010] composeTemplate — common invariants', () => {
  const allInputs = [starterInput, professionalInput, premiumInput]

  for (const input of allInputs) {
    describe(`${input.variant} tier`, () => {
      it('first block is always navigation', () => {
        // Act
        const template = composeTemplate(input)

        // Assert
        for (const page of template.pages) {
          expect(page.layout[0]).toHaveProperty('blockType', 'navigation')
        }
      })

      it('last block is always footer', () => {
        // Act
        const template = composeTemplate(input)

        // Assert
        for (const page of template.pages) {
          const lastBlock = page.layout[page.layout.length - 1]
          expect(lastBlock).toHaveProperty('blockType', 'footer')
        }
      })

      it('template name is non-empty and descriptive', () => {
        // Act
        const template = composeTemplate(input)

        // Assert
        expect(template.name.trim().length).toBeGreaterThan(0)
        expect(template.name).toContain(' — ')
      })

      it('all block configs have valid blockType', () => {
        // Act
        const template = composeTemplate(input)

        // Assert
        for (const page of template.pages) {
          for (const block of page.layout) {
            const blockType = (block as { blockType: string }).blockType
            expect(blockRegistry.has(blockType)).toBe(true)
          }
        }
      })

      it('template description is non-empty', () => {
        // Act
        const template = composeTemplate(input)

        // Assert
        expect(template.description.trim().length).toBeGreaterThan(0)
      })

      it('category matches input', () => {
        // Act
        const template = composeTemplate(input)

        // Assert
        expect(template.category).toBe(input.category)
      })
    })
  }
})

describe('[TC-S3-010] composeTemplate — error handling', () => {
  it('throws for unknown category', () => {
    // Arrange
    const badInput: ComposerInput = {
      category: 'nonexistent',
      businessIndex: 0,
      variant: 'starter',
      themePreset: RESTAURANT_PRESETS[0]!,
    }

    // Act & Assert
    expect(() => composeTemplate(badInput)).toThrow('Unknown category')
  })

  it('throws for out-of-range business index', () => {
    // Arrange
    const badInput: ComposerInput = {
      category: 'restaurant',
      businessIndex: 999,
      variant: 'starter',
      themePreset: RESTAURANT_PRESETS[0]!,
    }

    // Act & Assert
    expect(() => composeTemplate(badInput)).toThrow('out of range')
  })
})
